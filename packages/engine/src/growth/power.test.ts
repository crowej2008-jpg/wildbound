import { describe, expect, it } from 'vitest';
import type { CoreStats } from '../model';
import { computePower, teamPower } from './power';
import type { PowerWeights } from './types';

const weights: PowerWeights = {
  core: { hp: 10, pAtk: 18, sAtk: 18, spd: 0, pDef: 20, sDef: 20 },
  percent: {
    crit: { powerRate: 35, extRate: 10 },
    critRes: { powerRate: 55, extRate: 22 },
    dmgBoost: { powerRate: 30, extRate: 12 },
  },
  scale: 10000,
};

const core: CoreStats = { hp: 1000, pAtk: 100, sAtk: 0, spd: 999, pDef: 0, sDef: 0 };

describe('computePower', () => {
  it('sums core contributions with zero percent lines (spd is weightless)', () => {
    expect(computePower(core, {}, weights)).toBe(1000 + 180);
  });

  it('applies additive and extension terms for percent lines', () => {
    const expected = Math.floor((1000 + 180) * (1 + (10 / 100000) * (0.35 * 10000)) + (35 / 10) * (0.35 * 10000));
    expect(computePower(core, { crit: 0.35 }, weights)).toBe(expected);
  });

  it('ignores percent lines that have no weighting row', () => {
    expect(computePower(core, { counterBoost: 0.5 }, weights)).toBe(1000 + 180);
  });

  it('increases monotonically with percent values', () => {
    const low = computePower(core, { crit: 0.1 }, weights);
    const high = computePower(core, { crit: 0.5 }, weights);
    expect(high).toBeGreaterThan(low);
  });

  it('is deterministic and integer-valued', () => {
    const a = computePower(core, { crit: 0.2, dmgBoost: 0.3 }, weights);
    const b = computePower(core, { crit: 0.2, dmgBoost: 0.3 }, weights);
    expect(a).toBe(b);
    expect(Number.isInteger(a)).toBe(true);
  });
});

describe('teamPower', () => {
  it('sums member power', () => {
    expect(teamPower([100, 250, 33])).toBe(383);
    expect(teamPower([])).toBe(0);
  });
});
