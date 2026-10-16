import { tierRank, isAtLeast, TIER_ORDER } from './types';
import type {
  DrawResult,
  GachaMachineDef,
  GachaMachineState,
  GachaPoolEntry,
  GachaTierWeight,
} from './types';
import type { Tier } from '../model';
import type { Rng } from '../rng';

/**
 * Summoning rules (M6, PROMPT §7.5). Pure and content-free: every function takes
 * the pool, the machine's tuning and an injected `Rng`, and returns a new value.
 * See docs/design/gacha.md.
 */

/** Box + pity credit counters, threaded through a batch of draws. */
export interface CreditCounters {
  box: number;
  pity: number;
}

/** A weighted pick over a list of positive weights (falls back to the last entry). */
export function weightedIndex(rng: Rng, weights: readonly number[]): number {
  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (total <= 0) return weights.length - 1;
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= Math.max(0, weights[i] ?? 0);
    if (roll < 0) return i;
  }
  return weights.length - 1;
}

/** Roll a tier by weight, optionally restricted to a set of tiers. */
export function rollTier(rng: Rng, rates: readonly GachaTierWeight[], allowed?: readonly Tier[]): Tier {
  const rows = allowed ? rates.filter((r) => allowed.includes(r.tier)) : rates;
  const usable = rows.length > 0 ? rows : rates;
  const index = weightedIndex(
    rng,
    usable.map((r) => r.weight),
  );
  return usable[index]?.tier ?? 'common';
}

/** Tiers at or above a floor, cheapest first. */
export function tiersAtLeast(floor: Tier): Tier[] {
  return TIER_ORDER.filter((t) => isAtLeast(t, floor));
}

/**
 * Pick a species inside `tier`. Every species is equally likely except the wished
 * one, whose weight is multiplied by `wishBoost` (a wish only applies in its tier).
 */
export function pickSpecies(
  rng: Rng,
  pool: readonly GachaPoolEntry[],
  tier: Tier,
  wish: string | null,
  wishBoost: number,
): string {
  const inTier = pool.filter((p) => p.tier === tier);
  if (inTier.length === 0) return pool[0]?.speciesId ?? '';
  const applied = wish !== null && inTier.some((p) => p.speciesId === wish) ? wishBoost : 1;
  const index = weightedIndex(
    rng,
    inTier.map((p) => (p.speciesId === wish ? applied : 1)),
  );
  return inTier[index]?.speciesId ?? inTier[0]!.speciesId;
}

/**
 * One draw: apply pity, roll a tier, pick a species, and return the new credit
 * counters. `isNew` is left false — the caller fills it against the roster.
 */
export function drawWild(
  rng: Rng,
  pool: readonly GachaPoolEntry[],
  machine: GachaMachineDef,
  wish: string | null,
  credits: CreditCounters,
): { result: DrawResult; credits: CreditCounters } {
  const nextPity = credits.pity + machine.creditPerDraw;
  const nextBox = credits.box + machine.creditPerDraw;
  const forced = machine.pityThreshold > 0 && nextPity >= machine.pityThreshold;
  if (forced) {
    const tier = rollTier(rng, machine.rates, tiersAtLeast('legendary'));
    const speciesId = pickSpecies(rng, pool, tier, wish, machine.wishBoost);
    return { result: { speciesId, tier, isNew: false, guaranteed: true }, credits: { box: nextBox, pity: 0 } };
  }
  const tier = rollTier(rng, machine.rates);
  const speciesId = pickSpecies(rng, pool, tier, wish, machine.wishBoost);
  const legendaryPlus = isAtLeast(tier, 'legendary');
  return { result: { speciesId, tier, isNew: false, guaranteed: false }, credits: { box: nextBox, pity: legendaryPlus ? 0 : nextPity } };
}

/**
 * A batch of draws. A ten-draw (or bigger) that produced nothing at
 * `tenDrawGuarantee` or better has its last draw replaced with a guaranteed one.
 */
export function drawBatch(
  rng: Rng,
  pool: readonly GachaPoolEntry[],
  machine: GachaMachineDef,
  wish: string | null,
  credits: CreditCounters,
  count: number,
): { results: DrawResult[]; credits: CreditCounters } {
  const results: DrawResult[] = [];
  let cursor = credits;
  for (let i = 0; i < count; i++) {
    const step = drawWild(rng, pool, machine, wish, cursor);
    results.push(step.result);
    cursor = step.credits;
  }
  if (count >= 10) {
    const hasGuarantee = results.some((r) => isAtLeast(r.tier, machine.tenDrawGuarantee));
    if (!hasGuarantee && results.length > 0) {
      const tier = rollTier(rng, machine.rates, tiersAtLeast(machine.tenDrawGuarantee));
      const speciesId = pickSpecies(rng, pool, tier, wish, machine.wishBoost);
      results[results.length - 1] = { speciesId, tier, isNew: false, guaranteed: true };
    }
  }
  return { results, credits: cursor };
}

/** A box can be claimed while its credits cover the machine's requirement. */
export function boxReady(state: GachaMachineState, machine: GachaMachineDef): boolean {
  return machine.boxCreditsNeeded > 0 && state.boxCredits >= machine.boxCreditsNeeded;
}

export function boxProgress(state: GachaMachineState, machine: GachaMachineDef): number {
  if (machine.boxCreditsNeeded <= 0) return 0;
  return Math.min(1, state.boxCredits / machine.boxCreditsNeeded);
}

export function pityProgress(state: GachaMachineState, machine: GachaMachineDef): number {
  if (machine.pityThreshold <= 0) return 0;
  return Math.min(1, state.pityCredits / machine.pityThreshold);
}

/** Whether the wish is available for this machine at the current lifetime count. */
export function wishUnlocked(state: GachaMachineState, machine: GachaMachineDef): boolean {
  return machine.wish && state.lifetimeDraws >= machine.wishUnlockDraws;
}

/** Real per-species probability, used by the rates sheet (PROMPT §7.5). */
export interface SpeciesProbability {
  speciesId: string;
  tier: Tier;
  probability: number;
}

export function probabilityTable(
  machine: GachaMachineDef,
  pool: readonly GachaPoolEntry[],
  wish: string | null,
): SpeciesProbability[] {
  const totalWeight = machine.rates.reduce((sum, r) => sum + Math.max(0, r.weight), 0);
  if (totalWeight <= 0) return [];
  const out: SpeciesProbability[] = [];
  for (const row of machine.rates) {
    const inTier = pool.filter((p) => p.tier === row.tier);
    if (inTier.length === 0) continue;
    const tierChance = Math.max(0, row.weight) / totalWeight;
    const applied = wish !== null && inTier.some((p) => p.speciesId === wish) ? machine.wishBoost : 1;
    const weightSum = inTier.reduce((sum, p) => sum + (p.speciesId === wish ? applied : 1), 0);
    for (const entry of inTier) {
      const share = (entry.speciesId === wish ? applied : 1) / weightSum;
      out.push({ speciesId: entry.speciesId, tier: row.tier, probability: tierChance * share });
    }
  }
  return out.sort((a, b) => b.probability - a.probability || a.speciesId.localeCompare(b.speciesId));
}

/** Sort pool entries into a stable, cheapest-tier-first order for display. */
export function orderPool(pool: readonly GachaPoolEntry[]): GachaPoolEntry[] {
  return [...pool].sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.speciesId.localeCompare(b.speciesId));
}
