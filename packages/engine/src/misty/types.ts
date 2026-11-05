import type { EnemyPoolSpec } from '../pve/types';

/**
 * Misty Woods (M13.6): the source's maze (`maze_*`). 4 chapters × 11 floors on a fixed node graph; HP and Rage
 * carry between fights; fountains heal, tombstones revive, the Diamond shop sells both, hire tiles add a helper;
 * every floor's first win pays Forest Coins; everything resets every 2 days. Runes are cut (owner 2026-11-04).
 * See docs/design/misty-woods.md.
 */

/** Tile kinds (source `type_list` ids 1–7; see docs/design/misty-woods.md for the reading). */
export type MistyTile = 'fight' | 'boss' | 'start' | 'tombstone' | 'fountain' | 'hire' | 'shop';

export interface MistyNode {
  id: number;
  chapter: number;
  floor: number;
  pos: number;
  /** Possible kinds; a node with several has one rolled per cycle. */
  tiles: MistyTile[];
  /** Nodes that lead here (0 = the chapter start). */
  pre: number[];
}

export interface MistyFloorRule {
  chapter: number;
  floor: number;
  /** Enemy strength in % (source `rate`), applied as a stat multiplier on the scaled enemy team. */
  rate: number;
  /** First-win pay (source `reward`: Forest Coins, + Diamonds on floor 11). */
  forestCoin: number;
  gems: number;
}

export interface MistyRules {
  /** Days per cycle (the source's 2-day reset). */
  cycleDays: number;
  /** Campaign stage that opens chapter 4 (source `lv4_condition` 102010 = story 20-10). */
  chapter4Stage: string;
  nodes: MistyNode[];
  floors: MistyFloorRule[];
  /** Stand-ins: fountain heal (fraction of max HP), tombstone revive HP, shop prices (Diamonds). */
  fountainHeal: number;
  reviveHp: number;
  shop: { healAll: number; revive: number };
  /** Hire tiles offer this many helpers; a helper joins at the team's average level. */
  hireOffers: number;
  enemy: EnemyPoolSpec;
}

/** A hired helper: fights for the run in an empty team slot. */
export interface MistyHelper {
  id: string;
  speciesId: string;
  level: number;
  stars: number;
}

export interface MistyState {
  /** The 2-day cycle this run belongs to. */
  cycle: number;
  chapter: number;
  /** The node the team stands on (the chapter's start node at first). */
  at: number;
  /** Nodes already resolved this cycle. */
  done: number[];
  /** Rolled tile per multi-kind node, this cycle. */
  rolled: Record<string, MistyTile>;
  /** HP fraction per unit id (Wild instance id or helper id); missing = full. */
  hp: Record<string, number>;
  rage: Record<string, number>;
  /** Units knocked out this cycle (until revived). */
  fallen: string[];
  helpers: MistyHelper[];
  /** Hire offer waiting on the current node (species ids), if any. */
  hireOffer: string[] | null;
  /** Floors whose first-win pay was taken this cycle (`chapter:floor`). */
  paid: string[];
  chaptersCleared: number[];
}
