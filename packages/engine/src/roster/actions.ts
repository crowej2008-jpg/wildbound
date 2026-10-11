import type { ProgressTables, WildInstance } from './types';
import { levelCapOf, levelUpCost } from './costs';

/**
 * Pure transforms. Each returns a new instance; the server decides affordability
 * and persistence. Levels/stars clamp to their caps here (never trust the caller).
 */

export function leveledUp(instance: WildInstance, levels: number, tables: ProgressTables): WildInstance {
  const cap = levelCapOf(instance, tables);
  const level = Math.min(cap, Math.max(1, instance.level + Math.max(0, Math.floor(levels))));
  return { ...instance, level };
}

export function starredUp(instance: WildInstance, stars: number, tables: ProgressTables): WildInstance {
  const next = Math.min(tables.maxStars, Math.max(1, instance.stars + Math.max(0, Math.floor(stars))));
  return { ...instance, stars: next };
}

export function evolved(instance: WildInstance, stageCount: number, tables: ProgressTables): WildInstance {
  const next = Math.min(instance.evolutionStage + 1, stageCount - 1, tables.evolve.length - 1);
  return { ...instance, evolutionStage: Math.max(0, next) };
}

/** Candy+gold refunded by a respawn (most of what was invested in levels). */
export function respawnRefund(instance: WildInstance, tables: ProgressTables): { candy: number; gold: number } {
  const invested = levelUpCost(1, instance.level, tables);
  const rate = tables.respawn.refundRate;
  return { candy: Math.floor(invested.candy * rate), gold: Math.floor(invested.gold * rate) };
}

/** A respawned instance: level reset to 1, stars/stage kept (reference shape). */
export function respawned(instance: WildInstance): WildInstance {
  return { ...instance, level: 1 };
}
