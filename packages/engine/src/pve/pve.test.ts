import { describe, expect, it } from 'vitest';
import { generateEnemies, curveLevel } from './curve';
import { isSameUtcWeek, nextWeekStart, weekKey, weekdayUtc } from './reset';
import { advanceTower, canClimb, canSweep, claimableTowerMilestones, initialTowerState, nextTowerFloor, rollTower, spendSweep, towerFloorReward, towerMilestones, type TowerTuning } from './tower';
import { isTrialEligible, trialAvailable, trialBattleRules, trialLevelCap, trialOpenOn, trialSurvivalRounds } from './trials';
import { attackerDamage, canChallengeBoss, claimableMilestones, ghostRecords, initialWorldBossState, rankDamage, reachedMilestones, recordBossDamage, rollWorldBossDay, worldBossForWeekday } from './worldBoss';
import { dungeonsForWeekday, initialDungeonState, isDungeonCleared, markDungeonCleared, rollDungeonDay } from './dungeons';
import { canUpgradeCrystal, countQualifying, crystalCap, crystalUpgradeCost, effectiveLevelCap, initialLinkCrystal, isCrystalUnlocked, maybeUnlockCrystal, type LinkCrystalTuning } from './linkCrystal';
import type { DungeonDef, GeneratedEnemy, TrialDef, WorldBossDef, WorldBossMilestone } from './index';

const towerTuning: TowerTuning = {
  climbsPerWeek: 20,
  sweepsPerDay: 2,
  milestoneEvery: 5,
  milestoneCap: 20,
  reward: { goldBase: 3000, goldPerFloor: 500, shardBase: 50, shardPerFloor: 10, coinBase: 20, coinPerFloor: 2, capFloor: 10 },
};

describe('reset helpers', () => {
  it('reports the UTC weekday', () => {
    // 2026-10-15 is a Thursday.
    expect(weekdayUtc(Date.UTC(2026, 9, 15))).toBe(4);
    expect(weekdayUtc(Date.UTC(2026, 9, 18))).toBe(0); // Sunday
  });

  it('groups Monday–Sunday into one ISO week key', () => {
    const mon = weekKey(Date.UTC(2026, 9, 12)); // Monday
    const sun = weekKey(Date.UTC(2026, 9, 18)); // Sunday
    const nextMon = weekKey(Date.UTC(2026, 9, 19));
    expect(mon).toBe(sun);
    expect(isSameUtcWeek(Date.UTC(2026, 9, 12), Date.UTC(2026, 9, 18))).toBe(true);
    expect(nextMon).not.toBe(mon);
    expect(mon).toMatch(/^2026-W\d\d$/);
  });

  it('finds the next Monday 00:00 UTC', () => {
    const thu = Date.UTC(2026, 9, 15, 12);
    expect(nextWeekStart(thu)).toBe(Date.UTC(2026, 9, 19));
    // Already Monday: next Monday is a week out.
    expect(nextWeekStart(Date.UTC(2026, 9, 12))).toBe(Date.UTC(2026, 9, 19));
  });
});

describe('enemy curve', () => {
  const curve = { pool: ['a', 'b', 'c', 'd'], count: 3, baseLevel: 5, levelSlope: 1.1, starsEvery: 10, maxStars: 6, stageEvery: 20, maxStage: 3 };

  it('grows the level geometrically and respects stars/stage caps', () => {
    expect(curveLevel(curve, 0)).toBe(5);
    expect(curveLevel(curve, 5)).toBe(8); // 5 × 1.1^5 ≈ 8.05
    expect(curveLevel(curve, 100)).toBeGreaterThan(curveLevel(curve, 50));
  });

  it('is deterministic for a given index and unique within a squad', () => {
    const a = generateEnemies(curve, 7);
    const b = generateEnemies(curve, 7);
    expect(a).toEqual(b);
    const ids = new Set(a.map((e) => e.speciesId));
    expect(ids.size).toBe(a.length);
    expect(a).toHaveLength(3);
    expect(a.every((e: GeneratedEnemy) => e.level >= 5)).toBe(true);
  });

  it('returns an empty squad for an empty pool', () => {
    expect(generateEnemies({ ...curve, pool: [] }, 0)).toEqual([]);
  });
});

