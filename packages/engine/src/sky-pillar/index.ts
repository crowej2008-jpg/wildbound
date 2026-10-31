import type {
  SkyPillarBattleFacts,
  SkyPillarChestRule,
  SkyPillarCondition,
  SkyPillarFloorRule,
  SkyPillarRules,
  SkyPillarStageRef,
  SkyPillarStageRule,
  SkyPillarState,
} from './types';

export * from './types';

/**
 * Sky Pillar rules (M13.2). Pure functions over the save slice + content rules;
 * the server owns battles, persistence and reward grants. See
 * docs/design/sky-pillar.md.
 */

export function stageKey(floor: number, stage: number): string {
  return `${floor}:${stage}`;
}

export function chestKey(floor: number, stars: number): string {
  return `${floor}:${stars}`;
}

export function initialSkyPillar(
  now: number,
  rules?: Pick<SkyPillarRules, 'initialProofs'>,
): SkyPillarState {
  return {
    stars: {},
    proofs: Math.max(0, Math.floor(rules?.initialProofs ?? 6)),
    lastProofAt: now,
    claimedChests: [],
  };
}

/**
 * Lazy Proof of Sky recharge. One proof arrives every `regenMinutes` while
 * below `maxProofs`; a full purse stops the clock rather than banking time.
 */
export function rollSkyPillar(
  state: SkyPillarState,
  rules: Pick<SkyPillarRules, 'maxProofs' | 'regenMinutes'>,
  now: number,
): SkyPillarState {
  if (state.proofs >= rules.maxProofs) return state;
  const interval = Math.max(1, rules.regenMinutes) * 60_000;
  const elapsed = now - state.lastProofAt;
  if (!Number.isFinite(elapsed) || elapsed < interval) return state;
  const gained = Math.floor(elapsed / interval);
  const proofs = Math.min(rules.maxProofs, state.proofs + gained);
  const lastProofAt = proofs >= rules.maxProofs ? now : state.lastProofAt + gained * interval;
  return { ...state, proofs, lastProofAt };
}

/** Spend one proof; a full purse restarts its recharge at the spend moment. */
export function spendSkyPillarProof(
  state: SkyPillarState,
  rules: Pick<SkyPillarRules, 'maxProofs'>,
  now: number,
): SkyPillarState {
  if (state.proofs <= 0) return state;
  return {
    ...state,
    proofs: state.proofs - 1,
    lastProofAt: state.proofs >= rules.maxProofs ? now : state.lastProofAt,
  };
}

export function nextSkyPillarProofMs(
  state: SkyPillarState,
  rules: Pick<SkyPillarRules, 'maxProofs' | 'regenMinutes'>,
  now: number,
): number {
  if (state.proofs >= rules.maxProofs) return 0;
  const interval = Math.max(1, rules.regenMinutes) * 60_000;
  return Math.max(0, Math.min(interval, state.lastProofAt + interval - now));
}

export function stageStars(state: SkyPillarState, floor: number, stage: number): number {
  return Math.max(0, Math.min(3, state.stars[stageKey(floor, stage)] ?? 0));
}

export function floorStarTotal(state: SkyPillarState, floor: number, stageCount: number): number {
  let total = 0;
  for (let stage = 1; stage <= stageCount; stage += 1) total += stageStars(state, floor, stage);
  return total;
}

export function floorCleared(state: SkyPillarState, floor: number, stageCount: number): boolean {
  for (let stage = 1; stage <= stageCount; stage += 1) {
    if (stageStars(state, floor, stage) === 0) return false;
  }
  return true;
}

export function floorUnlocked(
  state: SkyPillarState,
  rules: SkyPillarRules,
  floor: number,
  playerLevel: number,
): boolean {
  const rule = rules.floors.find((row) => row.floor === floor);
  if (!rule) return false;
  if (playerLevel < rule.playerLevel) return false;
  if (floor <= 1) return true;
  const previous = rules.floors.find((row) => row.floor === floor - 1);
  if (!previous) return false;
  return floorCleared(state, previous.floor, previous.stages.length);
}

export function stageUnlocked(
  state: SkyPillarState,
  rules: SkyPillarRules,
  floor: number,
  stage: number,
  playerLevel: number,
): boolean {
  const rule = rules.floors.find((row) => row.floor === floor);
  if (!rule || stage < 1 || stage > rule.stages.length) return false;
  if (!floorUnlocked(state, rules, floor, playerLevel)) return false;
  if (stage === 1) return true;
  return stageStars(state, floor, stage - 1) > 0;
}

/** The first unpassed stage, in floor/stage order; null when all are cleared. */
export function nextSkyPillarStage(
  state: SkyPillarState,
  rules: SkyPillarRules,
): SkyPillarStageRef | null {
  for (const floor of rules.floors) {
    for (const stage of floor.stages) {
      if (stageStars(state, floor.floor, stage.stage) === 0) {
        return { floor: floor.floor, stage: stage.stage };
      }
    }
  }
  return null;
}

/** The highest stage with a 3-star record, or null when no sweep target exists. */
export function bestThreeStarStage(
  state: SkyPillarState,
  rules: SkyPillarRules,
): { floor: SkyPillarFloorRule; stage: SkyPillarStageRule } | null {
  for (let floorIndex = rules.floors.length - 1; floorIndex >= 0; floorIndex -= 1) {
    const floor = rules.floors[floorIndex]!;
    for (let stageIndex = floor.stages.length - 1; stageIndex >= 0; stageIndex -= 1) {
      const stage = floor.stages[stageIndex]!;
      if (stageStars(state, floor.floor, stage.stage) === 3) return { floor, stage };
    }
  }
  return null;
}

export function conditionMet(condition: SkyPillarCondition, facts: SkyPillarBattleFacts): boolean {
  switch (condition.kind) {
    case 'knockoutsAtMost':
      return facts.knockouts <= condition.value;
    case 'hpAtLeast':
      return facts.minHpPercent + 1e-9 >= condition.value;
    case 'roundsAtMost':
      return facts.rounds <= condition.value;
  }
}

/** A win is always 1 star; each additional condition adds one. */
export function starsForBattle(
  conditions: SkyPillarCondition[],
  facts: SkyPillarBattleFacts,
): number {
  if (!facts.win) return 0;
  return Math.min(3, 1 + conditions.filter((condition) => conditionMet(condition, facts)).length);
}

export function recordSkyPillarStars(
  state: SkyPillarState,
  floor: number,
  stage: number,
  stars: number,
): SkyPillarState {
  const key = stageKey(floor, stage);
  const current = state.stars[key] ?? 0;
  if (stars <= current) return state;
  return { ...state, stars: { ...state.stars, [key]: Math.min(3, stars) } };
}

export function floorChestClaimable(
  state: SkyPillarState,
  floor: SkyPillarFloorRule,
  chest: SkyPillarChestRule,
): boolean {
  const key = chestKey(floor.floor, chest.stars);
  return (
    !state.claimedChests.includes(key) &&
    floorStarTotal(state, floor.floor, floor.stages.length) >= chest.stars
  );
}
