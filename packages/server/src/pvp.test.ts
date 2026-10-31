import { describe, expect, it } from 'vitest';
import { dayKey, orderStages, weekKey, type AccountState } from '@wildbound/engine';
import { buildConfig } from './config';
import { LocalServer } from './local-server';
import { MemoryStore } from './storage';
import { createInitialState, migrateSave, SAVE_KEY, SAVE_VERSION, serializeSave } from './save';
import {
  arenaTuning,
  arenaUnlocked,
  buyArenaAttempts,
  challengeArena,
  claimArenaAchievement,
  claimArenaChest,
  refreshArena,
} from './pvp';
import { buildArenaRankingsView, buildArenaView } from './pvp-view';

/** A fixed Saturday (UTC): a stable Arena day + ISO week. */
const NOW = Date.UTC(2026, 9, 17, 12, 0, 0);

function config() {
  return { ...buildConfig(), now: () => NOW };
}

/** Mark the last stage of `chapter` cleared so the mode's gate opens. */
function clearChapter(state: AccountState, cfg: ReturnType<typeof config>, chapter: number): AccountState {
  const stages = orderStages(cfg.stages).filter((s) => s.chapter === chapter);
  const last = stages[stages.length - 1];
  if (!last) return state;
  return { ...state, campaign: { stars: { ...state.campaign.stars, [last.id]: 3 } } };
}

/** A fixture whose six Wilds are fully grown and whose Arena squads are set. */
function grownState(cfg: ReturnType<typeof config>): AccountState {
  const base = createInitialState(cfg);
  const roster = base.roster.map((w) => ({ ...w, level: 140, stars: 10, evolutionStage: 3 }));
  const ids = roster.map((w) => w.id);
  const unlocked = clearChapter(base, cfg, cfg.pvp.arenaChapter);
  return {
    ...unlocked,
    roster,
    squads: { ...unlocked.squads, arenaAttack: ids, arenaDefence: ids },
  };
}

