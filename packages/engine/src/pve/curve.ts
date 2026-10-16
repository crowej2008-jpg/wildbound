import { mulberry32 } from '../rng';
import type { ResolvedCurve, GeneratedEnemy } from './types';

/**
 * Enemy-squad generation for the M8 modes (PROMPT §7.6 "enemy squads are
 * generated from stage definitions and scaled by a difficulty curve"). Pure and
 * seeded: the same index + parameters always produce the same squad. See
 * docs/design/pve-modes.md.
 */

export function curveLevel(curve: ResolvedCurve, index: number): number {
  return Math.max(1, Math.round(curve.baseLevel * Math.pow(curve.levelSlope, Math.max(0, index))));
}

function stepCount(every: number, index: number): number {
  return every > 0 ? Math.floor(Math.max(0, index) / every) : 0;
}

/**
 * Build a deterministic enemy squad for a mode step (`index` is the 0-based
 * floor/level). Species are drawn without replacement from the curve's pool; a
 * pool smaller than `count` repeats its entries.
 */
export function generateEnemies(curve: ResolvedCurve, index: number): GeneratedEnemy[] {
  const pool = curve.pool;
  if (pool.length === 0) return [];
  const count = Math.max(1, Math.floor(curve.count));
  const level = curveLevel(curve, index);
  const stars = Math.min(curve.maxStars, 1 + stepCount(curve.starsEvery, index));
  const stage = Math.min(curve.maxStage, stepCount(curve.stageEvery, index));

  const rng = mulberry32(0x9e37 ^ (Math.floor(index) * 2654435761));
  const available = [...pool];
  const enemies: GeneratedEnemy[] = [];
  for (let i = 0; i < count; i += 1) {
    if (available.length === 0) available.push(...pool);
    const pick = Math.floor(rng() * available.length);
    const speciesId = available.splice(pick, 1)[0] ?? pool[0]!;
    // Later slots are a touch stronger, so the front line is the toughest.
    enemies.push({ speciesId, level: level + (i >= Math.floor(count / 2) ? 1 : 0), stars, stage });
  }
  return enemies;
}
