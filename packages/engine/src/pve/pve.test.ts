import { describe, expect, it } from 'vitest';
import { generateEnemies, curveLevel } from './curve';
import { isSameUtcWeek, nextWeekStart, weekKey, weekdayUtc } from './reset';
import { advanceTower, canClimb, canSweep, initialTowerState, nextTowerFloor, rollTower, spendClimb, spendSweep, towerFloorReward, type TowerTuning } from './tower';
import { attackerDamage, canChallengeBoss, claimableMilestones, ghostRecords, initialWorldBossState, rankDamage, reachedMilestones, recordBossDamage, rollWorldBossDay, worldBossForWeekday } from './worldBoss';
import { betterGrade, dungeonGrade, initialDungeonState, openChests, rollDungeonDay } from './dungeons';
import type { DungeonGradeGoal, GeneratedEnemy, WorldBossDef, WorldBossMilestone } from './index';

const towerTuning: TowerTuning = {
  climbsPerDay: 20,
  sweepsPerDay: 2,
  normalFloors: 1000,
  hardFloors: 750,
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
  it('resets climbs and sweeps daily; floors are permanent (R9: source daily reset)', () => {
    let s = initialTowerState('2026-10-15');
    s = spendSweep(advanceTower(advanceTower(s, 1), 1, 'hard'));
    expect([s.climbsToday, s.hardClimbsToday, s.sweepsToday]).toEqual([1, 1, 1]);
    expect(rollTower(s, '2026-10-15')).toBe(s);
    const next = rollTower(s, '2026-10-16');
    expect([next.climbsToday, next.hardClimbsToday, next.sweepsToday]).toEqual([0, 0, 0]);
    expect([next.floor, next.hardFloor]).toEqual([1, 1]);
  });

  it('limits each tower\'s climbs a day and stops at its top floor; a lost climb still counts', () => {
    let s = initialTowerState('d');
    for (let i = 0; i < 19; i += 1) s = advanceTower(s, i + 1);
    s = spendClimb(s);
    expect(canClimb(s, towerTuning)).toBe(false);
    expect(canClimb(s, towerTuning, 'hard')).toBe(true);
    expect(nextTowerFloor(s)).toBe(20);
    expect(canClimb({ ...initialTowerState('d'), hardFloor: 750 }, towerTuning, 'hard')).toBe(false);
    expect(canSweep(s, towerTuning)).toBe(true);
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

const goals: DungeonGradeGoal[] = [
  { grade: 'C', kills: 3 },
  { grade: 'B', kills: 6 },
  { grade: 'A', kills: 6, rounds: 7 },
  { grade: 'S', kills: 6, rounds: 4 },
];

describe('R9 daily dungeons', () => {
  it('grades by kills within the rounds', () => {
    expect(dungeonGrade(goals, { kills: 2, damage: 0, rounds: 10 })).toBeNull();
    expect(dungeonGrade(goals, { kills: 3, damage: 0, rounds: 10 })).toBe('C');
    expect(dungeonGrade(goals, { kills: 6, damage: 0, rounds: 8 })).toBe('B');
    expect(dungeonGrade(goals, { kills: 6, damage: 0, rounds: 5 })).toBe('A');
    expect(dungeonGrade(goals, { kills: 6, damage: 0, rounds: 4 })).toBe('S');
    expect(dungeonGrade([{ grade: 'C', damage: 100_000 }], { kills: 0, damage: 120_000, rounds: 10 })).toBe('C');
    expect(betterGrade('B', 'C')).toBe('B');
    expect(betterGrade(undefined, null)).toBeUndefined();
  });

  it('resets runs daily but keeps grades and one-off chests', () => {
    const s = { ...initialDungeonState('2026-10-15'), runs: { gold: 2 }, best: { d1: 'B' as const }, chests: ['d1:C'] };
    expect(openChests(s, 'd1')).toEqual(['B']);
    expect(rollDungeonDay(s, '2026-10-15')).toBe(s);
    const next = rollDungeonDay(s, '2026-10-16');
    expect(next.runs).toEqual({});
    expect(next.best).toEqual({ d1: 'B' });
    expect(next.chests).toEqual(['d1:C']);
  });
});