describe('Arena (server glue)', () => {
  it('projects the content table into the engine tuning', () => {
    const cfg = config();
    const tuning = arenaTuning(cfg);
    expect(tuning.freeAttemptsPerDay).toBe(cfg.pvp.arena.freeAttemptsPerDay);
    expect(tuning.bands).toHaveLength(cfg.pvp.arena.bands.length);
    expect(tuning.opponentCount).toBe(cfg.pvp.arena.opponentCount);
  });

  it('gates the Arena behind its campaign chapter', () => {
    const cfg = config();
    const fresh = createInitialState(cfg);
    expect(arenaUnlocked(cfg, fresh)).toBe(false);
    expect(buildArenaView(cfg, fresh, NOW).unlocked).toBe(false);
    const blocked = challengeArena(cfg, fresh, NOW, 0, 7);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toBe('stage_locked');

    const opened = grownState(cfg);
    expect(arenaUnlocked(cfg, opened)).toBe(true);
  });

  it('shows three matched opponents with a stable trio per day', () => {
    const cfg = config();
    const state = grownState(cfg);
    const view = buildArenaView(cfg, state, NOW);
    expect(view.unlocked).toBe(true);
    expect(view.opponents).toHaveLength(cfg.pvp.arena.opponentCount);
    expect(view.chests).toHaveLength(cfg.pvp.arena.chestTiers.length);
    expect(view.achievements).toHaveLength(cfg.pvp.arena.bestRankTiers.length);
    expect(view.place).toBeGreaterThan(0);
    // Every opponent fields a real squad drawn from the species catalogue.
    for (const opp of view.opponents) {
      expect(opp.count).toBe(cfg.pvp.arena.opponent.count);
      expect(opp.names).toHaveLength(opp.count);
      expect(opp.power).toBeGreaterThan(0);
    }
    // The same day + credits produces the same trio.
    expect(buildArenaView(cfg, state, NOW).opponents).toEqual(view.opponents);
  });

  it('moves credits and the place on a real battle and counts the attempt', () => {
    const cfg = config();
    const state = grownState(cfg);
    const before = state.pvp.arena;
    const outcome = challengeArena(cfg, state, NOW, 0, 1234);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const win = outcome.value.win;
    expect(outcome.value.battle.units).toHaveLength(12);
    const expected = Math.max(
      0,
      Math.min(
        cfg.pvp.arena.creditCap,
        before.credits + (win ? cfg.pvp.arena.creditsPerWin : -cfg.pvp.arena.creditsPerLoss),
      ),
    );
    expect(outcome.value.extra.creditsAfter).toBe(expected);
    expect(outcome.value.state.pvp.arena.credits).toBe(expected);
    expect(outcome.value.state.pvp.arena.attempts).toBe(before.attempts + 1);
    expect(outcome.value.state.pvp.arena.battleCount).toBe(before.battleCount + 1);
    expect(outcome.value.extra.place).toBeGreaterThan(0);
  });

  it('caps challenges at the day\'s free + bought attempts', () => {
    const cfg = config();
    const state = grownState(cfg);
    const spent: AccountState = {
      ...state,
      pvp: { ...state.pvp, arena: { ...state.pvp.arena, attempts: cfg.pvp.arena.freeAttemptsPerDay } },
    };
    const capped = challengeArena(cfg, spent, NOW, 0, 7);
    expect(capped.ok).toBe(false);
    if (!capped.ok) expect(capped.error).toBe('daily_limit');
  });

  it('buys attempts at the day\'s prices and refuses without gems', () => {
    const cfg = config();
    const state = grownState(cfg);
    const tuning = arenaTuning(cfg);
    const before = state.pvp.arena;
    const bought = buyArenaAttempts(cfg, state, NOW, 2);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    const expectedCost = tuning.attemptPrices[before.bought]! + tuning.attemptPrices[before.bought + 1]!;
    expect(bought.value.spent).toBe(expectedCost);
    expect(bought.value.state.currencies.gems).toBe(state.currencies.gems - expectedCost);
    expect(bought.value.state.pvp.arena.bought).toBe(before.bought + 2);

    const broke: AccountState = { ...state, currencies: { ...state.currencies, gems: 0 } };
    const refused = buyArenaAttempts(cfg, broke, NOW, 1);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toBe('insufficient_items');
  });

  it('refreshes the trio and keeps the day counters', () => {
    const cfg = config();
    const state = grownState(cfg);
    const first = buildArenaView(cfg, state, NOW);
    const refreshed = refreshArena(cfg, state, NOW);
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) return;
    expect(refreshed.value.pvp.arena.opponentSeed).toBe(state.pvp.arena.opponentSeed + 1);
    expect(refreshed.value.pvp.arena.credits).toBe(state.pvp.arena.credits);
    const second = buildArenaView(cfg, refreshed.value, NOW);
    expect(second.opponents).not.toEqual(first.opponents);
  });

  it('claims a reached participation chest exactly once', () => {
    const cfg = config();
    const state = grownState(cfg);
    const fought = challengeArena(cfg, state, NOW, 0, 42);
    if (!fought.ok) throw new Error('arena fight failed');
    const after = fought.value.state;
    expect(after.pvp.arena.battleCount).toBe(1);
    const first = claimArenaChest(cfg, after, NOW, 0);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.granted).toEqual(cfg.pvp.arena.chestTiers[0]!.reward);
    expect(first.value.state.currencies.gold).toBeGreaterThanOrEqual(after.currencies.gold);
    const again = claimArenaChest(cfg, first.value.state, NOW, 0);
    expect(again.ok).toBe(false);
    // A locked-out chest is refused too.
    const early = claimArenaChest(cfg, state, NOW, 9);
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.error).toBe('not_ready');
  });

  it('claims a best-rank achievement once the best place is good enough', () => {
    const cfg = config();
    const state = grownState(cfg);
    const tier = cfg.pvp.arena.bestRankTiers[0]!;
    const placed: AccountState = {
      ...state,
      pvp: { ...state.pvp, arena: { ...state.pvp.arena, bestPlace: tier.place } },
    };
    const claim = claimArenaAchievement(cfg, placed, NOW, 0);
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(claim.value.granted).toEqual(tier.reward);
    expect(claimArenaAchievement(cfg, claim.value.state, NOW, 0).ok).toBe(false);
    expect(claimArenaAchievement(cfg, state, NOW, 0).ok).toBe(false);
  });

  it('builds the ranking board with the player and ghost places', () => {
    const cfg = config();
    const state = grownState(cfg);
    const view = buildArenaRankingsView(cfg, state, NOW);
    expect(view.bands).toHaveLength(cfg.pvp.arena.bands.length);
    expect(view.bands.filter((b) => b.current)).toHaveLength(1);
    const you = view.entries.filter((e) => e.you);
    expect(you).toHaveLength(1);
    expect(you[0]!.place).toBe(view.place);
    expect(you[0]!.credits).toBe(view.credits);
    expect(view.entries.length).toBeGreaterThan(1);
    // Places ascend and every row is unique.
    const places = view.entries.map((e) => e.place);
    expect([...places].sort((a, b) => a - b)).toEqual(places);
    expect(new Set(places).size).toBe(places.length);
    // Ghost names are deterministic.
    expect(buildArenaRankingsView(cfg, state, NOW).entries).toEqual(view.entries);
  });

  it('fills a missing PvP slice when a save loads', () => {
    const cfg = config();
    const state = createInitialState(cfg);
    const withoutPvp = { ...state } as Record<string, unknown>;
    delete withoutPvp.pvp;
    const raw = { version: SAVE_VERSION, state: withoutPvp };
    const migrated = migrateSave(raw, NOW, cfg);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.pvp.arena.day).toBe(dayKey(NOW));
    expect(migrated.value.pvp.arena.weekKey).toBe(weekKey(NOW));
    expect(migrated.value.pvp.ranked.tier).toBe(0);
  });

  it('drives the Arena through the LocalServer boundary', async () => {
    const cfg = config();
    const store = new MemoryStore();
    await store.write(SAVE_KEY, serializeSave(grownState(cfg)));
    const server = new LocalServer(store, cfg);

    const view = await server.getArena();
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    expect(view.value.opponents).toHaveLength(cfg.pvp.arena.opponentCount);

    const battle = await server.challengeArena(0, 2026);
    expect(battle.ok).toBe(true);
    if (!battle.ok) return;
    expect(battle.value.attemptsLeft).toBe(cfg.pvp.arena.freeAttemptsPerDay - 1);
    expect(battle.value.snapshot.state.pvp.arena.attempts).toBe(1);

    const chest = await server.claimArenaChest(0);
    expect(chest.ok).toBe(true);

    const bought = await server.buyArenaAttempts(1);
    expect(bought.ok).toBe(true);

    const refreshed = await server.refreshArena();
    expect(refreshed.ok).toBe(true);

    const rankings = await server.getArenaRankings();
    expect(rankings.ok).toBe(true);
    if (rankings.ok) expect(rankings.value.entries.some((e) => e.you)).toBe(true);
  });
});
