/**
 * R10: a maxed, fully geared account for the geared tier re-check (owner 2026-11-04: "Auto best-by-power").
 *
 * Every Pokémon gets the stage's stars / level / skills, max plates and trinket, and for each choice layer
 * the option that gives the highest power (`powerOf`), picked greedily layer by layer:
 *   soul-hearts (one set in all sockets, red, max stars) → held item (each fitting item × main stat, its
 *   best lines at their max, max level) → orbs (each set, red +10, best % lines at a full roll, the rest of
 *   the sockets with the best single kind) → berries (the two best, max star and stage, best lines at cap)
 *   → Potential (each tier at Lv 6, the best option).
 * Account-wide layers (titles, fashion, resonance) are the same for every Pokémon and are left out.
 */
import {
  emptyLoadout,
  heldMaxLevel,
  mulberry32,
  rollBerry,
  rollOrb,
  canSocket,
  type AccountState,
  type BerryInstance,
  type CoreInstance,
  type Loadout,
  type OrbInstance,
  type RelicInstance,
  type WildInstance,
} from '@wildbound/engine';
import { createInitialState, powerOf, type GameConfig } from '@wildbound/server';

export interface Stage {
  star: number;
  level: number;
  skill: number;
}

type Species = NonNullable<ReturnType<GameConfig['species']['get']>>;

const ORB_SOCKETS = 8;

export function maxWild(s: Species, stage: Stage): WildInstance {
  return {
    id: `max-${s.id}`,
    speciesId: s.id,
    level: stage.level,
    stars: stage.star,
    xp: 0,
    ...(s.tier === 'origin'
      ? { skillLevels: { ult: stage.skill, basic: stage.skill, passive: stage.skill, talent4: stage.skill } }
      : {}),
  } as unknown as WildInstance;
}

/** Build one account holding a maxed copy of every species in `pool`. */
export function buildMaxAccount(config: GameConfig, pool: Species[], stage: Stage): { state: AccountState; wilds: Map<string, WildInstance> } {
  let state = createInitialState(config);
  state = { ...state, equipment: { relics: [], orbs: [], cores: [], berries: [], nextSeq: 1 }, loadouts: {}, potential: {} };
  const wilds = new Map<string, WildInstance>();
  for (const s of pool) {
    const wild = maxWild(s, stage);
    wilds.set(s.id, wild);
    state = gearUp(config, state, s, wild);
  }
  return { state, wilds };
}

function power(config: GameConfig, state: AccountState, wild: WildInstance): number {
  return powerOf(wild, config, state);
}

/** Try each candidate (a state transform) and keep the one with the highest power. */
function best(
  config: GameConfig,
  base: AccountState,
  wild: WildInstance,
  candidates: ((s: AccountState) => AccountState)[],
  /** Always fill the layer: on a power tie the first candidate wins instead of leaving it empty. */
  fill = true,
): AccountState {
  let top = base;
  let topPower = fill ? -Infinity : power(config, base, wild);
  for (const make of candidates) {
    const next = make(base);
    const p = power(config, next, wild);
    if (p > topPower) {
      top = next;
      topPower = p;
    }
  }
  return top;
}

function withLoadout(state: AccountState, wild: WildInstance, change: (l: Loadout) => Loadout, tuning: GameConfig['equipment']['tuning']): AccountState {
  const current = state.loadouts[wild.id] ?? emptyLoadout(tuning);
  return { ...state, loadouts: { ...state.loadouts, [wild.id]: change(current) } };
}

