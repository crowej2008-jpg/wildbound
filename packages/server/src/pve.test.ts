import { describe, expect, it } from 'vitest';
import { dayKey, weekdayUtc, weekKey, type AccountState } from '@wildbound/engine';
import { buildConfig } from './config';
import { LocalServer } from './local-server';
import { MemoryStore } from './storage';
import { createInitialState, SAVE_KEY, serializeSave } from './save';
import { buildLinkCrystalView } from './pve-view';
import {
  challengeDungeon,
  challengeTower,
  challengeTrial,
  challengeWorldBoss,
  claimWorldBossMilestone,
  crystalWilds,
  dungeonDefs,
  resolvePool,
  sweepTower,
  upgradeLinkCrystal,
} from './pve';

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

  it('climbs the tower, pays the floor reward, and caps weekly climbs', () => {
    const cfg = config();
    const state = strongState(cfg);
    const first = challengeTower(cfg, state, NOW, 7);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.win).toBe(true);
    expect(first.value.extra.floor).toBe(1);
    expect(first.value.state.pve.tower.floor).toBe(1);
    expect(first.value.state.pve.tower.climbsThisWeek).toBe(1);
    expect(first.value.state.currencies.gold).toBeGreaterThan(state.currencies.gold);

    // Weekly cap: 20 climbs allowed (content tuning).
    const spent: AccountState = {
      ...state,
      pve: { ...state.pve, tower: { ...state.pve.tower, climbsThisWeek: cfg.pve.tower.climbsPerWeek } },
    };
    const capped = challengeTower(cfg, spent, NOW, 7);
    expect(capped.ok).toBe(false);
    if (!capped.ok) expect(capped.error).toBe('daily_limit');
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

  it('runs only the dungeon scheduled for today', () => {
    const cfg = config();
    const state = strongState(cfg);
    const today = dungeonDefs(cfg).find((d) => d.weekday === weekdayUtc(NOW));
    expect(today).toBeDefined();
    if (!today) return;
    const other = dungeonDefs(cfg).find((d) => d.weekday !== weekdayUtc(NOW));
    const wrong = challengeDungeon(cfg, state, other?.id ?? 'nope', NOW, 5);
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error).toBe('stage_locked');

    const right = challengeDungeon(cfg, state, today.id, NOW, 5);
    expect(right.ok).toBe(true);
    if (!right.ok) return;
    expect(right.value.extra.dungeonId).toBe(today.id);
    expect(right.value.state.pve.dungeons.cleared).toContain(today.id);
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

  it('unlocks and raises the Link Crystal once a top-stage Wild exists', () => {
    const cfg = config();
    const state = strongState(cfg);
    expect(crystalWilds(cfg, state).every((w) => w.atTopStage)).toBe(true);
    const up = upgradeLinkCrystal(cfg, state);
    expect(up.ok).toBe(true);
    if (!up.ok) return;
    expect(up.value.level).toBe(cfg.pve.linkCrystal.initialLevel + 1);
    expect(up.value.state.currencies.candy).toBeLessThan(state.currencies.candy);
  });

  it('keys the tower week to the UTC ISO week', () => {
    expect(weekKey(NOW)).toBe(weekKey(NOW + 86_400_000 * 2));
    expect(dayKey(NOW)).not.toBe(dayKey(NOW + 86_400_000 * 2));
  });

  it('keeps the Link Crystal locked until a Wild is finished, then unlocks it', () => {
    const cfg = config();
    const fresh = createInitialState(cfg);
    expect(buildLinkCrystalView(cfg, fresh).unlocked).toBe(false);

    const w = fresh.roster[0]!;
    const meta = cfg.species.get(w.speciesId)!;
    const top = meta.stars[meta.stars.length - 1]!;
    const stageCap = top.maxLevel;
    const finished: AccountState = {
      ...fresh,
      roster: fresh.roster.map((x, i) => (i === 0 ? { ...x, level: stageCap, stars: top.star } : x)),
    };
    expect(buildLinkCrystalView(cfg, finished).unlocked).toBe(true);
  });

  it('levels a finished Wild past its form cap once the Link Crystal is raised', async () => {
    const cfg = config();
    const base = createInitialState(cfg);
    const w = base.roster[0]!;
    const meta = cfg.species.get(w.speciesId)!;
    const top = meta.stars[meta.stars.length - 1]!;
    const stageCap = top.maxLevel;
    const crafted: AccountState = {
      ...base,
      roster: base.roster.map((x, i) => (i === 0 ? { ...x, level: stageCap, stars: top.star } : x)),
      currencies: { ...base.currencies, candy: 100_000_000, gold: 100_000_000, stone: 1000 },
      pve: { ...base.pve, linkCrystal: { unlocked: true, level: stageCap + 30 } },
    };
    const store = new MemoryStore();
    await store.write(SAVE_KEY, serializeSave(crafted));
    const srv = new LocalServer(store, cfg);
    const loaded = await srv.loadAccount();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const res = await srv.levelUp(w.id, 1);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const after = res.value.state.roster.find((x) => x.id === w.id)!;
    expect(after.level).toBe(stageCap + 1);
  });
});
