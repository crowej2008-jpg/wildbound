import type { Rewards } from '../economy/rewards';
import type { BerryGroveRules, BerryGroveState, GroveBand, GroveError, GroveSeedRule, SeedTier } from './types';

export * from './types';

/** Berry Grove rules (M13.8). Pure: the tuning and the clock are arguments. */

const HOUR_MS = 3_600_000;

export function initialBerryGrove(rules: BerryGroveRules, day: string): BerryGroveState {
  return {
    plots: Array.from({ length: rules.plots }, () => ({ seed: null, plantedAt: 0 })),
    stage: 0,
    climbsToday: 0,
    bossFights: 0,
    bossBest: 0,
    day,
  };
}

/** Daily reset of the fight counters; the garden and the stage stay. */
export function rollBerryGrove(state: BerryGroveState, day: string): BerryGroveState {
  return state.day === day ? state : { ...state, day, climbsToday: 0, bossFights: 0, bossBest: 0 };
}

export function seedRule(rules: BerryGroveRules, tier: SeedTier): GroveSeedRule | undefined {
  return rules.seeds.find((s) => s.tier === tier);
}

/** When a plot's seed is ripe (null when the plot is empty). */
export function ripeAt(rules: BerryGroveRules, state: BerryGroveState, plot: number): number | null {
  const p = state.plots[plot];
  if (!p?.seed) return null;
  const rule = seedRule(rules, p.seed);
  return rule ? p.plantedAt + rule.growHours * HOUR_MS : null;
}

export function plantSeed(
  rules: BerryGroveRules,
  state: BerryGroveState,
  plot: number,
  tier: SeedTier,
  now: number,
): { ok: true; state: BerryGroveState } | { ok: false; error: GroveError } {
  const p = state.plots[plot];
  if (!p) return { ok: false, error: 'no_plot' };
  if (p.seed) return { ok: false, error: 'plot_busy' };
  if (!seedRule(rules, tier)) return { ok: false, error: 'bad_seed' };
  const plots = state.plots.map((x, i) => (i === plot ? { seed: tier, plantedAt: now } : x));
  return { ok: true, state: { ...state, plots } };
}

/** Empty a ripe plot; returns the tier that grew. */
export function harvestPlot(
  rules: BerryGroveRules,
  state: BerryGroveState,
  plot: number,
  now: number,
): { ok: true; state: BerryGroveState; tier: SeedTier } | { ok: false; error: GroveError } {
  const p = state.plots[plot];
  if (!p) return { ok: false, error: 'no_plot' };
  if (!p.seed) return { ok: false, error: 'plot_empty' };
  const at = ripeAt(rules, state, plot);
  if (at === null || now < at) return { ok: false, error: 'not_ripe' };
  const plots = state.plots.map((x, i) => (i === plot ? { seed: null, plantedAt: 0 } : x));
  return { ok: true, state: { ...state, plots }, tier: p.seed };
}

function band(bands: readonly GroveBand[], stage: number): GroveBand | undefined {
  return bands.find((b) => stage <= b.upTo) ?? bands[bands.length - 1];
}

export function guardianBlock(rules: BerryGroveRules, state: BerryGroveState): 'top' | 'daily_limit' | null {
  if (state.stage >= rules.guardians.stages) return 'top';
  if (state.climbsToday >= rules.guardians.climbsPerDay) return 'daily_limit';
  return null;
}

/** A Guardian stage's first-clear pay: its band, plus the tenth-stage extra. */
export function guardianReward(rules: BerryGroveRules, stage: number): Rewards {
  const out: Rewards = { ...(band(rules.guardians.bands, stage)?.rewards ?? {}) };
  if (stage % 10 === 0) {
    for (const [k, v] of Object.entries(rules.guardians.everyTen) as [keyof Rewards, number][]) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

export function clearGuardian(state: BerryGroveState): BerryGroveState {
  return { ...state, stage: state.stage + 1, climbsToday: state.climbsToday + 1 };
}

export function bossFightsLeft(rules: BerryGroveRules, state: BerryGroveState): number {
  return Math.max(0, rules.boss.fightsPerDay - state.bossFights);
}

/** A Grove Boss fight's pay: the band's full pay × the share of the boss's HP taken (at least `minShare`). */
export function bossReward(rules: BerryGroveRules, stage: number, share: number): Rewards {
  const k = Math.min(1, Math.max(rules.boss.minShare, share));
  const out: Rewards = {};
  for (const [key, v] of Object.entries(band(rules.boss.bands, Math.max(1, stage))?.rewards ?? {}) as [keyof Rewards, number][]) {
    const n = Math.max(1, Math.round(v * k));
    out[key] = n;
  }
  return out;
}

export function recordBossFight(state: BerryGroveState, share: number): BerryGroveState {
  return { ...state, bossFights: state.bossFights + 1, bossBest: Math.max(state.bossBest, Math.min(1, share)) };
}

export function groveBoss(rules: BerryGroveRules, weekday: number): string {
  return rules.boss.rotation[weekday % rules.boss.rotation.length]!;
}
