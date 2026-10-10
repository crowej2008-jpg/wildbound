/**
 * Seeded PRNG for the deterministic engine.
 *
 * Rule: the engine never calls `Math.random`. All randomness flows through an
 * injected `Rng` produced by `mulberry32`, so the same seed reproduces the
 * same battle/gacha/economy outcome exactly.
 */
export type Rng = () => number;

/**
 * mulberry32 — a small, fast, good-enough 32-bit seeded PRNG.
 *
 * Accepts any number; the seed is normalised with `>>> 0` so it is stable
 * across platforms (JS numbers are doubles, so bitwise ops are well defined).
 * Returns values in [0, 1).
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function rng(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draw an integer in [0, n) from an Rng. `n` must be positive.
 */
export function randInt(rng: Rng, n: number): number {
  if (!Number.isInteger(n) || n <= 0) {
    throw new RangeError(`randInt requires a positive integer bound, got ${n}`);
  }
  return Math.floor(rng() * n);
}