function gearUp(config: GameConfig, start: AccountState, s: Species, wild: WildInstance): AccountState {
  const eq = config.equipment;
  const tuning = eq.tuning;
  const rng = mulberry32(0x10a);
  const tag = s.id;
  let state: AccountState = {
    ...start,
    plates: { ...start.plates, [wild.id]: eq.plates.steps.length },
    trinkets: { ...start.trinkets, [s.id]: Math.max(0, (eq.trinkets.find((t) => t.speciesId === s.id)?.levels.length ?? 1) - 1) },
  };

  // Soul-hearts: one set across every socket, red at its star cap.
  const redStars = tuning.cores.qualityStars.red;
  state = best(
    config,
    state,
    wild,
    eq.coreSets.map((set) => (base: AccountState) => {
      const cores: CoreInstance[] = Array.from({ length: tuning.cores.sockets }, (_, socket) => ({
        id: `${tag}-core-${set.id}-${socket}`,
        setId: set.id,
        socket,
        quality: 'red',
        stars: redStars,
      }));
      return withLoadout(
        { ...base, equipment: { ...base.equipment, cores: [...base.equipment.cores, ...cores] } },
        wild,
        (l) => ({ ...l, cores: cores.map((c) => c.id) }),
        tuning,
      );
    }),
  );

  // Held item: each fitting item × main stat group; lines are the pool's best rows at their max.
  const fits = eq.relics.filter((d) => d.className === s.className);
  const level = heldMaxLevel(eq.held);
  const candidates: ((b: AccountState) => AccountState)[] = [];
  for (const def of fits) {
    const groups = [...new Set(eq.held.mainPool.filter((r) => r.pool === def.mainPool).map((r) => r.group))];
    const rows = eq.held.linePool.filter((r) => r.pool === def.linePool && (!r.faction || r.faction === s.faction));
    for (const group of groups) {
      candidates.push((base) => {
        // Rank lines by the power each adds alone, then keep the top `lineCount`.
        const scored = rows.map((row) => {
          const one: RelicInstance = { id: `${tag}-probe`, defId: def.id, level, group, lines: [{ index: row.index, value: row.max, refines: 0 }], refines: 0, pending: null, locked: false };
          const probe = withLoadout({ ...base, equipment: { ...base.equipment, relics: [...base.equipment.relics, one] } }, wild, (l) => ({ ...l, relic: one.id }), tuning);
          return { row, p: power(config, probe, wild) };
        });
        scored.sort((a, b) => b.p - a.p);
        const lines = scored.slice(0, def.lineCount).map(({ row }) => ({ index: row.index, value: row.max, refines: 0 }));
        const relic: RelicInstance = { id: `${tag}-held-${def.id}-${group}`, defId: def.id, level, group, lines, refines: 0, pending: null, locked: false };
        return withLoadout({ ...base, equipment: { ...base.equipment, relics: [...base.equipment.relics, relic] } }, wild, (l) => ({ ...l, relic: relic.id }), tuning);
      });
    }
  }
  state = best(config, state, wild, candidates);

  // Orbs: red +10 with the best % lines at a full roll.
  const orbT = eq.orbs;
  const red = orbT.colours.find((c) => c.id === 'red')!;
  const maxOrb = (kind: string, id: string): OrbInstance => {
    const kindDef = orbT.kinds.find((k) => k.id === kind)!;
    const base = rollOrb(orbT, id, kind, 'red', rng, red.cap);
    const fields = kindDef.pool.slice(0, red.pctLines);
    return { ...base, lines: fields.map((field) => ({ field, roll: orbT.rollRange[1] })) };
  };
  const socketWith = (base: AccountState, kinds: (string | null)[], setTag: string): AccountState => {
    const orbs = kinds.map((k, socket) => (k ? maxOrb(k, `${tag}-orb-${setTag}-${socket}`) : null));
    const placed = orbs.filter((o): o is OrbInstance => o !== null);
    return withLoadout(
      { ...base, equipment: { ...base.equipment, orbs: [...base.equipment.orbs, ...placed] } },
      wild,
      (l) => ({ ...l, orbs: orbs.map((o) => o?.id ?? null) }),
      tuning,
    );
  };
  // The best single kind per socket (no set), used to fill sockets a set leaves empty.
  const filler: (string | null)[] = Array.from({ length: ORB_SOCKETS }, (_, socket) => {
    let pick: string | null = null;
    let top = -1;
    for (const k of orbT.kinds) {
      const orb = maxOrb(k.id, 'probe');
      if (!canSocket(orbT, orb, socket)) continue;
      const kinds: (string | null)[] = Array.from({ length: ORB_SOCKETS }, () => null);
      kinds[socket] = k.id;
      const p = power(config, socketWith(state, kinds, 'probe'), wild);
      if (p > top) {
        top = p;
        pick = k.id;
      }
    }
    return pick;
  });
  state = best(config, state, wild, [
    (base) => socketWith(base, filler, 'fill'),
    ...orbT.sets.map((set) => (base: AccountState) => {
      const kinds: (string | null)[] = Array.from({ length: ORB_SOCKETS }, () => null);
      for (const kind of set.kinds) {
        const socket = kinds.findIndex((k, i) => k === null && canSocket(orbT, maxOrb(kind, 'probe'), i));
        if (socket < 0) return base;
        kinds[socket] = kind;
      }
      return socketWith(base, kinds.map((k, i) => k ?? filler[i] ?? null), set.id);
    }),
  ]);

  // Berries: each def at its max star and stage with the best lines at cap; keep the two best.
  const bt = eq.berries;
  const maxStage = bt.breakthrough.length;
  const maxBerry = (defId: string, id: string): BerryInstance => {
    const def = bt.berries.find((b) => b.id === defId)!;
    const b = rollBerry(bt, def, id, rng);
    const lines = [...bt.elements]
      .map((e) => ({ element: e.id, value: e.caps[maxStage] ?? e.caps[e.caps.length - 1] ?? 0 }))
      .slice(0, bt.maxLines);
    return { ...b, star: def.maxStar, stage: maxStage, lines, cultivated: true };
  };
  const slots = tuning.berries.slots;
  for (let slot = 0; slot < slots; slot += 1) {
    state = best(
      config,
      state,
      wild,
      bt.berries.map((def) => (base: AccountState) => {
        const berry = maxBerry(def.id, `${tag}-berry-${slot}-${def.id}`);
        return withLoadout(
          { ...base, equipment: { ...base.equipment, berries: [...base.equipment.berries, berry] } },
          wild,
          (l) => ({ ...l, berries: l.berries.map((b, i) => (i === slot ? berry.id : b)) }),
          tuning,
        );
      }),
    );
  }

  // Potential: each tier at Lv 6, greedily the best option.
  const tree = config.potential.species[s.id];
  if (tree) {
    for (let tier = 0; tier < tree.tiers.length; tier += 1) {
      state = best(
        config,
        state,
        wild,
        [0, 1, 2].map((option) => (base: AccountState) => {
          const current = base.potential[wild.id] ?? { picks: Array.from({ length: tree.tiers.length }, () => null), spent: { shards: 0, cores: 0, fodder: [] } };
          const picks = current.picks.map((p, i) => (i === tier ? { option, lv: 6 } : p));
          return { ...base, potential: { ...base.potential, [wild.id]: { ...current, picks } } };
        }),
      );
    }
  }
  return state;
}
