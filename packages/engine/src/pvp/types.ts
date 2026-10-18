import type { Faction } from '../model';
import type { Rewards } from '../economy/rewards';

/**
 * PvP vocabulary (M10, PROMPT §7.7). Pure types: the *tables* live in
 * `packages/content/tuning/pvp.json`, the rules in the sibling modules, and the
 * server owns persistence. See docs/design/pvp.md.
 */

/** One row of the Arena rank table (a credit floor + the place it represents). */
export interface ArenaBand {
  /** Lowest credits inside this band; bands are sorted ascending. */
  minCredits: number;
  /** Arena place at this band's floor ("My Ranking"). */
  startPlace: number;
  /** Paid at the weekly settlement. */
  reward: Rewards;
  /** Credits after the weekly reset for a player who settled in this band. */
  resetCredits: number;
}

/** A daily participation chest, reached after `battles` battles today. */
export interface ArenaChestTier {
  battles: number;
  reward: Rewards;
}

/** A one-time reward for reaching a best-ever place (`place` or better). */
export interface ArenaAchievement {
  place: number;
  reward: Rewards;
}

/** Arena rules (a projection of `pvp.json`'s `arena`; the enemy pool stays server-side). */
export interface ArenaTuning {
  freeAttemptsPerDay: number;
  /** Gems per bought attempt, by the day's purchase number (last repeats). */
  attemptPrices: number[];
  opponentCount: number;
  creditsPerWin: number;
  creditsPerLoss: number;
  creditCap: number;
  bands: ArenaBand[];
  chestTiers: ArenaChestTier[];
  bestRankTiers: ArenaAchievement[];
}

/** Persisted Arena progress (one per account). */
export interface ArenaState {
  credits: number;
  /** Highest credit value ever reached (readout only). */
  bestCredits: number;
  /** Best (lowest) place ever reached; 0 = never ranked. */
  bestPlace: number;
  /** UTC day-key the daily counters belong to. */
  day: string;
  /** Attempts used today. */
  attempts: number;
  /** Attempts bought today (prices are per day). */
  bought: number;
  /** Reroll counter; feeds the day's three opponent seeds. */
  opponentSeed: number;
  /** Battles fought today (chest progress). */
  battleCount: number;
  /** Chest indices claimed today. */
  claimedChests: number[];
  /** Best-rank achievement indices claimed (one-time, never reset). */
  claimedAchievements: number[];
  /** Week key of the last weekly settlement. */
  weekKey: string;
}

/** One Ranked rung (a threshold; the *name* is content and never read by code). */
export interface RankedTier {
  name: string;
  score: number;
}

/** One step of the challenge-gift track, at `matches` matches this season. */
export interface RankedGift {
  matches: number;
  reward: Rewards;
}

/** One region: a team format, a weather rotation and per-tier coin values. */
export interface RankedPhase {
  id: string;
  name: string;
  /** Squads per match (the reference's 2 or 3 team formats). */
  teams: number;
  /** Wilds per squad (4, 5 or 6). */
  teamSize: number;
  /** Reward in PvP tokens per tier, index-aligned with `RankedTuning.tiers`. */
  coins: number[];
  /** Factions this phase may roll as weather. */
  weather: Faction[];
}

/** Ranked rules (a projection of `pvp.json`'s `ranked`). */
export interface RankedTuning {
  freeAttemptsPerDay: number;
  attemptPrices: number[];
  winScore: number;
  lossScore: number;
  bestOf: number;
  /** Weather damage bonus (the reference's +30%). */
  weatherDmg: number;
  /** The 12 tiers shared by every phase. */
  tiers: RankedTier[];
  giftTrack: RankedGift[];
  phases: RankedPhase[];
}

/** Persisted Ranked progress (one per account). */
export interface RankedState {
  /** Phase index into `RankedTuning.phases`. */
  phase: number;
  /** Tier index within the phase. */
  tier: number;
  /** Points inside the current tier. */
  score: number;
  /** Ladder day-key (03:00 UTC boundary) the attempts belong to. */
  day: string;
  attempts: number;
  bought: number;
  /** Season match count (drives the challenge-gift track). */
  matches: number;
  /** Tier indices of the current phase already claimed. */
  claimedTiers: number[];
  /** Gift-track indices already claimed. */
  claimedGifts: number[];
  /** Season key of the last rollover. */
  season: string;
  wins: number;
  losses: number;
  /** Wins/total for today's stat readout (reset at the 03:00 update). */
  dayWins: number;
  dayBattles: number;
  streak: number;
  bestStreak: number;
}

/** The current and next weather faction for a phase. */
export interface WeatherPick {
  current: Faction;
  next: Faction;
}

/** The `BattleRules.weather` value (structural match; see combat/damage.ts). */
export interface WeatherRule {
  factions: Faction[];
  dmg: number;
}

/** The decoded `dan` id: `phase × 1000 + group × 100 + tier`. */
export interface DanInfo {
  /** 1-based phase, as in the reference's dan ids. */
  phase: number;
  /** 1-based group (1 Vanguard, 2 Elite, 3 Commander, 4 Legend, 5 Overlord, 6 King). */
  group: number;
  /** 1-based tier inside the group. */
  tier: number;
  /** 0-based index into `RankedTuning.tiers`. */
  tierIndex: number;
}

/** The result of scoring one Ranked match. */
export interface RankedScoreResult {
  score: number;
  tier: number;
  /** True when the match was won at the promotion threshold. */
  promoted: boolean;
}
