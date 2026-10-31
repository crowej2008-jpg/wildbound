import {
  bestThreeStarStage,
  exploreAccess,
  floorChestClaimable,
  nextSkyPillarStage,
  recordSkyPillarStars,
  replayTo,
  rollSkyPillar,
  spendSkyPillarProof,
  stageStars,
  stageUnlocked,
  starsForBattle,
  type AccountState,
  type ExploreGateStatus,
  type Rewards,
  type SkyPillarBattleFacts,
  type SkyPillarFloorRule,
  type SkyPillarRules,
  type SkyPillarState,
} from '@wildbound/engine';
import { modeBattle, type BattleView } from './battle';
import { applyGrant } from './economy';
import { fail, ok, type Result } from './index';
import type { GameConfig } from './config';
import { enemiesFor, type BattleOutcome } from './pve/shared';

/**
 * Sky Pillar (M13.2): 180 floors x 10 stages, proofs, star grading and sweeps.
 * Pure rule decisions live in the engine; this module binds them to content,
 * battles and account rewards. See docs/design/sky-pillar.md.
 */

export interface SkyPillarBattleExtra {
  floor: number;
  stage: number;
  /** The run's grade, 0-3. */
  stars: number;
  /** The stage's best recorded grade after this run. */
  bestStars: number;
  firstClear: boolean;
}

export interface SkyPillarSweep {
  state: AccountState;
  granted: Rewards;
  floor: number;
  stage: number;
}

export function skyPillarRules(config: GameConfig): SkyPillarRules {
  return config.skyPillar;
}

export function skyPillarFloor(
  config: GameConfig,
  floor: number,
): SkyPillarFloorRule | undefined {
  return config.skyPillar.floors.find((row) => row.floor === floor);
}

/** The mode gate from the Explore table, or null when the mode itself is missing. */
export function skyPillarGate(
  config: GameConfig,
  state: AccountState,
  now: number,
): ExploreGateStatus[] | null {
  const mode = config.explore.modes.find((candidate) => candidate.id === 'sky-pillar');
  if (!mode) return null;
  const access = exploreAccess(mode.gates, {
    campaign: state.campaign,
    level: state.profile.level,
    serverDay: Math.floor((now - state.serverEpoch) / 86_400_000) + 1,
  });
  return access.unlocked ? access.gates : null;
}

/** Roll proofs once; `changed` tells the caller to persist the lazy recharge. */
export function prepareSkyPillar(
  config: GameConfig,
  state: AccountState,
  now: number,
): { state: AccountState; changed: boolean } {
  const rolled = rollSkyPillar(state.skyPillar, config.skyPillar, now);
  return rolled === state.skyPillar
    ? { state, changed: false }
    : { state: { ...state, skyPillar: rolled }, changed: true };
}

function battleFacts(battle: BattleView): SkyPillarBattleFacts {
  const final = replayTo(battle.units, battle.events, battle.events.length);
  const attackers = final.units.filter((unit) => unit.side === 'attackers');
  const alive = attackers.filter((unit) => unit.alive && unit.maxHp > 0);
  return {
    win: battle.winner === 'attackers',
    rounds: battle.rounds,
    knockouts: attackers.filter((unit) => !unit.alive).length,
    minHpPercent:
      alive.length > 0
        ? Math.min(...alive.map((unit) => (unit.hp / unit.maxHp) * 100))
        : 0,
  };
}

