import type { BuffSpec } from './types';

/**
 * Level ladders (M9). A talent or rider may carry `scalesWithLevel: [level, value][]`;
 * the value is the last step at or below the holder's level (a step function).
 * Without a ladder the flat value is used, so the M1 content is unaffected.
 */
export function levelScale(
  base: number | undefined,
  ladder: [number, number][] | undefined,
  level: number,
): number | undefined {
  if (!ladder || ladder.length === 0) return base;
  let value = ladder[0]![1];
  for (const [at, v] of ladder) {
    if (level >= at) value = v;
  }
  return value;
}

/** Resolve a buff's `amount` against the caster's level (a no-op without a ladder). */
export function scaleBuff(spec: BuffSpec, level: number): BuffSpec {
  if (!spec.scalesWithLevel) return spec;
  return { ...spec, amount: levelScale(spec.amount, spec.scalesWithLevel, level) };
}
