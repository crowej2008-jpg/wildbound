import { describe, expect, it } from 'vitest';
import {
  bestIdleStage,
  gateOf,
  isCleared,
  isGymAvailable,
  isGymCleared,
  isUnlocked,
  maxStars,
  nextStageId,
  orderStages,
  recordGymClear,
  recordStars,
  starsForRounds,
  totalStars,
  unmetGate,
  type CampaignProgress,
  type StageDef,
} from './index';

function stage(id: string, chapter: number, index: number, idleGold: number): StageDef {
  return {
    id,
    chapter,
    index,
    name: id,
    enemies: [],
    firstClear: { gold: 100, xp: 10 },
    repeat: { gold: 20 },
    idlePerMinute: { gold: idleGold, candy: idleGold },
    starRounds: [3, 6],
  };
}

const STAGES: StageDef[] = [
  stage('c1-1', 1, 1, 1),
  stage('c1-2', 1, 2, 2),
  stage('c2-1', 2, 1, 5),
  { ...stage('c3-1', 3, 1, 6), gate: { gymId: 'gym-1' } },
];
const ORDERED = orderStages(STAGES);
const empty: CampaignProgress = { stars: {} };

describe('campaign', () => {
  it('rates stars by rounds taken', () => {
    expect(starsForRounds(3, [3, 6])).toBe(3);
    expect(starsForRounds(6, [3, 6])).toBe(2);
    expect(starsForRounds(7, [3, 6])).toBe(1);
  });

  it('unlocks stages in order and finds the next target', () => {
    expect(isUnlocked(empty, ORDERED, 'c1-1')).toBe(true);
    expect(isUnlocked(empty, ORDERED, 'c1-2')).toBe(false);
    expect(nextStageId(empty, ORDERED)).toBe('c1-1');

    const after: CampaignProgress = { stars: { 'c1-1': 3 } };
    expect(isUnlocked(after, ORDERED, 'c1-2')).toBe(true);
    expect(isCleared(after, 'c1-1')).toBe(true);
    expect(nextStageId(after, ORDERED)).toBe('c1-2');
  });

  it('never lowers a recorded star count and totals them', () => {
    let p: CampaignProgress = { stars: {} };
    p = recordStars(p, 'c1-1', 1);
    p = recordStars(p, 'c1-1', 3);
    p = recordStars(p, 'c1-1', 2);
    expect(p.stars['c1-1']).toBe(3);
    expect(totalStars(p)).toBe(3);
    expect(maxStars(ORDERED)).toBe(12);
  });

  it('keeps a gated stage locked until its gym falls', () => {
    const cleared: CampaignProgress = { stars: { 'c1-1': 3, 'c1-2': 3, 'c2-1': 3 } };
    expect(gateOf(ORDERED[3]!)).toBe('gym-1');
    expect(unmetGate(cleared, ORDERED, 'c3-1')).toBe('gym-1');
    expect(isUnlocked(cleared, ORDERED, 'c3-1')).toBe(false);

    const gymCleared = recordGymClear(cleared, 'gym-1');
    expect(isGymCleared(gymCleared, 'gym-1')).toBe(true);
    expect(unmetGate(gymCleared, ORDERED, 'c3-1')).toBeNull();
    expect(isUnlocked(gymCleared, ORDERED, 'c3-1')).toBe(true);
  });

  it('opens a gym only after the stage before its gate is cleared', () => {
    expect(isGymAvailable(empty, ORDERED, 'gym-1')).toBe(false);
    const beforeGate: CampaignProgress = { stars: { 'c1-1': 3, 'c1-2': 3 } };
    expect(isGymAvailable(beforeGate, ORDERED, 'gym-1')).toBe(false);
    const ready: CampaignProgress = { stars: { ...beforeGate.stars, 'c2-1': 3 } };
    expect(isGymAvailable(ready, ORDERED, 'gym-1')).toBe(true);
    expect(isGymAvailable(recordGymClear(empty, 'gym-1'), ORDERED, 'gym-1')).toBe(true);
  });

  it('recording stars preserves gym clears', () => {
    const p = recordGymClear({ stars: {} }, 'gym-1');
    const next = recordStars(p, 'c3-1', 3);
    expect(next.gyms?.['gym-1']).toBe(true);
  });

  it('picks the cleared stage with the best idle rate', () => {
    expect(bestIdleStage(empty, ORDERED)).toBeNull();
    const p: CampaignProgress = { stars: { 'c1-1': 3, 'c1-2': 1 } };
    expect(bestIdleStage(p, ORDERED)?.id).toBe('c1-2');
    const p2: CampaignProgress = { stars: { 'c1-1': 3, 'c1-2': 1, 'c2-1': 1 } };
    expect(bestIdleStage(p2, ORDERED)?.id).toBe('c2-1');
  });
});