export function challengeSkyPillar(
  config: GameConfig,
  state: AccountState,
  now: number,
  floor: number,
  stage: number,
  seed?: number,
): Result<BattleOutcome<SkyPillarBattleExtra>> {
  if (!skyPillarGate(config, state, now)) {
    return fail('resource_locked', 'Sky Pillar is not open yet');
  }
  const rule = skyPillarFloor(config, floor);
  const stageRule = rule?.stages.find((row) => row.stage === stage);
  if (!rule || !stageRule) return fail('not_found', 'that Sky Pillar stage does not exist');
  const rolled = rollSkyPillar(state.skyPillar, config.skyPillar, now);
  if (!stageUnlocked(rolled, config.skyPillar, floor, stage, state.profile.level)) {
    return fail('stage_locked', 'clear the previous stage or floor first');
  }
  const alreadyPassed = stageStars(rolled, floor, stage) > 0;
  if (!alreadyPassed && rolled.proofs < 1) {
    return fail('daily_limit', 'no Proofs of Sky left');
  }
  const spent = alreadyPassed ? rolled : spendSkyPillarProof(rolled, config.skyPillar, now);
  const enemies = enemiesFor(config, rule.enemy, floor - 1);
  const battle = modeBattle(config, state, {
    squadMode: 'skyPillar',
    label: 'skyPillarStage',
    enemies,
    battleId: `m13:sky:${floor}:${stage}`,
    rules: { roundLimit: config.skyPillar.roundLimit },
    seed,
  });
  if (!battle) return fail('not_found', 'no Wilds available to climb');

  const stars = starsForBattle(stageRule.conditions, battleFacts(battle));
  const revised = recordSkyPillarStars(spent, floor, stage, stars);
  const firstClear = !alreadyPassed && stars > 0;
  const rewards = firstClear ? stageRule.pass : {};
  const next = applyGrant(config, { ...state, skyPillar: revised }, rewards);
  return ok({
    state: next,
    battle,
    win: battle.winner === 'attackers',
    rewards,
    extra: {
      floor,
      stage,
      stars,
      bestStars: revised.stars[`${floor}:${stage}`] ?? 0,
      firstClear,
    },
  });
}

/** Sweep the highest 3-star stage. A sweep always costs one proof. */
export function sweepSkyPillar(
  config: GameConfig,
  state: AccountState,
  now: number,
): Result<SkyPillarSweep> {
  if (!skyPillarGate(config, state, now)) {
    return fail('resource_locked', 'Sky Pillar is not open yet');
  }
  const rolled = rollSkyPillar(state.skyPillar, config.skyPillar, now);
  const target = bestThreeStarStage(rolled, config.skyPillar);
  if (!target) return fail('not_ready', 'no stage has reached three stars yet');
  if (rolled.proofs < 1) return fail('daily_limit', 'no Proofs of Sky left');
  const granted = target.stage.sweep;
  const spent = spendSkyPillarProof(rolled, config.skyPillar, now);
  const next = applyGrant(config, { ...state, skyPillar: spent }, granted);
  return ok({ state: next, granted, floor: target.floor.floor, stage: target.stage.stage });
}

export function claimSkyPillarChest(
  config: GameConfig,
  state: AccountState,
  floor: number,
  stars: number,
): Result<{ state: AccountState; reward: Rewards }> {
  const rule = skyPillarFloor(config, floor);
  const chest = rule?.chests.find((row) => row.stars === stars);
  if (!rule || !chest) return fail('not_found', 'that Sky Pillar chest does not exist');
  if (!floorChestClaimable(state.skyPillar, rule, chest)) {
    return fail('not_ready', 'that floor chest is not ready');
  }
  const key = `${floor}:${stars}`;
  const next: AccountState = {
    ...state,
    skyPillar: {
      ...state.skyPillar,
      claimedChests: [...state.skyPillar.claimedChests, key],
    },
  };
  return ok({ state: applyGrant(config, next, chest.rewards), reward: chest.rewards });
}

/** The first stage the player should fight, for the view's default selection. */
export function skyPillarNextStage(
  state: AccountState,
  rules: SkyPillarRules,
): { floor: number; stage: number } {
  return nextSkyPillarStage(state.skyPillar, rules) ?? { floor: 1, stage: 1 };
}

/** A pure progress summary reused by the view and tests. */
export function skyPillarProgress(
  state: SkyPillarState,
  rules: SkyPillarRules,
): { stars: number; cleared: number; total: number } {
  let stars = 0;
  let cleared = 0;
  for (const floor of rules.floors) {
    for (const stage of floor.stages) {
      const score = Math.max(0, Math.min(3, state.stars[`${floor.floor}:${stage.stage}`] ?? 0));
      stars += score;
      if (score > 0) cleared += 1;
    }
  }
  return { stars, cleared, total: rules.floors.length * 10 };
}