describe('tower', () => {
  it('resets the sweep counter daily and the climb counter weekly', () => {
    let s = initialTowerState('2026-10-15', '2026-W42');
    s = advanceTower(s, 1);
    s = spendSweep(s);
    expect(s.climbsThisWeek).toBe(1);
    expect(s.sweepsToday).toBe(1);
    // Same day, same week: unchanged.
    expect(rollTower(s, '2026-10-15', '2026-W42')).toEqual(s);
    // New day: sweeps reset, climbs kept.
    const nextDay = rollTower(s, '2026-10-16', '2026-W42');
    expect(nextDay.sweepsToday).toBe(0);
    expect(nextDay.climbsThisWeek).toBe(1);
    // New week: climbs reset too, floor is permanent.
    const nextWeek = rollTower(s, '2026-10-19', '2026-W43');
    expect(nextWeek.climbsThisWeek).toBe(0);
    expect(nextWeek.floor).toBe(1);
  });

  it('limits climbs per week and sweeps per day', () => {
    let s = initialTowerState('d', 'w');
    for (let i = 0; i < 20; i += 1) s = advanceTower(s, i + 1);
    expect(canClimb(s, towerTuning)).toBe(false);
    expect(canSweep(s, towerTuning)).toBe(true);
    expect(nextTowerFloor(s)).toBe(21);
    s = spendSweep(spendSweep(s));
    expect(canSweep(s, towerTuning)).toBe(false);
  });

  it('pays a rising floor reward that flattens at the cap', () => {
    const floor1 = towerFloorReward(1, towerTuning);
    const floor10 = towerFloorReward(10, towerTuning);
    const floor50 = towerFloorReward(50, towerTuning);
    expect(floor1.gold).toBe(3500);
    expect(floor10.gold).toBe(8000);
    expect(floor50.gold).toBe(floor10.gold); // 10 == capFloor
    expect(floor1.wildCoin).toBe(22);
  });

  it('lists milestone floors and only offers reached, unclaimed ones', () => {
    expect(towerMilestones(towerTuning)).toEqual([5, 10, 15, 20]);
    let s = initialTowerState('d', 'w');
    s = { ...advanceTower(s, 12), claimedMilestones: [5] };
    expect(claimableTowerMilestones(s, towerTuning)).toEqual([10]);
  });
});

const trialBase: Omit<TrialDef, 'rule'> = {
  id: 't',
  name: 'T',
  tagline: 'tag',
  unlockLevel: 1,
  preview: { gold: 100 },
  rewards: { gold: 200 },
  enemy: { factions: [], tiers: [], count: 3, baseLevel: 5, levelSlope: 1.1, starsEvery: 5, maxStars: 6, stageEvery: 10, maxStage: 3 },
};

