/**
 * Joint Team (M14.4) account state: Joint Team Battles (weekly squad season vs CPU squads) and the Wild Area
 * (Joint Team Dynamax). The rules live in packages/server/src/joint-team.ts; this is the persisted shape.
 * See docs/design/joint-team.md.
 */

export interface JointTeamState {
  /** ISO week key of the current season. */
  week: string;
  /** UTC day-key of the daily counters. */
  day: string;
  battlesToday: number;
  refreshesToday: number;
  /** Your Team Points this season. */
  points: number;
  /** Battles fought this season (personal milestones). */
  battles: number;
  /** Current offered opponents (CPU squad power factors). */
  opponents: number[];
  /** Claimed keys (`p:<battles>`, `s:<points>`), this season. */
  claimed: string[];
  /** Shop buys this season by row id. */
  bought: Record<string, number>;
  /** Squad skill levels by field (permanent). */
  skills: Record<string, number>;
  /** Last finished season's final rank (unclaimed reward), or null. */
  lastRank: number | null;
}

export interface WildAreaState {
  week: string;
  day: string;
  energy: number;
  /** Epoch ms of the last energy tick. */
  energyAt: number;
  zone: number;
  /** Zone boss wins this night (by zone). */
  bossWins: Record<string, number>;
  /** Explores in the current zone this night (for the boss guarantee). */
  explores: number;
  /** Energy spent this season (unlocks multipliers). */
  spent: number;
  points: number;
  badges: number;
  /** Fragments held this season (item id → count). */
  fragments: Record<string, number>;
  /** A capture-guess awaiting the player's bet. */
  guess: { ball: 'poke' | 'advanced' | 'master' } | null;
  lastRank: number | null;
}
