import type { FodderReq } from '../growth/types';
import type { PotentialPick, PotentialSpecies, PotentialState, PotentialTable } from './types';

export const POTENTIAL_TIERS = 9;

export function emptyPotential(): PotentialState {
  return { picks: Array.from({ length: POTENTIAL_TIERS }, () => null), spent: { shards: 0, cores: 0, fodder: [] } };
}

/** Stars that unlock a tier (0-based tier index). */
export function unlockStar(table: PotentialTable, tier: number): number {
  return table.unlockStars[tier] ?? Infinity;
}

/** The panel opens with tier 1's star (7★); tiers may be unlocked in any order (source client). */
export function canUnlockTier(table: PotentialTable, stars: number, tier: number): boolean {
  return tier >= 0 && tier < POTENTIAL_TIERS && stars >= unlockStar(table, tier);
}

/** Shards to unlock a tier (its option goes to Lv 1). */
export function unlockShards(table: PotentialTable, tier: number): number {
  return table.costs[tier]?.[0] ?? Infinity;
}

/** Shards to take an unlocked option from `lv` to `lv + 1` (Infinity at the cap). */
export function levelShards(table: PotentialTable, tier: number, lv: number): number {
  if (lv >= table.maxLevel) return Infinity;
  return table.costs[tier]?.[lv] ?? Infinity;
}

/** Fodder lines for a tier of a species. */
export function tierFodder(species: PotentialSpecies, tier: number): FodderReq[] {
  return species.fodder[tier] ?? [];
}

export function pickAt(state: PotentialState, tier: number): PotentialPick | null {
  return state.picks[tier] ?? null;
}

/** The option id picked on a tier, or null. */
export function pickedOptionId(species: PotentialSpecies, pick: PotentialPick | null, tier: number): number | null {
  if (!pick) return null;
  return species.tiers[tier]?.[pick.option] ?? null;
}

/** Shards a full reset returns (everything spent on unlocks and levels). */
export function resetRefund(state: PotentialState): PotentialState['spent'] {
  return state.spent;
}
