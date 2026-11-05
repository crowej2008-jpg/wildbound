import type { Rewards } from '../economy/rewards';

/**
 * Berry Grove (M13.8, the owner's replacement for the Island Challenge — a brand-new mode, not a source copy).
 * A solo garden plus its battles: the Grove Guardians (a 100-stage climb paying seeds and berry materials on
 * first clear) and the daily Grove Boss (a boss that cannot fall; the share of its HP you take sets the pay).
 * Seeds are planted in the garden's plots and grow into berries over time. See docs/design/berry-grove.md.
 */

export type SeedTier = 'common' | 'basic' | 'intermediate' | 'greater';

export const SEED_TIERS: readonly SeedTier[] = ['common', 'basic', 'intermediate', 'greater'];

export interface GrovePlot {
  seed: SeedTier | null;
  /** Epoch ms the seed went in (0 when empty). */
  plantedAt: number;
}

export interface BerryGroveState {
  plots: GrovePlot[];
  /** Highest Guardian stage cleared (0 = none). Permanent. */
  stage: number;
  /** Guardian wins today. */
  climbsToday: number;
  /** Grove Boss fights today. */
  bossFights: number;
  /** Best Grove Boss share today (0–1). */
  bossBest: number;
  /** UTC day-key of the daily counters. */
  day: string;
}

export interface GroveSeedRule {
  tier: SeedTier;
  /** The seed currency planted. */
  currency: string;
  growHours: number;
  /** Berry Essence a harvest adds to the berry. */
  essence: number;
}

export interface GroveBand {
  /** The band covers stages up to this one. */
  upTo: number;
  rewards: Rewards;
}

export interface BerryGroveRules {
  plots: number;
  seeds: GroveSeedRule[];
  guardians: {
    stages: number;
    climbsPerDay: number;
    /** First-clear pay by band. */
    bands: GroveBand[];
    /** Added on every tenth stage's first clear. */
    everyTen: Rewards;
  };
  boss: {
    fightsPerDay: number;
    hpMult: number;
    atkMult: number;
    defMult: number;
    /** A fight's full pay by the band of the highest Guardian stage cleared. */
    bands: GroveBand[];
    /** The smallest share of the full pay a fight earns. */
    minShare: number;
    /** The boss species by UTC weekday (0 = Sunday). */
    rotation: string[];
  };
}

export type GroveError = 'no_plot' | 'plot_busy' | 'plot_empty' | 'not_ripe' | 'no_seed' | 'bad_seed';