describe('trials', () => {
  it('enforces a faction lock', () => {
    const t: TrialDef = { ...trialBase, rule: 'factionLocked', faction: 'ember' };
    expect(isTrialEligible(t, 'ember')).toBe(true);
    expect(isTrialEligible(t, 'tide')).toBe(false);
    const other: TrialDef = { ...trialBase, rule: 'noUltimate' };
    expect(isTrialEligible(other, 'tide')).toBe(true);
  });

  it('exposes the level cap and survival rounds per rule', () => {
    const capped: TrialDef = { ...trialBase, rule: 'levelCapped', maxLevel: 20 };
    expect(trialLevelCap(capped)).toBe(20);
    expect(trialLevelCap({ ...trialBase, rule: 'noUltimate' })).toBeNull();
    const surv: TrialDef = { ...trialBase, rule: 'survival', survivalRounds: 5 };
    expect(trialSurvivalRounds(surv)).toBe(5);
    expect(trialSurvivalRounds({ ...trialBase, rule: 'noUltimate' })).toBeNull();
  });

  it('only opens a weekday boss on its days', () => {
    const boss: TrialDef = { ...trialBase, rule: 'weekdayBoss', weekdays: [1, 3] };
    expect(trialOpenOn(boss, 1)).toBe(true);
    expect(trialOpenOn(boss, 2)).toBe(false);
    expect(trialOpenOn({ ...trialBase, rule: 'noUltimate' }, 2)).toBe(true);
    expect(trialAvailable(boss, 1, 1)).toBe(true);
    expect(trialAvailable(boss, 1, 2)).toBe(false);
  });

  it('derives combat rules', () => {
    expect(trialBattleRules({ ...trialBase, rule: 'noUltimate' })).toEqual({ noUltimate: true });
    expect(trialBattleRules({ ...trialBase, rule: 'survival', survivalRounds: 6 })).toEqual({ survivalRounds: 6 });
    expect(trialBattleRules({ ...trialBase, rule: 'factionLocked', faction: 'grove' })).toEqual({});
  });
});

const bossDefs: WorldBossDef[] = [
  { weekday: 4, speciesId: 'x', name: 'Thursday Boss' },
  { weekday: 0, speciesId: 'y', name: 'Sunday Boss' },
];
const milestones: WorldBossMilestone[] = [
  { damage: 1000, rewards: { gold: 1 } },
  { damage: 5000, rewards: { gold: 2 } },
  { damage: 20000, rewards: { gold: 3 } },
];

describe('world boss', () => {
  it('rotates a boss per weekday', () => {
    expect(worldBossForWeekday(bossDefs, 4)?.name).toBe('Thursday Boss');
    expect(worldBossForWeekday(bossDefs, 2)).toBeNull();
  });

  it('sums attacker damage from the battle ledger only', () => {
    const dealt = { 'attackers:1': 1200, 'attackers:2': 800, 'defenders:1': 9999 };
    expect(attackerDamage({ damageDealt: dealt })).toBe(2000);
  });

  it('records damage, keeps a capped history and resets daily', () => {
    let s = initialWorldBossState('2026-10-15');
    s = recordBossDamage(s, 1000, 3);
    s = recordBossDamage(s, 5000, 3);
    expect(s.attempts).toBe(2);
    expect(s.lastDamage).toBe(5000);
    expect(s.bestDamage).toBe(5000);
    expect(canChallengeBoss(s, 3)).toBe(true);
    expect(rollWorldBossDay(s, '2026-10-15')).toBe(s);
    const next = rollWorldBossDay(s, '2026-10-16');
    expect(next.attempts).toBe(0);
    expect(next.bestDamage).toBe(5000);
  });

  it('tracks reached and claimable milestones', () => {
    expect(reachedMilestones(5000, milestones)).toEqual([0, 1]);
    const s = { ...initialWorldBossState('d'), claimedMilestones: [0] };
    expect(claimableMilestones(s, 5000, milestones)).toEqual([1]);
  });

  it('ranks damage against a ghost ladder and is deterministic', () => {
    const ghosts = ghostRecords([3000, 4000], 7, 5);
    expect(ghosts).toEqual(ghostRecords([3000, 4000], 7, 5));
    const top = Math.max(...ghosts);
    expect(rankDamage(1e9, ghosts)).toBe(1);
    expect(rankDamage(0, ghosts)).toBe(ghosts.length + 1);
    expect(rankDamage(top, ghosts)).toBe(1);
  });
});

