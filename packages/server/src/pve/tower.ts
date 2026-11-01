import {
  addRewards,
  advanceTower,
  canClimb,
  canSweep,
  dayKey,
  nextTowerFloor,
  rollTower,
  spendClimb,
  spendSweep,
  towerFloorReward,
  type AccountState,
  type Rewards,
  type TowerKind,
} from '@wildbound/engine';
import type { TowerSourceJson } from '@wildbound/content';
import { modeBattle } from '../battle';
import { applyGrant } from '../economy';
import { fail, ok, type Result } from '../index';
import type { GameConfig } from '../config';
import { grantTitleCards } from '../titles';
import { enemiesFor, towerTuning, type BattleOutcome } from './shared';

/**
 * The Pokémon Tower (M8; R9 from the source, packages/content/tuning/tower.json). Normal (1,000 floors) and Hard
 * (750 floors in stages of five, each stage with its lineup rule); the climbs reset daily. A floor's first clear
 * pays the stand-in floor reward plus the source achievement on the floors that have one (Pokémon Shards, Premium
 * Tickets, boxes, species shards, the Hard tower's Beginner → Master Trainer title cards). ASSUMPTIONS #79.
 */

export type TowerExtra = { floor: number; kind: TowerKind; sweepsLeft: number };

type Payout = TowerSourceJson['normal'][number];

/** The source achievement on a floor, if any. */
export function towerAchievement(config: GameConfig, kind: TowerKind, floor: number): Payout | undefined {
  return (kind === 'hard' ? config.tower.hard : config.tower.normal).find((r) => r.floor === floor);
}

/** The Hard stage's lineup rule for a floor (stages of five). */
export function hardTowerRule(config: GameConfig, floor: number) {
  const stage = Math.ceil(floor / config.tower.hardStageFloors);
  return config.tower.hard.find((r) => r.stage === stage)?.rule;
}

function payAchievement(config: GameConfig, state: AccountState, payout: Payout | undefined): AccountState {
  if (!payout) return state;
  let next = state;
  if (payout.speciesShards) {
    const shards = { ...next.speciesShards };
    for (const [id, n] of Object.entries(payout.speciesShards)) shards[id] = (shards[id] ?? 0) + n;
    next = { ...next, speciesShards: shards };
  }
  if (payout.titleCard) next = grantTitleCards(next, payout.titleCard, 1);
  return next;
}

export function challengeTower(
  config: GameConfig,
  state: AccountState,
  now: number,
  seed?: number,
  kind: TowerKind = 'normal',
): Result<BattleOutcome<TowerExtra>> {
  const tuning = towerTuning(config);
  const rolled = rollTower(state.pve.tower, dayKey(now));
  if (!canClimb(rolled, tuning, kind)) return fail('daily_limit', 'no tower climbs left today');
  const floor = nextTowerFloor(rolled, kind);
  // The Hard tower's enemies stand in a step above the Normal curve (its floors are not in the dumps).
  const enemies = enemiesFor(config, config.pve.tower.enemy, kind === 'hard' ? floor * 2 - 1 : floor - 1);
  const rule = kind === 'hard' ? hardTowerRule(config, floor) : undefined;
  const battle = modeBattle(config, state, {
    squadMode: 'tower',
    label: 'towerFloor',
    enemies,
    battleId: `r9:tower:${kind}:${floor}`,
    seed,
    ...(rule ? { lineupRule: rule } : {}),
  });
  if (!battle) return fail('not_found', 'no Pokémon available to climb');
  const win = battle.winner === 'attackers';

  let next: AccountState = { ...state, pve: { ...state.pve, tower: win ? advanceTower(rolled, floor, kind) : spendClimb(rolled, kind) } };
  let rewards: Rewards = {};
  if (win) {
    const achievement = towerAchievement(config, kind, floor);
    rewards = addRewards(towerFloorReward(floor, tuning), achievement?.rewards ?? {});
    next = payAchievement(config, applyGrant(config, next, rewards), achievement);
  }
  return ok({
    state: next,
    battle,
    win,
    rewards,
    extra: { floor, kind, sweepsLeft: tuning.sweepsPerDay - rolled.sweepsToday },
  });
}

export function sweepTower(
  config: GameConfig,
  state: AccountState,
  now: number,
): Result<{ state: AccountState; granted: Rewards }> {
  const tuning = towerTuning(config);
  const rolled = rollTower(state.pve.tower, dayKey(now));
  if (!canSweep(rolled, tuning)) return fail('daily_limit', 'no tower sweeps left today');
  const granted = towerFloorReward(rolled.floor, tuning);
  const next = applyGrant(config, { ...state, pve: { ...state.pve, tower: spendSweep(rolled) } }, granted);
  return ok({ state: next, granted });
}
