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
export type HeldQuality = 'rare' | 'epic' | 'legendary' | 'supreme' | 'mythic';
export type VaultOrbColour = 'purple' | 'orange' | 'red';

export interface HoopaFloorBand {
  /** First floor of the band. */
  floor: number;
  /** The source's drop pool id for floors from here. */
  dropPool: number;
  /** The source's description of what this band adds. */
  note: string;
  /** Held-item quality odds from this floor (the source's band notes; the weights are stand-ins). */
  qualities: Partial<Record<HeldQuality, number>>;
  /** The best orb this band drops (source band notes), or null before floor 6. */
  orb: { colour: VaultOrbColour; level: number } | null;
}

/** A held item waiting in the bag: its lines roll only when the bag is kept (as in the source). */
export interface BagItem {
  defId: string;
  quality: HeldQuality;
}

/** An orb waiting in the bag: its kind and lines roll when the bag is kept. */
export interface BagOrb {
  colour: VaultOrbColour;
  level: number;
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
  /** Guardian pay on a win, before the multiplier: Resetter Shards, Held Item Shards and `items` held items. */
  guardianPay: { resetterShard: { min: number; max: number }; heldItemShard: number; items: number };
  /** Chances per route win (Strong routes and the Drop blessing raise them). */
  routeDrops: { itemChance: number; orbChance: number };
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
  /** Held items banked (lines roll when kept). */
  items: BagItem[];
  /** Orbs banked (kind and lines roll when kept). */
  orbs: BagOrb[];
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
