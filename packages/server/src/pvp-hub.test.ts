import { describe, expect, it } from 'vitest';
import {
  orderStages,
  type AccountState,
  type Squad,
  type StrategyId,
} from '@wildbound/engine';
import { buildConfig } from './config';
import { LocalServer } from './local-server';
import { MemoryStore } from './storage';
import { createInitialState, migrateSave, SAVE_KEY, SAVE_VERSION, serializeSave } from './save';
import { buildPvpHubView } from './pvp-hub-view';
import { modeBattle, startBattle, stageBattle } from './battle';

/**
 * M10.5 — the PvP hub view and live squad strategies at the server boundary.
 * See docs/design/pvp.md.
 */

const NOW = Date.UTC(2026, 9, 17, 12, 0, 0);

function config() {
  return { ...buildConfig(), now: () => NOW };
}

function clearChapter(state: AccountState, cfg: ReturnType<typeof config>, chapter: number): AccountState {
  const stages = orderStages(cfg.stages).filter((s) => s.chapter === chapter);
  const last = stages[stages.length - 1];
  if (!last) return state;
  return { ...state, campaign: { stars: { ...state.campaign.stars, [last.id]: 3 } } };
}

/** A fixture with both ladder chapters clear and a fully grown six. */
function grownState(cfg: ReturnType<typeof config>, strategy?: StrategyId): AccountState {
  const base = createInitialState(cfg);
  const roster = base.roster.map((w) => ({ ...w, level: 140, stars: 10 }));
  const ids: Squad = roster.map((w) => w.id);
  const opened = clearChapter(clearChapter(base, cfg, cfg.pvp.arenaChapter), cfg, cfg.pvp.rankedChapter);
  return {
    ...opened,
    roster,
    squads: { ...opened.squads, campaign: ids, arenaAttack: ids, arenaDefence: ids },
    ...(strategy ? { strategies: { ...opened.strategies, arenaAttack: strategy, campaign: strategy } } : {}),
  };
}

/**
 * A sparring wall: one very tough, low-threat enemy (20★ at level 80) that a grown
 * squad cannot one-shot but who barely scratches it — so the fight runs several
 * rounds and every action policy actually gets a turn.
 */
function wallEnemies(cfg: ReturnType<typeof config>) {
  const speciesId = [...cfg.species.keys()][0]!;
  return [{ speciesId, level: 80, stars: 20, stage: 2 }];
}

describe('PvP hub (M10.5)', () => {
  it('lists every entry point, with the pending modes honestly unrouted', () => {
    const cfg = config();
    const view = buildPvpHubView(cfg, createInitialState(cfg), NOW);
    expect(view.cards.map((c) => c.id)).toEqual(['arena', 'ranked', 'clash', 'championship', 'temple', 'shop']);

    const arena = view.cards.find((c) => c.id === 'arena')!;
    expect(arena.live).toBe(true);
    expect(arena.route).toBe('/arena');
    expect(arena.unlocked).toBe(false);
    expect(arena.status).toEqual({ kind: 'locked', chapter: cfg.pvp.arenaChapter });

    const ranked = view.cards.find((c) => c.id === 'ranked')!;
    expect(ranked.status).toEqual({ kind: 'locked', chapter: cfg.pvp.rankedChapter });

    for (const id of ['clash', 'championship', 'temple'] as const) {
      const card = view.cards.find((c) => c.id === id)!;
      expect(card.live).toBe(false);
      expect(card.route).toBeNull();
      expect(card.status).toEqual({ kind: 'comingLater' });
    }

    const shop = view.cards.find((c) => c.id === 'shop')!;
    expect(shop.route).toBe('/shop');
    expect(shop.status).toEqual({ kind: 'shop', tokens: 0 });
  });

  it('shows the live Arena and Ranked status once their chapters are clear', () => {
    const cfg = config();
    const view = buildPvpHubView(cfg, grownState(cfg), NOW);
    const arena = view.cards.find((c) => c.id === 'arena')!;
    expect(arena.unlocked).toBe(true);
    expect(arena.status).toMatchObject({
      kind: 'arena',
      credits: 0,
      place: cfg.pvp.arena.bands[0]!.startPlace,
      attemptsLeft: cfg.pvp.arena.freeAttemptsPerDay,
      attemptsPerDay: cfg.pvp.arena.freeAttemptsPerDay,
    });

    const ranked = view.cards.find((c) => c.id === 'ranked')!;
    expect(ranked.unlocked).toBe(true);
    expect(ranked.status).toMatchObject({
      kind: 'ranked',
      region: cfg.pvp.ranked.phases[0]!.name,
      tier: cfg.pvp.ranked.tiers[0]!.name,
      score: 0,
      attemptsLeft: cfg.pvp.ranked.freeAttemptsPerDay,
    });
  });

  it('serves the hub through the LocalServer boundary', async () => {
    const cfg = config();
    const store = new MemoryStore();
    await store.write(SAVE_KEY, serializeSave(grownState(cfg)));
    const server = new LocalServer(store, cfg);
    const hub = await server.getPvpHub();
    expect(hub.ok).toBe(true);
    if (!hub.ok) return;
    expect(hub.value.cards).toHaveLength(6);
    expect(hub.value.cards.filter((c) => c.live)).toHaveLength(3);
  });

  it('fills the hub for a save missing its PvP slice', () => {
    const cfg = config();
    const base = createInitialState(cfg);
    const withoutPvp = { ...base } as Record<string, unknown>;
    delete withoutPvp.pvp;
    const migrated = migrateSave({ version: SAVE_VERSION, state: withoutPvp }, NOW, cfg);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(buildPvpHubView(cfg, migrated.value, NOW).cards).toHaveLength(6);
  });
});

