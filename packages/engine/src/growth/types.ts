import type { CoreStats, PercentLines, Tier } from '../model';

/**
 * Growth & Power tables (M2). The engine stays pure and never imports content:
 * callers pass these tables in, the CLI validator checks the JSON matches them.
 */
export interface GrowthTables {
  /** Level cap per evolution stage (index = stage). */
  maxLevelByStage: number[];
  maxStars: number;
  /** Per-level (beyond level 1) multiplier slope for `levelCurve`. */
  levelGrowth: number;
  /** Per-star (beyond star 1) multiplier step for `starMult`. */
  starStep: number;
  /** Evolution multiplier per stage (index = stage). */
  evolutionMult: number[];
  qualityMult: Record<Tier, number>;
}

/** One stat line's Power weighting: core points and the percent-value extensions. */
export interface PowerRow {
  powerRate: number;
  extRate: number;
}

export interface PowerWeights {
  core: CoreStats;
  percent: Partial<Record<keyof PercentLines, PowerRow>>;
  /** Percent values are fractions; this scales them to the formula's units. */
  scale: number;
}

export interface GrowthInput {
  base: CoreStats;
  level: number;
  stars: number;
  tier: Tier;
  stage: number;
}
