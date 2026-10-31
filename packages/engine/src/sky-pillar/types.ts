import type { Rewards } from '../economy/rewards';
import type { EnemyPoolSpec } from '../pve/types';

/**
 * Sky Pillar tuning and progress (M13.2). The source is a 180-floor, 10-stage
 * tower with star conditions, proofs and sweeps. Counts and shapes follow the
 * source; the floor layout, numbers and rewards are ours. See
 * docs/design/sky-pillar.md.
 */

export type SkyPillarConditionKind = 'knockoutsAtMost' | 'hpAtLeast' | 'roundsAtMost';

export interface SkyPillarCondition {
  kind: SkyPillarConditionKind;
  /** KO count, HP percentage (0-100) or big-round count, depending on kind. */
  value: number;
}

export interface SkyPillarStageRule {
  stage: number;
  /** Paid the first time this stage is cleared. */
  pass: Rewards;
  /** Paid by a sweep that lands on this stage's best 3-star record. */
  sweep: Rewards;
  /** The two conditions after the automatic clear star. */
  conditions: SkyPillarCondition[];
}

export interface SkyPillarChestRule {
  /** Floor star total required. */
  stars: number;
  rewards: Rewards;
}

export interface SkyPillarFloorRule {
  floor: number;
  /** 1-6; every wing is 30 floors. */
  wing: number;
  /** Trainer level needed to open the floor. */
  playerLevel: number;
  enemy: EnemyPoolSpec;
  stages: SkyPillarStageRule[];
  chests: SkyPillarChestRule[];
}

export interface SkyPillarRules {
  maxProofs: number;
  regenMinutes: number;
  initialProofs: number;
  /** Hard battle cap; a time-out is a loss (the source's 15-turn counter). */
  roundLimit: number;
  floors: SkyPillarFloorRule[];
}

export interface SkyPillarState {
  /** Best star rating per stage key (`floor:stage`); absent means unpassed. */
  stars: Record<string, number>;
  /** Current proofs. This can exceed `maxProofs`; the cap only stops recharge. */
  proofs: number;
  /** Start of the current 8-hour recharge interval. */
  lastProofAt: number;
  /** Claimed floor chest keys (`floor:stars`). */
  claimedChests: string[];
}

export interface SkyPillarStageRef {
  floor: number;
  stage: number;
}

export interface SkyPillarBattleFacts {
  win: boolean;
  rounds: number;
  knockouts: number;
  minHpPercent: number;
}
