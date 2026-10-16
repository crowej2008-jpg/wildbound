/**
 * Link Crystal (M8, PROMPT §7.1). Past the top evolution stage, a Wild's growth
 * is *shared*: the crystal holds one level and every top-stage Wild's level cap
 * becomes that level. The crystal's cap rises with how many Wilds sit at or above
 * `starThreshold` stars. Pure. See docs/design/pve-modes.md.
 */

export interface LinkCrystalTuning {
  /** Cap with zero qualifying Wilds (reference: 340). */
  baseCap: number;
  /** Extra cap per Wild at `starThreshold`+ stars (reference: 8). */
  perStarWild: number;
  /** Stars a Wild needs to raise the cap. */
  starThreshold: number;
  /** Level the crystal starts at once unlocked (the top stage cap). */
  initialLevel: number;
  candyBase: number;
  candyExponent: number;
  goldPerCandy: number;
  stonesPerLevel: number;
}

export interface LinkCrystalState {
  unlocked: boolean;
  level: number;
}

/** The per-Wild facts the crystal cares about. */
export interface CrystalWildInfo {
  stars: number;
  /** True when the Wild is in its species' final evolution stage. */
  atTopStage: boolean;
}

export interface CrystalCost {
  candy: number;
  gold: number;
  stones: number;
}

export function initialLinkCrystal(): LinkCrystalState {
  return { unlocked: false, level: 0 };
}

export function qualifies(wild: CrystalWildInfo, tuning: LinkCrystalTuning): boolean {
  return wild.stars >= tuning.starThreshold;
}

export function countQualifying(wilds: readonly CrystalWildInfo[], tuning: LinkCrystalTuning): number {
  return wilds.filter((w) => qualifies(w, tuning)).length;
}

/** `baseCap + perStarWild × qualifying count`. */
export function crystalCap(wilds: readonly CrystalWildInfo[], tuning: LinkCrystalTuning): number {
  return tuning.baseCap + tuning.perStarWild * countQualifying(wilds, tuning);
}

/** True once any Wild has reached its final evolution stage. */
export function isCrystalUnlocked(wilds: readonly CrystalWildInfo[]): boolean {
  return wilds.some((w) => w.atTopStage);
}

/** Cost to raise the crystal from `level` to `level + 1`. */
export function crystalUpgradeCost(level: number, tuning: LinkCrystalTuning): CrystalCost {
  const lv = Math.max(1, Math.floor(level));
  const candy = Math.round(tuning.candyBase * Math.pow(lv, tuning.candyExponent));
  return { candy, gold: candy * tuning.goldPerCandy, stones: tuning.stonesPerLevel };
}

/** The crystal can rise while it is unlocked and below the current cap. */
export function canUpgradeCrystal(
  state: LinkCrystalState,
  wilds: readonly CrystalWildInfo[],
  tuning: LinkCrystalTuning,
): boolean {
  return state.unlocked && state.level < crystalCap(wilds, tuning);
}

/**
 * Unlock the crystal the first time a top-stage Wild exists (level starts at the
 * tuning's `initialLevel`), otherwise return the state unchanged.
 */
export function maybeUnlockCrystal(
  state: LinkCrystalState,
  wilds: readonly CrystalWildInfo[],
  tuning: LinkCrystalTuning,
): LinkCrystalState {
  if (state.unlocked || !isCrystalUnlocked(wilds)) return state;
  return { unlocked: true, level: tuning.initialLevel };
}

/**
 * The level cap that applies to a Wild: its stage cap, unless the crystal is
 * unlocked and the Wild is at its top stage — then it shares the crystal's level
 * (never below the stage cap).
 */
export function effectiveLevelCap(
  wild: CrystalWildInfo,
  stageCap: number,
  state: LinkCrystalState,
): number {
  if (!state.unlocked || !wild.atTopStage) return stageCap;
  return Math.max(stageCap, state.level);
}
