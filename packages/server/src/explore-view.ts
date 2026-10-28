import type { ExploreModeJson } from '@wildbound/content';
import {
  exploreAccess,
  nextResetMs,
  serverDay,
  type AccountState,
  type ExploreGateStatus,
} from '@wildbound/engine';
import type { GameConfig } from './config';

/**
 * Display-ready Explore hub (M13.0b). Pure reads of `AccountState` +
 * `GameConfig`; the client renders the eight mode shells and their gates.
 */

export type ExploreGateView = ExploreGateStatus;

export interface ExploreModeView extends Omit<ExploreModeJson, 'gates'> {
  gates: ExploreGateView[];
  unlocked: boolean;
  nextResetMs: number | null;
}

export interface ExploreView {
  serverDay: number;
  serverDayNote: string;
  modes: ExploreModeView[];
}

export function buildExploreView(
  config: GameConfig,
  state: AccountState,
  now: number,
): ExploreView {
  const day = serverDay(now, state.serverEpoch);
  const context = { campaign: state.campaign, level: state.profile.level, serverDay: day };
  return {
    serverDay: day,
    serverDayNote: config.explore.serverDayNote,
    modes: config.explore.modes.map((mode) => {
      const access = exploreAccess(mode.gates, context);
      return {
        ...mode,
        gates: access.gates,
        unlocked: access.unlocked,
        nextResetMs: nextResetMs(mode.reset, now),
      };
    }),
  };
}