describe('live squad strategies (M10.5)', () => {
  it('fights a campaign stage with the campaign squad strategy', () => {
    const cfg = config();
    const aggressive = grownState(cfg, 'aggressive');
    const balanced = grownState(cfg, 'balanced');
    const enemies = wallEnemies(cfg);
    const first = stageBattle(cfg, aggressive, enemies, 'wall', 99)!;
    const second = stageBattle(cfg, balanced, enemies, 'wall', 99)!;
    expect(first.strategies).toEqual({ attackers: 'aggressive', defenders: 'balanced' });
    expect(second.strategies).toEqual({ attackers: 'balanced', defenders: 'balanced' });
    expect(first.rounds).toBeGreaterThan(1);
    // Same seed, same squads, different policy: the logs must differ.
    expect(JSON.stringify(first.events)).not.toBe(JSON.stringify(second.events));
  });

  it('reports the strategy both sides fight with on the M4 echo (same squad)', () => {
    const cfg = config();
    const view = startBattle(cfg, grownState(cfg, 'defensive'), 'campaign', 5)!;
    expect(view.strategies).toEqual({ attackers: 'defensive', defenders: 'defensive' });
  });

  it('uses the squad mode\'s strategy in a mode battle, and a passed defender strategy', () => {
    const cfg = config();
    const state = grownState(cfg, 'aggressive');
    const enemies = wallEnemies(cfg);
    const plain = modeBattle(cfg, state, {
      squadMode: 'arenaAttack',
      label: 'arenaFight',
      enemies,
      battleId: 'test:arena',
      seed: 11,
    })!;
    expect(plain.strategies).toEqual({ attackers: 'aggressive', defenders: 'balanced' });

    const defended = modeBattle(cfg, state, {
      squadMode: 'arenaAttack',
      label: 'arenaFight',
      enemies,
      battleId: 'test:arena',
      seed: 11,
      defenderStrategy: 'defensive',
    })!;
    expect(defended.strategies).toEqual({ attackers: 'aggressive', defenders: 'defensive' });
    // The defender's own policy reaches the field: the untouched wall banks its
    // ultimate while a balanced wall spends it as soon as the bar is full.
    expect(JSON.stringify(defended.events)).not.toBe(JSON.stringify(plain.events));
  });

  it('saves the Arena defence lineup and its strategy', async () => {
    const cfg = config();
    const store = new MemoryStore();
    const state = grownState(cfg);
    await store.write(SAVE_KEY, serializeSave(state));
    const server = new LocalServer(store, cfg);

    const lineup: Squad = [...state.roster.slice(0, 3).map((w) => w.id), null, null, null];
    const saved = await server.setArenaDefence(lineup, 'balanced');
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.state.strategies.arenaDefence).toBe('balanced');
    expect(saved.value.state.squads.arenaDefence.slice(0, 3)).toEqual(lineup.slice(0, 3));

    const arena = await server.getArena();
    expect(arena.ok).toBe(true);
    if (arena.ok) expect(arena.value.defence.count).toBe(3);
  });
});
