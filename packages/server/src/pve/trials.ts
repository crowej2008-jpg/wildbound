import {
  dayKey,
  trialAvailable,
  trialBattleRules,
  trialFaction,
  trialLevelCap,
  weekdayUtc,
  type AccountState,
  type Rewards,
} from '@wildbound/engine';
import { modeBattle } from '../battle';
import { applyGrant } from '../economy';
import { fail, ok, type Result } from '../index';
import type { GameConfig } from '../config';
import { enemiesFor, trialDefs, type BattleOutcome } from './shared';

/** Trials (M8, PROMPT §7.6): rule-bending fights, first clear of the day pays. */

export type TrialExtra = { trialId: string; firstToday: boolean };

export function challengeTrial(
  config: GameConfig,
  state: AccountState,
  trialId: string,
  now: number,
  seed?: number,
): Result<BattleOutcome<TrialExtra>> {
  const trial = trialDefs(config).find((t) => t.id === trialId);
  if (!trial) return fail('not_found', `unknown trial "${trialId}"`);
  if (!trialAvailable(trial, state.profile.level, weekdayUtc(now))) {
    return fail('stage_locked', 'this trial is not open right now');
  }
  const enemies = enemiesFor(config, trial.enemy, 0);
  const battle = modeBattle(config, state, {
    squadMode: 'campaign',
    label: 'trial',
    enemies,
    battleId: `m8:trial:${trialId}`,
    seed,
    rules: trialBattleRules(trial),
    ...(trialFaction(trial) ? { faction: trialFaction(trial)! } : {}),
    ...(trialLevelCap(trial) !== null ? { levelCap: trialLevelCap(trial)! } : {}),
  });
  if (!battle) return fail('not_found', 'no eligible Wilds for this trial');
  const win = battle.winner === 'attackers';

  const day = dayKey(now);
  const firstToday = state.pve.trials.lastCleared[trialId] !== day;
  let next: AccountState = state;
  let rewards: Rewards = {};
  if (win) {
    rewards = firstToday ? (trial.rewards as Rewards) : {};
    next = applyGrant(
      config,
      {
        ...state,
        pve: { ...state.pve, trials: { lastCleared: { ...state.pve.trials.lastCleared, [trialId]: day } } },
      },
      rewards,
    );
  }
  return ok({ state: next, battle, win, rewards, extra: { trialId, firstToday } });
}
