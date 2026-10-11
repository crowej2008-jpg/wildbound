import { describe, expect, it } from 'vitest';
import type { CoreStats } from '../model';
import { evolutionMult, levelCap, levelCurve, resolveCoreStats, starMult } from './stats';
import type { GrowthTables } from './types';

const tables: GrowthTables = {
  maxLevelByStage: [60, 80, 100, 140],
  maxStars: 10,
  levelGrowth: 0.022,
  starStep: 0.12,
  evolutionMult: [1.0, 1.18, 1.4, 1.65],
  qualityMult: { common: 1.0, rare: 1.12, epic: 1.3, legendary: 1.5, supreme: 1.75, mythic: 2.0 },
};

const base: CoreStats = { hp: 800, pAtk: 110, sAtk: 50, spd: 100, pDef: 55, sDef: 50 };

describe('growth factors', () => {
  it('levelCurve starts at 1 at level 1 and grows linearly', () => {
    expect(levelCurve(1, tables)).toBe(1);
    expect(levelCurve(11, tables)).toBeCloseTo(1 + 10 * 0.022, 10);
  });

  it('clamps negative/zero levels to the level-1 curve', () => {
    expect(levelCurve(0, tables)).toBe(1);
    expect(levelCurve(-5, tables)).toBe(1);
  });

  it('starMult starts at 1 at 1 star and steps per star', () => {
    expect(starMult(1, tables)).toBe(1);
    expect(starMult(5, tables)).toBeCloseTo(1 + 4 * 0.12, 10);
    expect(starMult(0, tables)).toBe(1);
  });

  it('evolutionMult indexes by stage and clamps overflow', () => {
    expect(evolutionMult(0, tables)).toBe(1.0);
    expect(evolutionMult(2, tables)).toBe(1.4);
    expect(evolutionMult(9, tables)).toBe(1.65);
  });

  it('levelCap follows the per-stage table and clamps', () => {
    expect(levelCap(0, tables)).toBe(60);
    expect(levelCap(3, tables)).toBe(140);
    expect(levelCap(8, tables)).toBe(140);
  });
});

describe('resolveCoreStats', () => {
  it('is the base at level 1, star 1, stage 0, common', () => {
    expect(resolveCoreStats({ base, level: 1, stars: 1, stage: 0, tier: 'common' }, tables)).toEqual(base);
  });

  it('multiplies every factor and rounds', () => {
    const out = resolveCoreStats({ base, level: 11, stars: 2, stage: 1, tier: 'rare' }, tables);
    const factor = (1 + 10 * 0.022) * (1 + 1 * 0.12) * 1.18 * 1.12;
    expect(out.hp).toBe(Math.round(800 * factor));
    expect(out.pAtk).toBe(Math.round(110 * factor));
    expect(out.sDef).toBe(Math.round(50 * factor));
  });

  it('produces strictly larger stats for higher tier at the same growth', () => {
    const common = resolveCoreStats({ base, level: 20, stars: 1, stage: 0, tier: 'common' }, tables);
    const mythic = resolveCoreStats({ base, level: 20, stars: 1, stage: 0, tier: 'mythic' }, tables);
    expect(mythic.hp).toBeGreaterThan(common.hp);
    expect(mythic.sAtk).toBeGreaterThan(common.sAtk);
  });
});