const dungeons: DungeonDef[] = [
  { id: 'mon', name: 'Mon', weekday: 1, desc: '', rewards: { candy: 100 }, enemy: { factions: [], tiers: [], count: 3, baseLevel: 5, levelSlope: 1.1, starsEvery: 5, maxStars: 5, stageEvery: 10, maxStage: 2 } },
  { id: 'thu', name: 'Thu', weekday: 4, desc: '', rewards: { stone: 1 }, enemy: { factions: [], tiers: [], count: 3, baseLevel: 9, levelSlope: 1.1, starsEvery: 5, maxStars: 5, stageEvery: 10, maxStage: 2 } },
];

describe('dungeons', () => {
  it('opens one run per weekday', () => {
    expect(dungeonsForWeekday(dungeons, 4).map((d) => d.id)).toEqual(['thu']);
    expect(dungeonsForWeekday(dungeons, 2)).toEqual([]);
  });

  it('tracks the cleared set and resets it daily', () => {
    let s = initialDungeonState('2026-10-15');
    s = markDungeonCleared(s, 'thu');
    expect(isDungeonCleared(s, 'thu')).toBe(true);
    expect(markDungeonCleared(s, 'thu')).toBe(s);
    expect(rollDungeonDay(s, '2026-10-15')).toBe(s);
    const next = rollDungeonDay(s, '2026-10-16');
    expect(next.cleared).toEqual([]);
  });
});

const crystalTuning: LinkCrystalTuning = {
  baseCap: 340,
  perStarWild: 8,
  starThreshold: 10,
  initialLevel: 140,
  candyBase: 60,
  candyExponent: 1.2,
  goldPerCandy: 3,
  stonesPerLevel: 2,
};

describe('link crystal', () => {
  it('computes the cap from qualifying Wilds', () => {
    const wilds = [{ stars: 10, atTopStage: true }, { stars: 9, atTopStage: true }, { stars: 10, atTopStage: false }];
    expect(countQualifying(wilds, crystalTuning)).toBe(2);
    expect(crystalCap(wilds, crystalTuning)).toBe(340 + 16);
    expect(crystalCap([], crystalTuning)).toBe(340);
  });

  it('unlocks on the first top-stage Wild and starts at the initial level', () => {
    const locked = initialLinkCrystal();
    const wilds = [{ stars: 1, atTopStage: true }];
    expect(isCrystalUnlocked(wilds)).toBe(true);
    expect(isCrystalUnlocked([{ stars: 1, atTopStage: false }])).toBe(false);
    expect(maybeUnlockCrystal(locked, wilds, crystalTuning)).toEqual({ unlocked: true, level: 140 });
    expect(maybeUnlockCrystal(locked, [{ stars: 1, atTopStage: false }], crystalTuning)).toBe(locked);
  });

  it('prices upgrades by level and blocks them at the cap', () => {
    const c1 = crystalUpgradeCost(140, crystalTuning);
    const c2 = crystalUpgradeCost(200, crystalTuning);
    expect(c1.gold).toBe(c1.candy * 3);
    expect(c1.stones).toBe(2);
    expect(c2.candy).toBeGreaterThan(c1.candy);
    const wilds = [{ stars: 0, atTopStage: true }];
    expect(crystalCap(wilds, crystalTuning)).toBe(340);
    expect(canUpgradeCrystal({ unlocked: true, level: 340 }, wilds, crystalTuning)).toBe(false);
    expect(canUpgradeCrystal({ unlocked: true, level: 339 }, wilds, crystalTuning)).toBe(true);
    expect(canUpgradeCrystal({ unlocked: false, level: 0 }, wilds, crystalTuning)).toBe(false);
  });

  it('raises the level cap only for top-stage Wilds once unlocked', () => {
    const crystal = { unlocked: true, level: 160 };
    expect(effectiveLevelCap({ stars: 1, atTopStage: true }, 140, crystal)).toBe(160);
    expect(effectiveLevelCap({ stars: 1, atTopStage: false }, 100, crystal)).toBe(100);
    const locked = { unlocked: false, level: 0 };
    expect(effectiveLevelCap({ stars: 1, atTopStage: true }, 140, locked)).toBe(140);
  });
});
