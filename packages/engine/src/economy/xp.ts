/**
 * Trainer XP and level (M5). Cumulative XP defines the level; the level is
 * always derived so it can never drift out of sync with `profile.xp`.
 */

export interface XpCurve {
  base: number;
  exponent: number;
  maxLevel: number;
}

/** XP required to advance from `level` to `level + 1`. */
export function xpToAdvance(level: number, curve: XpCurve): number {
  return Math.round(curve.base * Math.pow(level, curve.exponent));
}

/** Total XP required to reach `level` (level 1 => 0). */
export function xpForLevel(level: number, curve: XpCurve): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToAdvance(l, curve);
  return total;
}

/** The level a cumulative XP total maps to, capped at `curve.maxLevel`. */
export function levelForXp(xp: number, curve: XpCurve): number {
  let level = 1;
  let spent = 0;
  while (level < curve.maxLevel) {
    const step = xpToAdvance(level, curve);
    if (spent + step > Math.max(0, xp)) break;
    spent += step;
    level += 1;
  }
  return level;
}

/** Progress within the current level, for a HUD bar. */
export function levelProgress(xp: number, curve: XpCurve): { level: number; into: number; need: number } {
  const level = levelForXp(xp, curve);
  const into = Math.max(0, xp) - xpForLevel(level, curve);
  const need = level >= curve.maxLevel ? 0 : xpToAdvance(level, curve);
  return { level, into, need };
}
