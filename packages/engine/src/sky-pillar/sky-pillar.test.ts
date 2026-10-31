import { describe, expect, it } from 'vitest';
import {
  bestThreeStarStage,
  floorChestClaimable,
  floorStarTotal,
  initialSkyPillar,
  nextSkyPillarProofMs,
  rollSkyPillar,
  spendSkyPillarProof,
  starsForBattle,
  stageUnlocked,
  nextSkyPillarStage,
  recordSkyPillarStars,
} from './index';
import type { SkyPillarFloorRule, SkyPillarRules } from './types';

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 29);

function floorRule(floor: number, playerLevel: number): SkyPillarFloorRule {
  return {
    floor,
    wing: 1,
    playerLevel,
    enemy: {
      factions: [],
      tiers: [],
      count: 1,
      baseLevel: 1,
      levelSlope: 1,
      starsEvery: 0,
      maxStars: 1,
      stageEvery: 0,
      maxStage: 0,
    },
    stages: [1, 2].map((stage) => ({
      stage,
      pass: { potentialShard: floor * 100 + stage },
      sweep: { potentialShard: Math.floor((floor * 100 + stage) / 2) },
      conditions: [
        { kind: 'knockoutsAtMost' as const, value: 2 },
        { kind: 'roundsAtMost' as const, value: 4 },
      ],
    })),
    chests: [4, 8, 12].map((stars) => ({ stars, rewards: { gems: stars } })),
  };
}

const rules: SkyPillarRules = {
  maxProofs: 6,
  regenMinutes: 480,
  initialProofs: 6,
  roundLimit: 15,
  floors: [floorRule(1, 1), floorRule(2, 5)],
};

describe('Sky Pillar rules', () => {
  it('recharges one proof every eight hours and stops at the cap', () => {
    const initial = initialSkyPillar(NOW, rules);
    expect(initial.proofs).toBe(6);
    expect(nextSkyPillarProofMs(initial, rules, NOW)).toBe(0);

    const spent = spendSkyPillarProof(initial, rules, NOW);
    expect(spent.proofs).toBe(5);
    expect(nextSkyPillarProofMs(spent, rules, NOW + 2 * HOUR)).toBe(6 * HOUR);

    const recharged = rollSkyPillar(spent, rules, NOW + 8 * HOUR);
    expect(recharged.proofs).toBe(6);
    expect(recharged.lastProofAt).toBe(NOW + 8 * HOUR);

    const held = rollSkyPillar(recharged, rules, NOW + 40 * HOUR);
    expect(held).toBe(recharged);

    const aboveCap = { ...recharged, proofs: 9 };
    expect(rollSkyPillar(aboveCap, rules, NOW + 40 * HOUR)).toBe(aboveCap);
    const aboveSpent = spendSkyPillarProof(aboveCap, rules, NOW + 40 * HOUR);
    expect(aboveSpent.proofs).toBe(8);
    expect(aboveSpent.lastProofAt).toBe(NOW + 40 * HOUR);
  });

  it('unlocks stages in order and gates the next floor on the previous sweep', () => {
    let state = initialSkyPillar(NOW, rules);
    expect(stageUnlocked(state, rules, 1, 1, 1)).toBe(true);
    expect(stageUnlocked(state, rules, 1, 2, 1)).toBe(false);
    expect(stageUnlocked(state, rules, 2, 1, 1)).toBe(false);

    state = recordSkyPillarStars(state, 1, 1, 2);
    expect(stageUnlocked(state, rules, 1, 2, 1)).toBe(true);
    expect(stageUnlocked(state, rules, 2, 1, 4)).toBe(false);

    state = recordSkyPillarStars(state, 1, 2, 1);
    expect(stageUnlocked(state, rules, 2, 1, 4)).toBe(false);
    expect(stageUnlocked(state, rules, 2, 1, 5)).toBe(true);
    expect(nextSkyPillarStage(state, rules)).toEqual({ floor: 2, stage: 1 });
  });

  it('grades a win from its extra conditions and keeps the best record', () => {
    const conditions = rules.floors[0]!.stages[0]!.conditions;
    expect(starsForBattle(conditions, { win: false, rounds: 1, knockouts: 0, minHpPercent: 100 })).toBe(0);
    expect(starsForBattle(conditions, { win: true, rounds: 5, knockouts: 3, minHpPercent: 100 })).toBe(1);
    expect(starsForBattle(conditions, { win: true, rounds: 4, knockouts: 3, minHpPercent: 100 })).toBe(2);
    expect(starsForBattle(conditions, { win: true, rounds: 4, knockouts: 2, minHpPercent: 100 })).toBe(3);
    expect(
      starsForBattle(
        [{ kind: 'hpAtLeast', value: 30 }],
        { win: true, rounds: 1, knockouts: 0, minHpPercent: 29.9 },
      ),
    ).toBe(1);

    let state = recordSkyPillarStars(initialSkyPillar(NOW, rules), 1, 1, 2);
    expect(state.stars['1:1']).toBe(2);
    const same = recordSkyPillarStars(state, 1, 1, 1);
    expect(same).toBe(state);
    state = recordSkyPillarStars(state, 1, 1, 3);
    expect(state.stars['1:1']).toBe(3);
  });

  it('finds the highest 3-star sweep target and its floor chests', () => {
    let state = initialSkyPillar(NOW, rules);
    expect(bestThreeStarStage(state, rules)).toBeNull();
    state = recordSkyPillarStars(state, 1, 1, 3);
    state = recordSkyPillarStars(state, 2, 1, 3);
    expect(bestThreeStarStage(state, rules)?.floor.floor).toBe(2);
    expect(floorStarTotal(state, 1, 2)).toBe(3);
    expect(floorChestClaimable(state, rules.floors[0]!, rules.floors[0]!.chests[0]!)).toBe(false);
    state = recordSkyPillarStars(state, 1, 2, 3);
    expect(floorStarTotal(state, 1, 2)).toBe(6);
    expect(floorChestClaimable(state, rules.floors[0]!, rules.floors[0]!.chests[0]!)).toBe(true);
    const claimed = {
      ...state,
      claimedChests: [...state.claimedChests, '1:4'],
    };
    expect(floorChestClaimable(claimed, rules.floors[0]!, rules.floors[0]!.chests[0]!)).toBe(false);
  });
});
