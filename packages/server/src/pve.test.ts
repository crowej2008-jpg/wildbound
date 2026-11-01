import { describe, expect, it } from 'vitest';
import { dayKey, weekdayUtc, weekKey, type AccountState } from '@wildbound/engine';
import { buildConfig } from './config';
import { createInitialState } from './save';
import {
  challengeDungeon,
  claimDungeonChest,
  sweepDungeon,
  challengeTower,
  challengeTrial,
  challengeWorldBoss,
  claimWorldBossMilestone,
  resolvePool,
  sweepTower,
  hardTowerRule,
} from './pve';
import { applyLineupRule, slotToPosition } from './battle';

/** A fixed Thursday (UTC): exercises the weekday-rotating modes deterministically. */
const NOW = Date.UTC(2026, 9, 15, 12, 0, 0);

function config() {
  return { ...buildConfig(), now: () => NOW };
}

/** A fixture account whose six Wilds are fully grown (top star, top level cap), so modes are winnable. */
function strongState(cfg: ReturnType<typeof config>): AccountState {
  const base = createInitialState(cfg);
  const roster = base.roster.map((w) => {
    const top = cfg.species.get(w.speciesId)!.stars.at(-1)!;
    return { ...w, level: top.maxLevel, stars: top.star };
  });
  return {
    ...base,
    roster,
    squads: { ...base.squads, tower: roster.map((w) => w.id), worldBoss: roster.map((w) => w.id) },
  };
}

