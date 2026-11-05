import type { Rewards } from '../economy/rewards';

/**
 * Pokémon Paradise (M14.3, the source's poke_catching). Three rotating 14-day Parks. Exploring costs stamina and lands
 * on one Dex entry at one step (Trace → Footprint → Drop item → Pokémon); tracking moves on a step (it can fail and end
 * the route); at the Pokémon step a ball is thrown (it flees on a miss). Each step logged is a Dex entry worth stars;
 * stars pay milestones. Gear (Energy Drink, Small Radar, Sports Gloves) levels with Exploration EXP. Pure: the tuning,
 * the clock and the rng are arguments. See docs/design/paradise.md.
 */

export interface ParadiseDexEntry {
  id: number;
  species: string;
  star: number;
  catchRate: number;
  /** Stars for logging each step (Trace, Footprint, Drop item, Pokémon). */
  stars: number[];
  /** Paradise Points for logging each step the first time. */
  points: number[];
  /** Weights of landing on each step when exploring. */
  stepWeights: number[];
  pool: number;
  poolWeight: number;
  scene: number;
  fleeShards: Record<string, number>;
}

export interface ParadiseGearLevel {
  level: number;
  exp: number;
  maxStamina?: number;
  freeExplore?: number;
  track?: number;
  findNew?: number;
  ballBoost?: number;
  freeBall?: number;
}

export interface ParadiseRules {
  seasonDays: number;
  baseStamina: number;
  baseTrack: number;
  exploreExp: number;
  repeatCatchPoints: number;
  advancedBallBoost: number;
  gear: { type: number; name: string; levels: ParadiseGearLevel[] }[];
  seasons: {
    season: number;
    scenes: { scene: number; name: string; gearLevel: number }[];
    dex: ParadiseDexEntry[];
    starRewards: { stars: number; rewards: Rewards; evolveBoxes?: string[] }[];
    shop: { id: number; rewards: Rewards; evolveBoxes?: string[]; points?: number; exp?: number; limit: number; gearLevel: number }[];
  }[];
}

export type ParadiseBall = 'poke' | 'advanced' | 'master';

export interface ParadiseEncounter {
  entry: number;
  /** 0 Trace, 1 Footprint, 2 Drop item, 3 Pokémon. */
  step: number;
}

export interface ParadiseState {
  /** The Park (cycle number since the epoch). */
  cycle: number;
  /** Gear levels by type (1 Energy Drink, 2 Small Radar, 3 Sports Gloves). */
  gear: Record<string, number>;
  /** Exploration EXP (this Park). */
  exp: number;
  /** Paradise Points (this Park). */
  points: number;
  stamina: number;
  /** UTC day-key stamina was last refilled. */
  day: string;
  /** Logged steps: `${entry}:${step}`. */
  logged: string[];
  encounter: ParadiseEncounter | null;
  /** Star milestones and shop buys claimed this Park. */
  claimed: string[];
  bought: Record<string, number>;
}

const DAY_MS = 86_400_000;

export function paradiseCycle(rules: ParadiseRules, now: number): number {
  return Math.floor(now / (rules.seasonDays * DAY_MS));
}

export function paradiseSeason(rules: ParadiseRules, cycle: number) {
  return rules.seasons[cycle % rules.seasons.length]!;
}

export function paradiseEndsIn(rules: ParadiseRules, now: number): number {
  const len = rules.seasonDays * DAY_MS;
  return len - (now % len);
}

function gearRow(rules: ParadiseRules, state: ParadiseState, type: number): ParadiseGearLevel | undefined {
  const lv = state.gear[String(type)] ?? 0;
  return rules.gear.find((g) => g.type === type)?.levels.find((l) => l.level === lv);
}

export function maxStamina(rules: ParadiseRules, state: ParadiseState): number {
  return gearRow(rules, state, 1)?.maxStamina ?? rules.baseStamina;
}

export function trackChance(rules: ParadiseRules, state: ParadiseState): number {
  return gearRow(rules, state, 2)?.track ?? rules.baseTrack;
}

/** The lowest gear level (scenes open on all gear reaching a level). */
export function gearFloor(state: ParadiseState): number {
  return Math.min(state.gear['1'] ?? 0, state.gear['2'] ?? 0, state.gear['3'] ?? 0);
}

export function initialParadise(rules: ParadiseRules, now: number, day: string): ParadiseState {
  return {
    cycle: paradiseCycle(rules, now),
    gear: { 1: 0, 2: 0, 3: 0 },
    exp: 0,
    points: 0,
    stamina: rules.baseStamina,
    day,
    logged: [],
    encounter: null,
    claimed: [],
    bought: {},
  };
}

/** A new Park resets everything in the state; a new day refills stamina. */
export function rollParadise(rules: ParadiseRules, state: ParadiseState, now: number, day: string): ParadiseState {
  if (paradiseCycle(rules, now) !== state.cycle) return initialParadise(rules, now, day);
  if (state.day !== day) return { ...state, day, stamina: maxStamina(rules, state) };
  return state;
}

export function dexStars(rules: ParadiseRules, state: ParadiseState): number {
  const season = paradiseSeason(rules, state.cycle);
  let total = 0;
  for (const key of state.logged) {
    const [id, step] = key.split(':').map(Number);
    const e = season.dex.find((d) => d.id === id);
    if (e) total += e.stars[step!] ?? 0;
  }
  return total;
}

function pick<T>(rng: () => number, rows: readonly T[], weight: (t: T) => number): T {
  const total = rows.reduce((s, r) => s + weight(r), 0);
  let x = rng() * total;
  for (const r of rows) if ((x -= weight(r)) < 0) return r;
  return rows[rows.length - 1]!;
}

