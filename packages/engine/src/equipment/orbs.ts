import type { DamageMod } from '../combat/types';
import type { Rng } from '../rng';
import type { CoreStats, PercentLines, WildClass } from '../model';
import type { StatDelta } from './types';

/**
 * R3 Orbs (kb/orbs.md + the owner's wiki; scripts/gen-orbs.mjs). 12 kinds in two families, 5 colours.
 * Each orb has fixed flat lines (green–purple 1, orange/red 2) and % lines rolled from its kind's
 * three (green–purple 1, orange/red 2). A Pokémon has 8 sockets (2 rows × 4 gear pieces) with family
 * rules. Sets need all their kinds; tiers turn on at the set's lowest orb level (3 / 5 / 7 / 10).
 */
export type OrbFamily = 'defensive' | 'offensive';
export type OrbColour = 'green' | 'blue' | 'purple' | 'orange' | 'red';

export interface OrbKindDef {
  id: string;
  name: string;
  family: OrbFamily;
  twin: string;
  /** Fixed lines in order (the second only on orange / red). */
  flat: ('hp' | 'pAtk' | 'sAtk')[];
  /** The three % lines an orb of this kind can roll. */
  pool: string[];
}

export interface OrbColourDef {
  id: OrbColour;
  quality: number;
  cap: number;
  flatLines: number;
  pctLines: number;
  /** Share of the red flat values (stand-in for every colour but red). */
  flatFactor: number;
}

/** A set tier line: a % stat, `orbAtk` / `orbHp` (scale the orbs' own flats), or `dmgVs` / `rdctVs`. */
export interface OrbSetLine {
  field: string;
  value: number;
  vs?: WildClass;
}

export interface OrbSetDef {
  id: string;
  name: string;
  family: OrbFamily;
  kinds: string[];
  tiers: { level: number; lines: OrbSetLine[] }[];
}

export interface OrbTables {
  kinds: OrbKindDef[];
  colours: OrbColourDef[];
  flat: { atk: number[]; hp: number[] };
  lineCeiling: Record<string, number>;
  rollRange: [number, number];
  levelGold: number[];
  copiesPerLevel: number;
  /** Per gear piece: [row 1 family, row 2 family]. */
  sockets: ('any' | OrbFamily)[][];
  unlock: { playerLevel: number; stars: number; secondRow: { stars: number; level: number } };
  dismantle: Partial<Record<OrbColour, number[]>>;
  sets: OrbSetDef[];
}

export interface OrbLine {
  field: string;
  /** Where the roll landed between the range's ends, as a share of the ceiling. */
  roll: number;
}

export interface OrbInstance {
  id: string;
  kind: string;
  colour: OrbColour;
  level: number;
  lines: OrbLine[];
  locked?: boolean;
}

export const ORB_SOCKETS = 8;

export function orbKind(t: OrbTables, id: string): OrbKindDef | undefined {
  return t.kinds.find((k) => k.id === id);
}

export function orbColour(t: OrbTables, id: OrbColour): OrbColourDef | undefined {
  return t.colours.find((c) => c.id === id);
}

/** A fresh orb: its % lines are drawn once, for good. */
export function rollOrb(t: OrbTables, id: string, kind: string, colour: OrbColour, rng: Rng, level = 1): OrbInstance {
  const k = orbKind(t, kind);
  const c = orbColour(t, colour);
  if (!k || !c) throw new Error(`unknown orb ${kind}/${colour}`);
  const pool = [...k.pool];
  const lines: OrbLine[] = [];
  for (let i = 0; i < c.pctLines && pool.length > 0; i += 1) {
    const field = pool.splice(Math.floor(rng() * pool.length), 1)[0]!;
    const [lo, hi] = t.rollRange;
    lines.push({ field, roll: Math.round((lo + (hi - lo) * rng()) * 1000) / 1000 });
  }
  return { id, kind, colour, level: Math.max(1, Math.min(level, c.cap)), lines };
}

/** The orb's fixed lines at its level. */
export function orbFlat(t: OrbTables, orb: OrbInstance): Partial<Record<'hp' | 'pAtk' | 'sAtk', number>> {
  const k = orbKind(t, orb.kind);
  const c = orbColour(t, orb.colour);
  const out: Partial<Record<'hp' | 'pAtk' | 'sAtk', number>> = {};
  if (!k || !c) return out;
  for (const field of k.flat.slice(0, c.flatLines)) {
    const table = field === 'hp' ? t.flat.hp : t.flat.atk;
    const v = Math.round((table[orb.level - 1] ?? 0) * c.flatFactor);
    out[field] = (out[field] ?? 0) + v;
  }
  return out;
}

/** One % line's value at the orb's level. */
export function orbLineValue(t: OrbTables, line: OrbLine, level: number): number {
  return Math.round(line.roll * (t.lineCeiling[line.field] ?? 0) * level * 1e6) / 1e6;
}

/** The family a socket takes (sockets 0–3 = row 1 on pieces 1–4, 4–7 = row 2). */
export function socketFamily(t: OrbTables, socket: number): 'any' | OrbFamily {
  const piece = socket % 4;
  const row = socket < 4 ? 0 : 1;
  return t.sockets[piece]?.[row] ?? 'any';
}