describe('PvE modes (server glue)', () => {
  it('resolves enemy pools by faction and tier', () => {
    const cfg = config();
    const volt = resolvePool(cfg, { factions: ['light'], tiers: [], count: 6, baseLevel: 1, levelSlope: 1, starsEvery: 1, maxStars: 1, stageEvery: 1, maxStage: 1 });
    expect(volt.length).toBeGreaterThan(0);
    expect(volt.every((id) => cfg.species.get(id)?.faction === 'light')).toBe(true);
    const top = resolvePool(cfg, { factions: [], tiers: ['mythic'], count: 1, baseLevel: 1, levelSlope: 1, starsEvery: 1, maxStars: 1, stageEvery: 1, maxStage: 1 });
    expect(top.every((id) => cfg.species.get(id)?.tier === 'mythic')).toBe(true);
  });

  it('climbs the tower, pays the floor reward, and caps the daily climbs', () => {
    const cfg = config();
    const state = strongState(cfg);
    const first = challengeTower(cfg, state, NOW, 7);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.win).toBe(true);
    expect(first.value.extra.floor).toBe(1);
    expect(first.value.state.pve.tower.floor).toBe(1);
    expect(first.value.state.pve.tower.climbsToday).toBe(1);
    expect(first.value.state.currencies.gold).toBeGreaterThan(state.currencies.gold);

    // Daily cap: 20 climbs a day (content tuning; the source resets daily).
    const spent: AccountState = {
      ...state,
      pve: { ...state.pve, tower: { ...state.pve.tower, day: dayKey(NOW), climbsToday: cfg.pve.tower.climbsPerDay } },
    };
    const capped = challengeTower(cfg, spent, NOW, 7);
    expect(capped.ok).toBe(false);
    if (!capped.ok) expect(capped.error).toBe('daily_limit');
  });

  it('pays the source achievement on floor 10 and applies the Hard stage rule', () => {
    const cfg = config();
    const state = strongState(cfg);
    const at9: AccountState = { ...state, pve: { ...state.pve, tower: { ...state.pve.tower, floor: 9 } } };
    const ten = challengeTower(cfg, at9, NOW, 7);
    if (!ten.ok) throw new Error(ten.message);
    expect(ten.value.win).toBe(true);
    expect(ten.value.rewards.pokemonShard5).toBe(50);

    // Hard floor 1–5 bans position 5; floor 5 pays the Beginner Trainer card.
    expect(hardTowerRule(cfg, 3)).toEqual({ kind: 'noPositions', positions: [5] });
    const at4: AccountState = { ...state, pve: { ...state.pve, tower: { ...state.pve.tower, hardFloor: 4 } } };
    const five = challengeTower(cfg, at4, NOW, 7, 'hard');
    if (!five.ok) throw new Error(five.message);
    expect(five.value.battle.units.filter((u) => u.side === 'attackers').map((u) => u.position)).not.toContain(5);
    if (five.value.win) expect(five.value.state.titles.cards['12']).toBe(1);
  });

  it('applies the Hard lineup caps by faction, class and tier', () => {
    const cfg = config();
    const state = strongState(cfg);
    const wilds = state.roster.slice(0, 6);
    const faction = cfg.species.get(wilds[0]!.speciesId)!.faction;
    const capped = applyLineupRule(cfg, wilds, { kind: 'maxFaction', max: 1, faction });
    expect(capped.wilds.filter((w) => cfg.species.get(w.speciesId)!.faction === faction)).toHaveLength(1);
    const banned = applyLineupRule(cfg, wilds, { kind: 'noPositions', positions: [1, 5] });
    expect(banned.slots.map(slotToPosition)).not.toContain(1);
    expect(banned.slots.map(slotToPosition)).not.toContain(5);
    expect(banned.wilds).toHaveLength(4);
  });

  it('sweeps the tower for the current floor reward, dally-capped', () => {
    const cfg = config();
    const state = strongState(cfg);
    const climbed = challengeTower(cfg, state, NOW, 7);
    if (!climbed.ok) throw new Error('climb failed');
    const swept = sweepTower(cfg, climbed.value.state, NOW);
    expect(swept.ok).toBe(true);
    if (!swept.ok) return;
    expect(swept.value.granted.gold).toBeGreaterThan(0);
    expect(swept.value.state.pve.tower.sweepsToday).toBe(1);
  });

  it('clears a trial, disables ultimates, and pays only the first clear of the day', () => {
    const cfg = config();
    const state = strongState(cfg);
    const first = challengeTrial(cfg, state, 'silentpeak', NOW, 11);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.win).toBe(true);
    expect(first.value.extra.firstToday).toBe(true);
    expect(first.value.battle.events.some((e) => e.type === 'action' && e.skill === 'ult')).toBe(false);

    const second = challengeTrial(cfg, first.value.state, 'silentpeak', NOW, 11);
    if (!second.ok) throw new Error('second trial failed');
    expect(second.value.extra.firstToday).toBe(false);
    expect(second.value.rewards).toEqual({});
  });

  it('locks a trial out on the wrong weekday', () => {
    const cfg = config();
    // 'moonfall' opens Tue/Thu/Sat; pick a Monday.
    const monday = Date.UTC(2026, 9, 12, 12, 0, 0);
    const mondayConfig = { ...cfg, now: () => monday };
    const state = strongState(mondayConfig);
    expect(weekdayUtc(monday)).toBe(1);
    const closed = challengeTrial(mondayConfig, state, 'moonfall', monday, 3);
    expect(closed.ok).toBe(false);
    if (!closed.ok) expect(closed.error).toBe('stage_locked');
  });

  it('runs the source daily dungeons: level gates, two runs a day, grades, sweeps and one-off chests', () => {
    const cfg = config();
    const base = strongState(cfg);
    const locked = challengeDungeon(cfg, { ...base, profile: { ...base.profile, level: 1 } }, 'gold', 0, NOW, 5);
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.error).toBe('stage_locked');

    const state = { ...base, profile: { ...base.profile, level: 80, xp: 1e12 } }; // the trainer level follows XP
    expect(sweepDungeon(cfg, state, 'gold', 0, NOW).ok).toBe(false); // no grade yet
    const fight = challengeDungeon(cfg, state, 'gold', 0, NOW, 5);
    if (!fight.ok) throw new Error(fight.message);
    const { grade, kills } = fight.value.extra;
    expect(kills).toBeGreaterThanOrEqual(3);
    expect(grade).not.toBeNull();
    const entry = cfg.dailyDungeons.dungeons[0]!.difficulties[0]!;
    expect(fight.value.rewards).toEqual(entry.grades.find((g) => g.grade === grade)!.pay);
    expect(fight.value.state.pve.dungeons.runs.gold).toBe(1);

    const swept = sweepDungeon(cfg, fight.value.state, 'gold', 0, NOW);
    if (!swept.ok) throw new Error(swept.message);
    expect(swept.value.granted).toEqual({ gold: 180_000 });
    const third = challengeDungeon(cfg, swept.value.state, 'gold', 0, NOW, 6);
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.error).toBe('daily_limit');

    const chest = claimDungeonChest(cfg, swept.value.state, entry.id, 'C');
    if (!chest.ok) throw new Error(chest.message);
    expect(chest.value.granted).toEqual(entry.grades[0]!.chest);
    expect(claimDungeonChest(cfg, chest.value.state, entry.id, 'C').ok).toBe(false);
    // The next day the runs come back; the chest stays drawn.
    const tomorrow = challengeDungeon(cfg, chest.value.state, 'gold', 0, NOW + 86_400_000, 7);
    expect(tomorrow.ok).toBe(true);
  });

  it('scores world-boss damage, records the attempt, and caps attempts per day', () => {
    const cfg = config();
    const state = strongState(cfg);
    const fight = challengeWorldBoss(cfg, state, NOW, 9);
    expect(fight.ok).toBe(true);
    if (!fight.ok) return;
    expect(fight.value.extra.damage).toBeGreaterThan(0);
    expect(fight.value.extra.attemptsLeft).toBe(cfg.pve.worldBoss.attemptsPerDay - 1);
    expect(fight.value.extra.ghosts).toHaveLength(cfg.pve.worldBoss.ghostCount);
    expect(fight.value.state.pve.worldBoss.attempts).toBe(1);
    expect(fight.value.state.pve.worldBoss.history).toContain(fight.value.extra.damage);

    const spent: AccountState = {
      ...state,
      pve: { ...state.pve, worldBoss: { ...state.pve.worldBoss, attempts: cfg.pve.worldBoss.attemptsPerDay } },
    };
    const capped = challengeWorldBoss(cfg, spent, NOW, 9);
    expect(capped.ok).toBe(false);
    if (!capped.ok) expect(capped.error).toBe('daily_limit');
  });

  it('claims a reached world-boss milestone exactly once', () => {
    const cfg = config();
    const state = strongState(cfg);
    const reached: AccountState = {
      ...state,
      pve: {
        ...state.pve,
        worldBoss: { ...state.pve.worldBoss, lastDamage: cfg.pve.worldBoss.milestones[0]!.damage },
      },
    };
    const claim = claimWorldBossMilestone(cfg, reached, 0);
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(claim.value.granted).toEqual(cfg.pve.worldBoss.milestones[0]!.rewards);
    const again = claimWorldBossMilestone(cfg, claim.value.state, 0);
    expect(again.ok).toBe(false);
  });

  it('keys the tower week to the UTC ISO week', () => {
    expect(weekKey(NOW)).toBe(weekKey(NOW + 86_400_000 * 2));
    expect(dayKey(NOW)).not.toBe(dayKey(NOW + 86_400_000 * 2));
  });
});
