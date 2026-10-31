import { describe, expect, it } from 'vitest';
import { SKY_PILLAR } from './tuning';

describe('Sky Pillar content', () => {
  it('ships 180 floors of 10 stages across six wings', () => {
    expect(SKY_PILLAR.floors).toHaveLength(180);
    expect(SKY_PILLAR.wings).toHaveLength(6);
    expect(SKY_PILLAR.floors.flatMap((floor) => floor.stages)).toHaveLength(1_800);
    expect(SKY_PILLAR.floors.map((floor) => floor.floor)).toEqual(
      Array.from({ length: 180 }, (_, index) => index + 1),
    );
    for (const floor of SKY_PILLAR.floors) {
      expect(floor.stages.map((stage) => stage.stage)).toEqual(
        Array.from({ length: 10 }, (_, index) => index + 1),
      );
      expect(floor.wing).toBe(Math.floor((floor.floor - 1) / 30) + 1);
      expect(floor.chests.map((chest) => chest.stars)).toEqual([10, 20, 30]);
      expect(floor.enemy.count).toBe(6);
    }
  });

  it('keeps player-level gates ascending and star conditions valid', () => {
    let previous = 0;
    for (const floor of SKY_PILLAR.floors) {
      expect(floor.playerLevel).toBeGreaterThanOrEqual(previous);
      expect(floor.playerLevel).toBeLessThanOrEqual(80);
      previous = floor.playerLevel;
      for (const stage of floor.stages) {
        expect(stage.conditions).toHaveLength(2);
        for (const condition of stage.conditions) {
          if (condition.kind === 'hpAtLeast') expect(condition.value).toBeGreaterThan(0);
          else expect(condition.value).toBeGreaterThan(0);
        }
      }
    }
  });

  it('pays a sweep at half the pass reward and grows with the floor', () => {
    let previous = 0;
    for (const floor of SKY_PILLAR.floors) {
      const first = floor.stages[0]!;
      const pass = first.pass.potentialShard ?? 0;
      const sweep = first.sweep.potentialShard ?? 0;
      expect(pass).toBeGreaterThan(0);
      expect(sweep).toBe(Math.floor(pass / 2));
      expect(pass).toBeGreaterThanOrEqual(previous);
      previous = pass;
    }
  });

  it('recharges proofs at the source cadence', () => {
    expect(SKY_PILLAR.maxProofs).toBe(6);
    expect(SKY_PILLAR.initialProofs).toBe(6);
    expect(SKY_PILLAR.regenMinutes).toBe(480);
  });
});
