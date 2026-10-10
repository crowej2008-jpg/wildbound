import { describe, expect, it } from 'vitest';
import { mulberry32, randInt } from './rng';

describe('mulberry32', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 100 }, () => a());
    const seqB = Array.from({ length: 100 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('diverges for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('always returns values in [0, 1)', () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('has roughly uniform output across a 10k draw', () => {
    const rng = mulberry32(7);
    let sum = 0;
    for (let i = 0; i < 10_000; i++) sum += rng();
    const mean = sum / 10_000;
    // Loose sanity band: a uniform [0,1) mean is 0.5 ± ~0.015 for 10k draws.
    expect(mean).toBeGreaterThan(0.46);
    expect(mean).toBeLessThan(0.54);
  });
});

describe('randInt', () => {
  it('returns integers in [0, n)', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 1_000; i++) {
      const v = randInt(rng, 6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
  });

  it('rejects non-positive bounds', () => {
    const rng = () => 0.5;
    expect(() => randInt(rng, 0)).toThrow(RangeError);
    expect(() => randInt(rng, -1)).toThrow(RangeError);
  });
});