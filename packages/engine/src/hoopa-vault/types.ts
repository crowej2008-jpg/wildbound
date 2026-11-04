import type { Rewards } from '../economy/rewards';
import type { EnemyPoolSpec } from '../pve/types';

/**
 * Hoopa's Vault (M13.3): a 300-floor escape run. Each run spends `multiplier` Vault Secret Keys; route battles
 * push escape progress toward the target before Hoopa (who advances by the rounds fought) catches up; at the
 * target the Exit Guardian fights a fixed number of rounds. A win keeps the bag and clears the floor; a loss,
 * a catch or an exit loses the bag and refunds the keys. See docs/design/hoopa-vault.md.
 */

export type HoopaCard = 'strong' | 'normal' | 'buff' | 'blessing';

export interface HoopaCardRule {
  /** Escape progress added by winning this card's battle. */
  escape: number;
  /** Strong routes field a tougher team (enemy stat multiplier). */
  enemyMult: number;
  /** Run-long attack boost added when this card's battle is won (0.1 = +10 %). */
  attackBoost: number;
  /** Run-long drop boost added when this card's battle is won (0.25 = +25 %). */
  dropBoost: number;
  /** Relative chance of the card appearing in an offer. */
  weight: number;
}

/** A floor band: the source's `hupa_treasury_difficulty_json` rows (drop pool and what starts dropping). */
export interface HoopaFloorBand {
  /** First floor of the band. */
  floor: number;
  /** The source's drop pool id for floors from here. */
  dropPool: number;
  /** The source's description of what this band adds. */
  note: string;
}

export interface HoopaVaultRules {
  floors: number;
  freeKeysPerDay: number;
  /** The highest multiplier allowed once the highest cleared floor reaches `afterFloor`. */
  multipliers: { afterFloor: number; max: number }[];
  run: {
    startEscape: number;
    target: number;
    /** Cards offered after each route battle. */
    offerSize: number;
    cards: Record<HoopaCard, HoopaCardRule>;
  };
  guardian: {
    rounds: number;
    /** Enemy stat multiplier for the Exit Guardian's team. */
    mult: { hp: number; atk: number; def: number };
  };
  /** Route enemies: step = floor − 1. */
  enemy: EnemyPoolSpec;
  /** Stage pay (stand-ins until the drop pools are known): per route win, scaled by floor and multiplier. */
  stagePay: {
    heldItemShard: { base: number; perFloor: number };
    resetterShard: { chance: number; min: number; max: number };
  };
  /** Guardian pay on a win, before the multiplier. */
  guardianPay: { resetterShard: { min: number; max: number }; heldItemShard: number };
  /** Resetter Shard lumps grow with the floor: the factor of the last band whose floor is reached. */
  resetterFactor: { floor: number; factor: number }[];
  bands: HoopaFloorBand[];
}

export interface HoopaRun {
  floor: number;
  multiplier: number;
  escape: number;
  hoopa: number;
  /** Route battles won so far. */
  stage: number;
  /** The cards on offer for the next battle. */
  offer: HoopaCard[];
  attackBoost: number;
  dropBoost: number;
  /** Everything banked so far; kept only by beating the Exit Guardian. */
  bag: Rewards;
  /** True once escape reaches the target: the next fight is the Exit Guardian. */
  atGuardian: boolean;
  /** Seed for this run's offers and drops. */
  seed: number;
}

export interface HoopaVaultState {
  /** Highest floor cleared (0 = none). */
  highest: number;
  /** UTC day (YYYY-MM-DD) the free keys were last claimed. */
  keyDay: string;
  run: HoopaRun | null;
  /** Runs finished (any result). */
  runs: number;
}
