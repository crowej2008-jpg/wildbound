import type { Rewards } from '../economy/rewards';
import type { EnemyPoolSpec } from '../pve/types';

/**
 * Rift Arena — Rift Barriers (M13.4). The source's New Rift Arena (`underground_new_*`): a weekly season
 * (Tue 07:00 → Sun 22:00 UTC), 250 floors (Easy 1–100, then Advanced 101–250), a boss every 5th floor, 5 lives
 * a day (a lost challenge costs one), difficulty 1–10 picked at season start, floor rewards on the Easy track,
 * Time Coins / Time Credits drops, and challenge-count chests. See docs/design/rift-arena.md.
 */

export interface RiftDifficultyRule {
  difficulty: number;
  /** Resonance level that reaches this difficulty (stand-in: the source picks by server resonance). */
  minResonance: number;
  /** Level every fielded Pokémon is synced to (stand-in value; the source syncs players to one level). */
  syncLevel: number;
  /** Easy-track floor rewards (source `floor_reward`): floor → rewards. */
  floorRewards: { floor: number; rewards: Rewards }[];
}

export interface RiftRules {
  floors: number;
  /** Last floor of the Easy track. */
  easyFloors: number;
  livesPerDay: number;
  bossEvery: number;
  /** Season window in UTC: ISO weekday (1 = Monday … 7 = Sunday) and hour. */
  season: { openDay: number; openHour: number; endDay: number; endHour: number };
  /** Gold per leftover Time Coin when the season ends (source `ratio`). */
  coinToGold: number;
  difficulties: RiftDifficultyRule[];
  /** Drops per win (source `drop_preview_by_floor`; Easy amounts are stand-ins). */
  drops: { easy: Rewards; easyBoss: Rewards; advanced: Rewards; advancedBoss: Rewards };
  /** Challenge-count chests (source `underground_new_box_reward_json`). */
  chests: { challenges: number; rewards: Rewards }[];
  /** Enemies: step = floor − 1, levels × the difficulty's factor (stand-in curve). */
  enemy: EnemyPoolSpec;
  /** Boss floors' enemy stat multiplier (stand-in). */
  bossMult: number;
}

export interface RiftState {
  /** The season this progress belongs to (ISO week key). */
  season: string;
  /** Difficulty locked at the first visit of the season. */
  difficulty: number;
  /** Highest floor cleared this season (0 = none). */
  highest: number;
  lives: number;
  /** UTC day the lives were last refilled. */
  livesDay: string;
  /** Challenges fought this season (wins and losses), for the chests. */
  challenges: number;
  claimedChests: number[];
}
