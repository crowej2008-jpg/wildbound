import type { ProgressTables, WildInstance } from './types';
import { levelUpCost } from './costs';

/**
 * Pure transforms. Each returns a new instance; the server decides affordability
 * and persistence. Levels clamp to the cap the caller passes (never trust the caller's amount).
 */

export function leveledUp(instance: WildInstance, levels: number, cap: number): WildInstance {
  const level = Math.min(cap, Math.max(1, instance.level + Math.max(0, Math.floor(levels))));
  return { ...instance, level };
}

/** One star up (the source's Evolve), clamped to the species' last star. */
export function starredUp(instance: WildInstance, maxStar: number): WildInstance {
  return { ...instance, stars: Math.min(maxStar, instance.stars + 1) };
}

/** Candy+gold refunded by a respawn (most of what was invested in levels). */
export function respawnRefund(instance: WildInstance, tables: ProgressTables): { candy: number; gold: number } {
  const invested = levelUpCost(1, instance.level, tables);
  const rate = tables.respawn.refundRate;
  return { candy: Math.floor(invested.candy * rate), gold: Math.floor(invested.gold * rate) };
}

/** A respawned instance: level reset to 1, stars kept (reference shape). */
export function respawned(instance: WildInstance): WildInstance {
  return { ...instance, level: 1 };
}
