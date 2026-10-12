import {
  addRewards,
  applyRewards,
  bestIdleStage,
  levelForXp,
  type AccountState,
  type Rewards,
  type StageDef,
} from '@wildbound/engine';
import type { GameConfig } from './config';

/**
 * Server-side economy glue (M5): turning reward bundles into account mutations.
 * The engine owns the rules; these helpers read the injected config's xp curve
 * and campaign so the LocalServer methods stay thin.
 */

/** Apply a bundle: add currencies and trainer xp, re-deriving the level. */
export function applyGrant(config: GameConfig, state: AccountState, rewards: Rewards): AccountState {
  const currencies = applyRewards(state.currencies, rewards);
  const xp = state.profile.xp + Math.max(0, Math.floor(rewards.xp ?? 0));
  const level = levelForXp(xp, config.xpCurve);
  return { ...state, currencies, profile: { ...state.profile, xp, level } };
}

/** The per-minute idle rate from the best cleared stage (empty when none). */
export function bestIdleRate(config: GameConfig, state: AccountState): Rewards {
  const best = bestIdleStage(state.campaign, config.stages);
  return best ? best.idlePerMinute : {};
}

/** The best cleared stage id, for the idle slice's display pointer. */
export function bestIdleStageId(config: GameConfig, state: AccountState): string | null {
  return bestIdleStage(state.campaign, config.stages)?.id ?? null;
}

/** A clear's payout: the first-clear bonus stacks with the repeat drop. */
export function stageRewards(stage: StageDef, firstClear: boolean): Rewards {
  return firstClear ? addRewards(stage.firstClear, stage.repeat) : stage.repeat;
}