export function canSocket(t: OrbTables, orb: OrbInstance, socket: number): boolean {
  if (socket < 0 || socket >= ORB_SOCKETS) return false;
  const fam = socketFamily(t, socket);
  return fam === 'any' || orbKind(t, orb.kind)?.family === fam;
}

/** Whether a socket is open for a Pokémon (row 2 also needs Lv 240; Origins skip it). */
export function socketOpen(t: OrbTables, socket: number, stars: number, level: number, origin: boolean): boolean {
  if (stars < t.unlock.stars) return false;
  if (socket < 4) return true;
  return origin || (stars >= t.unlock.secondRow.stars && level >= t.unlock.secondRow.level);
}

/** Gold for one level up from `level` (null at the colour's cap). */
export function orbLevelGold(t: OrbTables, orb: OrbInstance): number | null {
  const cap = orbColour(t, orb.colour)?.cap ?? 0;
  if (orb.level >= cap) return null;
  return t.levelGold[orb.level - 1] ?? null;
}

/** Orb Essence for dismantling (null: red, which has no row). */
export function orbDismantleEssence(t: OrbTables, orb: OrbInstance): number | null {
  return t.dismantle[orb.colour]?.[orb.level - 1] ?? null;
}

export interface ActiveOrbSet {
  set: OrbSetDef;
  /** The lowest orb level in the set. */
  level: number;
  orbIds: string[];
}

/**
 * Which sets the socketed orbs make. An orb counts toward one set; a set needs one orb of each of its
 * kinds (duplicates don't count). Bigger sets are taken first, then the one whose orbs are highest
 * (its lowest orb level), then table order; each set uses the highest orb of each kind.
 */
export function activeOrbSets(t: OrbTables, orbs: OrbInstance[]): ActiveOrbSet[] {
  const free = [...orbs];
  const out: ActiveOrbSet[] = [];
  for (;;) {
    let best: ActiveOrbSet | null = null;
    for (const set of t.sets) {
      const picked: OrbInstance[] = [];
      for (const kind of set.kinds) {
        const cand = free.filter((o) => o.kind === kind).sort((a, b) => b.level - a.level)[0];
        if (!cand) break;
        picked.push(cand);
      }
      if (picked.length !== set.kinds.length) continue;
      const level = Math.min(...picked.map((o) => o.level));
      if (
        !best ||
        set.kinds.length > best.set.kinds.length ||
        (set.kinds.length === best.set.kinds.length && level > best.level)
      ) {
        best = { set, level, orbIds: picked.map((o) => o.id) };
      }
    }
    if (!best) return out;
    out.push(best);
    for (const id of best.orbIds) free.splice(free.findIndex((o) => o.id === id), 1);
  }
}

export interface FoldedOrbs {
  delta: StatDelta;
  damageMods: DamageMod[];
  sets: ActiveOrbSet[];
}

/** Fold socketed orbs and their sets into a stat delta plus class damage modifiers. */
export function foldOrbs(t: OrbTables, orbs: OrbInstance[]): FoldedOrbs {
  const delta: StatDelta = { core: {}, percent: {}, soul: {} };
  const damageMods: DamageMod[] = [];
  const own = { hp: 0, atk: { pAtk: 0, sAtk: 0 } };
  const addPct = (field: string, v: number) => {
    const f = field as keyof PercentLines;
    delta.percent[f] = ((delta.percent[f] as number | undefined) ?? 0) + v;
  };
  for (const orb of orbs) {
    const flat = orbFlat(t, orb);
    own.hp += flat.hp ?? 0;
    own.atk.pAtk += flat.pAtk ?? 0;
    own.atk.sAtk += flat.sAtk ?? 0;
    for (const line of orb.lines) addPct(line.field, orbLineValue(t, line, orb.level));
  }
  let orbHpPct = 0;
  let orbAtkPct = 0;
  const sets = activeOrbSets(t, orbs);
  for (const { set, level } of sets) {
    for (const tier of set.tiers) {
      if (tier.level > level) continue;
      for (const line of tier.lines) {
        if (line.field === 'orbHp') orbHpPct += line.value;
        else if (line.field === 'orbAtk') orbAtkPct += line.value;
        else if ((line.field === 'dmgVs' || line.field === 'rdctVs') && line.vs) {
          damageMods.push({
            tag: `orbset-${set.id}`,
            role: line.field === 'dmgVs' ? 'attack' : 'defend',
            dmg: line.value,
            condition: { targetClass: line.vs },
          });
        } else addPct(line.field, line.value);
      }
    }
  }
  const core = delta.core as Partial<CoreStats>;
  const hp = Math.round(own.hp * (1 + orbHpPct));
  const pAtk = Math.round(own.atk.pAtk * (1 + orbAtkPct));
  const sAtk = Math.round(own.atk.sAtk * (1 + orbAtkPct));
  if (hp) core.hp = hp;
  if (pAtk) core.pAtk = pAtk;
  if (sAtk) core.sAtk = sAtk;
  return { delta, damageMods, sets };
}
