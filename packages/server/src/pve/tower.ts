import {
  addRewards,
  advanceTower,
  canClimb,
  canSweep,
  dayKey,
  nextTowerFloor,
  rollTower,
  spendSweep,
  towerFloorReward,
  towerMilestones,
  weekKey,
  type AccountState,
  type Rewards,
} from '@wildbound/engine';
import { modeBattle } from '../battle';
import { applyGrant } from '../economy';
import { fail, ok, type Result } from '../index';
import type { GameConfig } from '../config';
import { towerTitleCards } from '../titles';
import { enemiesFor, towerTuning, type BattleOutcome } from './shared';

/** Tower (M8, PROMPT §7.6): weekly climbs, daily sweeps, permanent floors. */

export type TowerExtra = { floor: number; sweepsLeft: number };

export function challengeTower(
  config: GameConfig,
  state: AccountState,
  now: number,
  seed?: number,
): Result<BattleOutcome<TowerExtra>> {
  const tuning = towerTuning(config);
  const rolled = rollTower(state.pve.tower, dayKey(now), weekKey(now));
  if (!canClimb(rolled, tuning)) return fail('daily_limit', 'no tower climbs left this week');
  const floor = nextTowerFloor(rolled);
  const enemies = enemiesFor(config, config.pve.tower.enemy, floor - 1);
  const battle = modeBattle(config, state, {
    squadMode: 'tower',
    label: 'towerFloor',
    enemies,
    battleId: `m8:tower:${floor}`,
    seed,
  });
  if (!battle) return fail('not_found', 'no Wilds available to climb');
  const win = battle.winner === 'attackers';

  let next: AccountState = { ...state, pve: { ...state.pve, tower: rolled } };
  let rewards: Rewards = {};
  if (win) {
    rewards = towerFloorReward(floor, tuning);
    let claimed = rolled.claimedMilestones;
    if (towerMilestones(tuning).includes(floor) && !claimed.includes(floor)) {
      rewards = addRewards(rewards, config.pve.tower.milestoneRewards);
      claimed = [...claimed, floor];
    }
    const advanced = { ...advanceTower(rolled, floor), claimedMilestones: claimed };
    next = applyGrant(config, { ...state, pve: { ...state.pve, tower: advanced } }, rewards);
    // R8: the source pays a title activation card at Tower floors 5 / 135 / 400 / 500.
    next = towerTitleCards(config, next, floor);
  }
  return ok({
    state: next,
    battle,
    win,
    rewards,
    extra: { floor, sweepsLeft: tuning.sweepsPerDay - rolled.sweepsToday },
  });
}

export function sweepTower(
  config: GameConfig,
  state: AccountState,
  now: number,
): Result<{ state: AccountState; granted: Rewards }> {
  const tuning = towerTuning(config);
  const rolled = rollTower(state.pve.tower, dayKey(now), weekKey(now));
  if (!canSweep(rolled, tuning)) return fail('daily_limit', 'no tower sweeps left today');
  const granted = towerFloorReward(rolled.floor, tuning);
  const next = applyGrant(config, { ...state, pve: { ...state.pve, tower: spendSweep(rolled) } }, granted);
  return ok({ state: next, granted });
}
