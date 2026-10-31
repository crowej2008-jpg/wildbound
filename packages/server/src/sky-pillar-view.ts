import {
  bestThreeStarStage,
  exploreAccess,
  floorCleared,
  floorChestClaimable,
  floorStarTotal,
  nextSkyPillarProofMs,
  nextSkyPillarStage,
  stageStars,
  stageUnlocked,
  type AccountState,
  type ExploreGateStatus,
  type Rewards,
  type SkyPillarCondition,
  type SkyPillarRules,
} from '@wildbound/engine';
import type { GameConfig } from './config';

/** Display-ready Sky Pillar view (M13.2). Pure reads; no claims happen here. */

export interface SkyPillarConditionView {
  kind: SkyPillarCondition['kind'];
  value: number;
}

export interface SkyPillarStageView {
  stage: number;
  unlocked: boolean;
  /** Best recorded grade, 0-3. */
  stars: number;
  pass: Rewards;
  sweep: Rewards;
  conditions: SkyPillarConditionView[];
}

export interface SkyPillarChestView {
  stars: number;
  rewards: Rewards;
  claimed: boolean;
  claimable: boolean;
}

export interface SkyPillarFloorView {
  floor: number;
  wing: number;
  wingName: string;
  playerLevel: number;
  unlocked: boolean;
  cleared: boolean;
  stars: number;
  maxStars: number;
  chests: SkyPillarChestView[];
  /** Ten best grades, in stage order. */
  stageStars: number[];
  nextStage: number | null;
}

export interface SkyPillarFloorDetail extends SkyPillarFloorView {
  stages: SkyPillarStageView[];
}

export interface SkyPillarSweepView {
  floor: number;
  stage: number;
  rewards: Rewards;
}

export interface SkyPillarView {
  unlocked: boolean;
  gates: ExploreGateStatus[];
  proofs: number;
  maxProofs: number;
  nextProofMs: number;
  /** Next unpassed stage, or null when the tower is complete. */
  nextStage: { floor: number; stage: number } | null;
  selectedFloor: number;
  floors: SkyPillarFloorView[];
  detail: SkyPillarFloorDetail | null;
  canSweep: boolean;
  bestSweep: SkyPillarSweepView | null;
  totalStars: number;
  clearedStages: number;
  totalStages: number;
  roundLimit: number;
  /** Current trainer level, used to explain a locked floor. */
  playerLevel: number;
}

function chestViews(
  state: AccountState,
  rules: SkyPillarRules,
  floor: SkyPillarRules['floors'][number],
): SkyPillarChestView[] {
  return floor.chests.map((chest) => ({
    stars: chest.stars,
    rewards: chest.rewards,
    claimed: state.skyPillar.claimedChests.includes(`${floor.floor}:${chest.stars}`),
    claimable: floorChestClaimable(state.skyPillar, floor, chest),
  }));
}

function floorView(
  state: AccountState,
  rules: SkyPillarRules,
  floor: SkyPillarRules['floors'][number],
  wingNames: Map<number, string>,
): SkyPillarFloorView {
  const stageStarsList = floor.stages.map((stage) =>
    stageStars(state.skyPillar, floor.floor, stage.stage),
  );
  return {
    floor: floor.floor,
    wing: floor.wing,
    wingName: wingNames.get(floor.wing) ?? `Wing ${floor.wing}`,
    playerLevel: floor.playerLevel,
    unlocked: stageUnlocked(state.skyPillar, rules, floor.floor, 1, state.profile.level),
    cleared: floorCleared(state.skyPillar, floor.floor, floor.stages.length),
    stars: floorStarTotal(state.skyPillar, floor.floor, floor.stages.length),
    maxStars: floor.stages.length * 3,
    chests: chestViews(state, rules, floor),
    stageStars: stageStarsList,
    nextStage:
      floor.stages.find((stage) => stageStars(state.skyPillar, floor.floor, stage.stage) === 0)?.stage ??
      null,
  };
}

export function buildSkyPillarView(
  config: GameConfig,
  state: AccountState,
  now: number,
  requestedFloor?: number,
): SkyPillarView {
  const rules = config.skyPillar;
  const wingNames = new Map(rules.wings.map((wing) => [wing.wing, wing.name]));
  const next = nextSkyPillarStage(state.skyPillar, rules);
  const mode = config.explore.modes.find((candidate) => candidate.id === 'sky-pillar');
  const access = mode
    ? exploreAccess(mode.gates, {
        campaign: state.campaign,
        level: state.profile.level,
        serverDay: Math.floor((now - state.serverEpoch) / 86_400_000) + 1,
      })
    : { unlocked: false, gates: [] };
  const floor =
    rules.floors.find((row) => row.floor === requestedFloor) ??
    rules.floors.find((row) => row.floor === next?.floor) ??
    rules.floors[0]!;
  const summary = floorView(state, rules, floor, wingNames);
  const detail: SkyPillarFloorDetail = {
    ...summary,
    stages: floor.stages.map((stage) => ({
      stage: stage.stage,
      unlocked: stageUnlocked(state.skyPillar, rules, floor.floor, stage.stage, state.profile.level),
      stars: stageStars(state.skyPillar, floor.floor, stage.stage),
      pass: stage.pass,
      sweep: stage.sweep,
      conditions: stage.conditions.map((condition) => ({ kind: condition.kind, value: condition.value })),
    })),
  };
  const sweep = bestThreeStarStage(state.skyPillar, rules);
  let totalStars = 0;
  let clearedStages = 0;
  for (const row of rules.floors) {
    for (const stage of row.stages) {
      const score = stageStars(state.skyPillar, row.floor, stage.stage);
      totalStars += score;
      if (score > 0) clearedStages += 1;
    }
  }
  return {
    unlocked: access.unlocked,
    gates: access.gates,
    proofs: state.skyPillar.proofs,
    maxProofs: rules.maxProofs,
    nextProofMs: nextSkyPillarProofMs(state.skyPillar, rules, now),
    nextStage: next,
    selectedFloor: floor.floor,
    floors: rules.floors.map((row) => floorView(state, rules, row, wingNames)),
    detail,
    canSweep: sweep !== null && state.skyPillar.proofs > 0,
    bestSweep: sweep
      ? { floor: sweep.floor.floor, stage: sweep.stage.stage, rewards: sweep.stage.sweep }
      : null,
    totalStars,
    clearedStages,
    totalStages: rules.floors.length * 10,
    roundLimit: rules.roundLimit,
    playerLevel: state.profile.level,
  };
}
