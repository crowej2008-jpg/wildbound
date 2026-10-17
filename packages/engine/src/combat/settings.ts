/**
 * Default combat settings. The shipped defaults live in
 * `packages/content/tuning/combat.json` (Appendix A of PROMPT.md); the engine
 * keeps this mirror so it stays usable without the content package. Divergences
 * are impossible in practice — the CLI/validator compares tune against default
 * and the Build Lab surfaces every value below. Status column mirrors Appendix A.
 */
export interface CombatSettings {
  /** 'pvp' applies the P factor (PROMPT A: mode pvp). */
  mode: 'pvp' | 'pve';
  /** big rounds before the time-out gives the battle to the defenders (seen). */
  maxRounds: number;
  /** floors where G and P stop falling (open). */
  gFloor: number;
  pFloor: number;
  /** extra constant subtracted inside P (0.12 fitted for DEF-class attackers; open). */
  pvpConst: number;
  /** soul factor (fitted). */
  soulCap: number;
  soulHalf: number;
  /** crit rate = max(critFloor, critSlope × (crit − critRes)) (floor seen, slope open). */
  critFloor: number;
  critSlope: number;
  /** PvP crit multiplier floor; the PvE floor is higher (×1.59 seen but not used yet). */
  critBaseMult: number;
  /** block chance piecewise-linear points over (block − guardBreak) (inferred). */
  blockPoints: [number, number][];
  /** share of damage a blocked hit keeps (seen: at most 0.80). */
  blockKeep: number;
  /** how much attacker blockPower cuts a blocked hit (open; 0 keeps exactly blockKeep). */
  blockIntScale: number;
  /** team-Power cut: only weaker attackers below this ratio are cut (open). */
  tpThreshold: number;
  /** do weaker defenders also deal less (open — false per the measured model). */
  tpSymmetric: boolean;
  /** class-matchup multiplications; key is `${a.class}>${b.class}` (open). */
  classMult: Record<string, number>;
  /** weather is a battle/modifier-level concept; this default is the model's +30%. */
  weatherDefault: number;
  /** share of normal actions replaced by the basic skill (seen). */
  basicReplace: number;
  rageStart: number;
  /** Strikers start with a full bar; a Striker's first action is its ultimate (seen). */
  rageStrikerStart: number;
  rageMax: number;
  ragePerAction: number;
  /** rage on being hit = this + floor(rageHitScale × hpLost ÷ maxHp) (seen). */
  rageHitBase: number;
  rageHitScale: number;
  /** cost of an ultimate (the bar empties; coupled to rageMax). */
  ultRageCost: number;
  /** share of the HP lost last big round a counter reflects (seen; exact 0.75). */
  counterShare: number;
  /** turn-order tie-break: attacker side first, then lower position (assumed). */
  tieBreak: 'attackersFirst';
  /** duration counting: end of the holder's own turn (assumed). */
  buffTickTiming: 'ownTurnEnd';
  /** P.DEF / S.DEF have no effect on damage (seen; keep the switch for a different design). */
  defendersUseDef: boolean;
  /** M9.5: half-point of the DEF curve — `reduction = def / (def + defK)`. */
  defK: number;
  /** heal basis: target max HP (open — healer attack is the alternative). */
  healBasis: 'targetMaxHp' | 'casterAtk';
  /** whether a shield-absorbed hit counts toward the Rage hpLost term (seen: does not). */
  shieldCountsForRage: boolean;
  /** confusion: share of the controlled unit's normal attacks aimed at its own side. */
  redirectChance: number;
  /** M9: which negative buffs a cleanse strips first. */
  cleanseOrder: 'oldestFirst' | 'newestFirst';
  /** M9: cap for a resource counter with no explicit max. */
  defaultResourceCap: number;
  /** M9: how many nested trigger activations may chain before they stop. */
  triggerDepthCap: number;
}

export const DEFAULT_COMBAT_SETTINGS: CombatSettings = readDefaults();

function readDefaults(): CombatSettings {
  return {
    mode: 'pvp',
    maxRounds: 15,
    gFloor: 0.1,
    pFloor: 0.1,
    pvpConst: 0,
    soulCap: 0.266,
    soulHalf: 80000,
    critFloor: 0.03,
    critSlope: 1.2,
    critBaseMult: 1.2,
    blockPoints: [
      [-0.4, 0.03],
      [0.5, 0.5],
      [1.0, 1.0],
    ],
    blockKeep: 0.8,
    blockIntScale: 0,
    tpThreshold: 0.7,
    tpSymmetric: false,
    classMult: {},
    weatherDefault: 0.3,
    basicReplace: 0.2,
    rageStart: 500,
    rageStrikerStart: 1000,
    rageMax: 1000,
    ragePerAction: 250,
    rageHitBase: 125,
    rageHitScale: 1000,
    ultRageCost: 1000,
    counterShare: 0.75,
    tieBreak: 'attackersFirst',
    buffTickTiming: 'ownTurnEnd',
    defendersUseDef: false,
    defK: 1000,
    healBasis: 'targetMaxHp',
    shieldCountsForRage: false,
    redirectChance: 0.7,
    cleanseOrder: 'oldestFirst',
    defaultResourceCap: 99,
    triggerDepthCap: 4,
  };
}

export function resolveSettings(overrides?: Partial<CombatSettings>): CombatSettings {
  return { ...DEFAULT_COMBAT_SETTINGS, ...overrides };
}

export function piecewise(points: [number, number][], x: number): number {
  if (points.length === 0) return 0;
  if (x <= points[0]![0]) return points[0]![1];
  const last = points[points.length - 1]!;
  if (x >= last[0]) return last[1]!;
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1]!;
    const [x1, y1] = points[i]!;
    if (x <= x1) {
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return last[1]!;
}