/** Log a step; returns the points for a first log (0 if already logged). */
function log(state: ParadiseState, entry: ParadiseDexEntry, step: number): { state: ParadiseState; points: number } {
  const key = `${entry.id}:${step}`;
  if (state.logged.includes(key)) return { state, points: 0 };
  const points = entry.points[step] ?? 0;
  return { state: { ...state, logged: [...state.logged, key], points: state.points + points }, points };
}

export type ParadiseError = 'no_stamina' | 'busy' | 'no_encounter' | 'not_pokemon' | 'at_pokemon';

/** Explore: spend stamina (maybe free), gain EXP, land on an entry and a step. */
export function explore(rules: ParadiseRules, state: ParadiseState, rng: () => number): { ok: true; state: ParadiseState } | { ok: false; error: ParadiseError } {
  if (state.encounter) return { ok: false, error: 'busy' };
  if (state.stamina < 1) return { ok: false, error: 'no_stamina' };
  const season = paradiseSeason(rules, state.cycle);
  const floor = gearFloor(state);
  const open = new Set(season.scenes.filter((s) => s.gearLevel <= floor).map((s) => s.scene));
  const eligible = season.dex.filter((d) => open.has(d.scene));
  const pools = [...new Set(eligible.map((d) => d.pool))].map((p) => ({ p, w: eligible.find((d) => d.pool === p)!.poolWeight }));
  const pool = pick(rng, pools, (x) => x.w).p;
  let candidates = eligible.filter((d) => d.pool === pool);
  const findNew = gearRow(rules, state, 2)?.findNew ?? 0;
  const fresh = eligible.filter((d) => !state.logged.some((k) => k.startsWith(`${d.id}:`)));
  if (fresh.length > 0 && rng() < findNew) candidates = fresh;
  const entry = candidates[Math.floor(rng() * candidates.length)]!;
  const step = pick(rng, [0, 1, 2, 3], (i) => entry.stepWeights[i] ?? 0);
  const free = rng() < (gearRow(rules, state, 1)?.freeExplore ?? 0);
  let next: ParadiseState = { ...state, stamina: state.stamina - (free ? 0 : 1), exp: state.exp + rules.exploreExp, encounter: { entry: entry.id, step } };
  // The Pokémon step is logged only by catching it.
  if (step < 3) next = log(next, entry, step).state;
  return { ok: true, state: next };
}

/** Track one step on (a Scanner makes it sure). A miss ends the route. */
export function track(rules: ParadiseRules, state: ParadiseState, rng: () => number, scanner = false): { ok: true; state: ParadiseState; success: boolean } | { ok: false; error: ParadiseError } {
  const enc = state.encounter;
  if (!enc) return { ok: false, error: 'no_encounter' };
  if (enc.step >= 3) return { ok: false, error: 'at_pokemon' };
  const entry = paradiseSeason(rules, state.cycle).dex.find((d) => d.id === enc.entry)!;
  const success = scanner || rng() < trackChance(rules, state);
  if (!success) return { ok: true, state: { ...state, encounter: null }, success };
  const moved = { ...state, encounter: { entry: enc.entry, step: enc.step + 1 } };
  return { ok: true, state: enc.step + 1 < 3 ? log(moved, entry, enc.step + 1).state : moved, success };
}

/** The chance a ball catches the current Pokémon. */
export function catchChance(rules: ParadiseRules, state: ParadiseState, entry: ParadiseDexEntry, ball: ParadiseBall): number {
  if (ball === 'master') return 1;
  const gloves = 1 + (gearRow(rules, state, 3)?.ballBoost ?? 0);
  const adv = ball === 'advanced' ? 1 + rules.advancedBallBoost : 1;
  return Math.min(1, entry.catchRate * gloves * adv);
}

export interface ThrowResult {
  state: ParadiseState;
  caught: boolean;
  entry: ParadiseDexEntry;
  /** Points earned (first catch: the entry's; repeat: the repeat amount). */
  points: number;
  /** Was the ball kept (Sports Gloves' free-ball chance)? */
  ballKept: boolean;
}

export function throwBall(rules: ParadiseRules, state: ParadiseState, rng: () => number, ball: ParadiseBall): { ok: true; value: ThrowResult } | { ok: false; error: ParadiseError } {
  const enc = state.encounter;
  if (!enc) return { ok: false, error: 'no_encounter' };
  if (enc.step < 3) return { ok: false, error: 'not_pokemon' };
  const entry = paradiseSeason(rules, state.cycle).dex.find((d) => d.id === enc.entry)!;
  const caught = rng() < catchChance(rules, state, entry, ball);
  const ballKept = ball === 'advanced' && rng() < (gearRow(rules, state, 3)?.freeBall ?? 0);
  let next: ParadiseState = { ...state, encounter: null };
  let points = 0;
  if (caught) {
    const first = log(next, entry, 3);
    points = first.points > 0 ? first.points : rules.repeatCatchPoints;
    next = { ...first.state, points: first.state.points + (first.points > 0 ? 0 : points) };
  }
  return { ok: true, value: { state: next, caught, entry, points, ballKept } };
}

/** Level a gear piece with Exploration EXP. */
export function upgradeGear(rules: ParadiseRules, state: ParadiseState, type: number): { ok: true; state: ParadiseState } | { ok: false; error: string } {
  const g = rules.gear.find((x) => x.type === type);
  if (!g) return { ok: false, error: 'no such gear' };
  const lv = state.gear[String(type)] ?? 0;
  const row = g.levels.find((l) => l.level === lv + 1);
  if (!row) return { ok: false, error: 'already at the top level' };
  if (state.exp < row.exp) return { ok: false, error: `needs ${row.exp} Exploration EXP` };
  return { ok: true, state: { ...state, exp: state.exp - row.exp, gear: { ...state.gear, [String(type)]: lv + 1 } } };
}
