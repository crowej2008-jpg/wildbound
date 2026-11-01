import type { Faction, Tier } from '../model';
import type { Rewards } from '../economy/rewards';
import type { StageEnemy } from '../campaign/types';

/**
 * PvE mode vocabulary (M8, PROMPT §7.6). Pure types: the *definitions* live in
 * `packages/content/pve/*.json`, the rules in the sibling modules, and the server
 * owns persistence. See docs/design/pve-modes.md.
 */

/** How a mode's enemy squad is generated from the species catalogue. */
export interface EnemyPoolSpec {
  /** Species must belong to one of these factions (empty = any). */
  factions: Faction[];
  /** Species must be of one of these tiers (empty = any). */
  tiers: Tier[];
  count: number;
  baseLevel: number;
  levelSlope: number;
  /** Grant one extra star every N steps (0 = never). */
  starsEvery: number;
  maxStars: number;
  /** Grant one evolution stage every N steps (0 = never). */
  stageEvery: number;
  maxStage: number;
}

/** A fully resolved squad generator the engine can run without content. */
export interface ResolvedCurve {
  pool: string[];
  count: number;
  baseLevel: number;
  levelSlope: number;
  starsEvery: number;
  maxStars: number;
  stageEvery: number;
  maxStage: number;
}

/** R9: a daily-dungeon grade goal (source dun_score_reward_json): kills or damage, optionally within N rounds. */
export interface DungeonGradeGoal {
  grade: 'C' | 'B' | 'A' | 'S';
  kills?: number;
  damage?: number;
  rounds?: number;
}

/** One weekday's World Boss. */
export interface WorldBossDef {
  /** 0=Sun..6=Sat. */
  weekday: number;
  speciesId: string;
  name: string;
}

/** A reward paid when damage reaches a threshold. */
export interface WorldBossMilestone {
  damage: number;
  rewards: Rewards;
}

/** One generated enemy squad (re-uses the campaign enemy shape). */
export type GeneratedEnemy = StageEnemy;
