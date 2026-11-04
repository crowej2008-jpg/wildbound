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

/**
 * The owner's real builds (his wiki, pokemon-wiki-sandy.vercel.app, read 2026-11-04). A missing field
 * falls back to best-by-power. Not copied: the "Relic" slot (the source's Artifacts, deferred) and soul-heart
 * sets Wildbound lacks (Ice → the wiki's alternative Water; Steel → auto).
 */
export interface BuildOverride {
  core?: string;
  held?: { id: string; lines?: string[] };
  orbSets?: string[];
  berries?: string[];
  /** Potential option name per tier (null = auto). */
  potential?: (string | null)[];
}

const ATTACK_LINES = (f: string) => [`${f} Ult DMG↑`, `${f} Skil DMG↑`, 'Critical', 'Crit INT', 'Guard Break', 'Control Res'];
const TANK_LINES = (f: string) => [`${f} Ult DMG RED`, `${f} Skil DMG RED`, 'Crit Res', 'Block', 'Block INT', 'Control Res'];
const ATTACK_ORBS = ['dmg-down', 'combat-boost'];
const TANK_ORBS = ['boosts-damage', 'combat-res'];

/**
 * Owner 2026-11-04: "if its a def or skill class copy wobbafetts build and if its an attack mon copy god ash
 * pikas build". The held item is class-locked, so only Strikers can wear Scope Lens and only Guardians Light
 * Clay; a SKILL Pokémon keeps Wobbuffet's lines on its own class's best item. Stat lines use the Pokémon's own
 * faction. Potential picks copy by name where its tree has that option; otherwise best-by-power.
 */
export function classTemplate(s: { id: string; className: string; faction: string }): BuildOverride {
  const f = s.faction[0]!.toUpperCase() + s.faction.slice(1);
  const from = s.className === 'striker' ? WIKI_BUILDS['god-ash-pikachu']! : WIKI_BUILDS.wobbuffet!;
  const lines = s.className === 'striker' ? ATTACK_LINES(f) : TANK_LINES(f);
  const heldFits = (s.className === 'striker') === (from === WIKI_BUILDS['god-ash-pikachu']) && s.className !== 'adept';
  return { ...from, held: heldFits ? { id: from.held!.id, lines } : { id: '', lines } };
}

/** The meta six's own builds, every other Pokémon its class template. */
export function ownerBuilds(pool: { id: string; className: string; faction: string }[]): Record<string, BuildOverride> {
  return Object.fromEntries(pool.map((s) => [s.id, WIKI_BUILDS[s.id] ?? classTemplate(s)]));
}

