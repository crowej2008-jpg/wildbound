import type { CoreStats } from '../model';
import type { GrowthInput, GrowthTables } from './types';

/**
 * Multiplicative stat formula (PROMPT §7.1, see docs/design/wilds.md):
 *
 *   stat = base × levelCurve × starMult × evolutionMult × qualityMult
 *
 * This deviates from the reference model (linear `basic + level×growth`); the
 * deviation is deliberate and recorded in docs/ASSUMPTIONS.md.
 */

export function levelCurve(level: number, tables: GrowthTables): number {
  return 1 + Math.max(0, level - 1) * tables.levelGrowth;
}

export function starMult(stars: number, tables: GrowthTables): number {
  return 1 + (Math.max(1, stars) - 1) * tables.starStep;
}

export function evolutionMult(stage: number, tables: GrowthTables): number {
  const idx = Math.min(Math.max(0, stage), tables.evolutionMult.length - 1);
  return tables.evolutionMult[idx] ?? 1;
}

/** Highest legal level for a stage (clamped into the table). */
export function levelCap(stage: number, tables: GrowthTables): number {
  const idx = Math.min(Math.max(0, stage), tables.maxLevelByStage.length - 1);
  return tables.maxLevelByStage[idx] ?? tables.maxLevelByStage[tables.maxLevelByStage.length - 1] ?? 1;
}

/** Resolve the six core stats for a Wild at a given level/star/stage/quality. */
export function resolveCoreStats(input: GrowthInput, tables: GrowthTables): CoreStats {
  const factor =
    levelCurve(input.level, tables) *
    starMult(input.stars, tables) *
    evolutionMult(input.stage, tables) *
    tables.qualityMult[input.tier];
  return {
    hp: Math.round(input.base.hp * factor),
    pAtk: Math.round(input.base.pAtk * factor),
    sAtk: Math.round(input.base.sAtk * factor),
    spd: Math.round(input.base.spd * factor),
    pDef: Math.round(input.base.pDef * factor),
    sDef: Math.round(input.base.sDef * factor),
  };
}
