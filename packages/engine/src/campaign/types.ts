/**
 * Campaign data + progress vocabulary (M5, PROMPT §7.6). Pure types; the
 * stage *data* lives in content, the rules live in `stage.ts`.
 */

/** One enemy in a stage's defender squad, scaled by the stage's difficulty. */
export interface StageEnemy {
  speciesId: string;
  level: number;
  stars: number;
  /** evolution stage (0-based). */
  stage: number;
}

/** Currency/xp payout. Keys are currencies plus `xp` for trainer experience. */
export interface StageReward {
  gold?: number;
  gems?: number;
  candy?: number;
  shard?: number;
  stone?: number;
  xp?: number;
}

/** A story gate (M13.0a): the gym that must fall before the stage opens. */
export interface StageGate {
  gymId: string;
}

export interface StageDef {
  id: string;
  /** 1-based chapter number (also the grouping key). */
  chapter: number;
  /** 1-based index within the chapter. */
  index: number;
  name: string;
  enemies: StageEnemy[];
  /** Granted once, the first time the stage is cleared. */
  firstClear: StageReward;
  /** Granted on every clear / sweep. */
  repeat: StageReward;
  /** Idle income per minute once this stage is cleared (best cleared wins). */
  idlePerMinute: StageReward;
  /** Rounds at or under for 3 stars, then for 2 stars (else 1). */
  starRounds: [number, number];
  /** M13.0a: when present, the stage also requires this gym to be cleared. */
  gate?: StageGate;
}

export interface ChapterDef {
  id: string;
  number: number;
  name: string;
  stages: StageDef[];
}

/** A stage absent from `stars` is uncleared; a value is 1–3. */
export interface CampaignProgress {
  stars: Record<string, number>;
  /** M13.0a: gym ids already defeated (first clear paid). */
  gyms?: Record<string, boolean>;
}