export const WIKI_BUILDS: Record<string, BuildOverride> = {
  'god-ash-pikachu': {
    core: 'coreset-fire',
    held: { id: '105108', lines: ATTACK_LINES('Grass') },
    orbSets: ATTACK_ORBS,
    berries: ['berry-strong-dragon-fire-fruit', 'berry-spelon-berry'],
    potential: ['Victory Star', 'Valor', 'Hawk Eye', 'Infiltrator', 'Embolden', 'Rivalry', 'Joined Forces', 'Robust', 'Warm up'],
  },
  wobbuffet: {
    core: 'coreset-water',
    held: { id: '105208', lines: TANK_LINES('Grass') },
    orbSets: TANK_ORBS,
    berries: ['berry-strong-tomato-fruit', 'berry-pear-berry'],
    potential: ['Symbiosis', 'Immune', 'Regenerator', 'Numerical Strength', 'Healing Heart', 'steady', 'Iron Pokémon', 'Tough Skin', 'Thick Fat'],
  },
  greninja: {
    held: { id: '105108', lines: ATTACK_LINES('Water') },
    orbSets: ATTACK_ORBS,
    berries: ['berry-strong-dragon-fire-fruit', 'berry-strong-secret-fruit'],
    potential: ['Victory Star', 'Valor', 'Delightful', 'Infiltrator', 'Momentum', 'Rivalry', 'Joined Forces', 'Reckless', 'Warm up'],
  },
  'shiny-blastoise': {
    core: 'coreset-grass',
    held: { id: '105203' },
    orbSets: TANK_ORBS,
    berries: ['berry-strong-tomato-fruit', 'berry-pear-berry'],
    potential: ['Symbiosis', 'Sturdy', 'Regenerator', 'Wonder Guard', 'Tit for Tat', 'steady', 'Iron Pokémon', 'Tough Skin', 'Thick Fat'],
  },
  psyduck: {
    core: 'coreset-water',
    held: { id: '105308', lines: ATTACK_LINES('Water') },
    orbSets: ATTACK_ORBS,
    berries: ['berry-strong-tomato-fruit', 'berry-pear-berry'],
    potential: ['Victory Star', 'Loose Cannon', 'Fury', 'Synchronized Attack', 'Pre-war Prayer', 'Rivalry', 'Telepathy', 'Robust', 'Swift Learner'],
  },
  'origin-lugia': {
    core: 'coreset-water',
    held: { id: '105209', lines: TANK_LINES('Dark') },
    orbSets: TANK_ORBS,
    berries: ['berry-cirio-berry', 'berry-strong-tomato-fruit'],
    potential: ['Symbiosis', 'Sturdy', 'Regenerator', 'Crowd Immunity', null, null, null, null, null],
  },
};

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
export function buildMaxAccount(
  config: GameConfig,
  pool: Species[],
  stage: Stage,
  overrides: Record<string, BuildOverride> = {},
): { state: AccountState; wilds: Map<string, WildInstance> } {
  let state = createInitialState(config);
  state = { ...state, equipment: { relics: [], orbs: [], cores: [], berries: [], nextSeq: 1 }, loadouts: {}, potential: {} };
  const wilds = new Map<string, WildInstance>();
  for (const s of pool) {
    const wild = maxWild(s, stage);
    wilds.set(s.id, wild);
    state = gearUp(config, state, s, wild, overrides[s.id] ?? {});
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

function gearUp(config: GameConfig, start: AccountState, s: Species, wild: WildInstance, o: BuildOverride): AccountState {
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
    eq.coreSets.filter((set) => !o.core || set.id === o.core).map((set) => (base: AccountState) => {
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
  const fits = o.held?.id ? eq.relics.filter((d) => d.id === o.held!.id) : eq.relics.filter((d) => d.className === s.className);
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
        const named = (o.held?.lines ?? []).flatMap((name) => {
          const row = eq.held.linePool.find((r) => r.pool === def.linePool && r.name.toLowerCase() === name.toLowerCase());
          return row ? [row] : [];
        });
        const ranked = [...named, ...scored.map((x) => x.row).filter((r) => !named.includes(r))];
        const lines = ranked.slice(0, def.lineCount).map((row) => ({ index: row.index, value: row.max, refines: 0 }));
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
  // Place a list of kinds into sockets their family allows (small backtracking search).
  const place = (kinds: string[]): (string | null)[] | null => {
    const out: (string | null)[] = Array.from({ length: ORB_SOCKETS }, () => null);
    const go = (i: number): boolean => {
      if (i === kinds.length) return true;
      for (let socket = 0; socket < ORB_SOCKETS; socket += 1) {
        if (out[socket] !== null || !canSocket(orbT, maxOrb(kinds[i]!, 'probe'), socket)) continue;
        out[socket] = kinds[i]!;
        if (go(i + 1)) return true;
        out[socket] = null;
      }
      return false;
    };
    return go(0) ? out : null;
  };
  const wanted = o.orbSets ? place(o.orbSets.flatMap((id) => orbT.sets.find((set) => set.id === id)?.kinds ?? [])) : null;
  state = wanted ? socketWith(state, wanted.map((k, i) => k ?? filler[i] ?? null), 'wiki') : best(config, state, wild, [
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
      bt.berries.filter((def) => !o.berries?.[slot] || def.id === o.berries[slot]).map((def) => (base: AccountState) => {
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
  // A named pick when this tree has it, else all three options (best by power).
  const potentialChoices = (ids: number[], name: string | null | undefined): number[] => {
    const named = name
      ? [0, 1, 2].filter((option) => config.potential.options.find((opt) => opt.id === ids[option])?.name.toLowerCase() === name.toLowerCase())
      : [];
    return named.length > 0 ? named : [0, 1, 2];
  };
  if (tree) {
    for (let tier = 0; tier < tree.tiers.length; tier += 1) {
      state = best(
        config,
        state,
        wild,
        potentialChoices(tree.tiers[tier]!, o.potential?.[tier]).map((option) => (base: AccountState) => {
          const current = base.potential[wild.id] ?? { picks: Array.from({ length: tree.tiers.length }, () => null), spent: { shards: 0, cores: 0, fodder: [] } };
          const picks = current.picks.map((p, i) => (i === tier ? { option, lv: 6 } : p));
          return { ...base, potential: { ...base.potential, [wild.id]: { ...current, picks } } };
        }),
      );
    }
  }
  return state;
}
