import type { CoreStats, Faction, PercentLines } from '../model';

/**
 * One star of a species' ladder, copied from the source's hero_evolution_json (R1, see
 * docs/ASSUMPTIONS.md #49). The star decides the form's name, its level cap and its stats.
 */
export interface StarCard {
  star: number;
  /** The form's name at this star (e.g. Beldum → Metang → Metagross). */
  name: string;
  maxLevel: number;
  /** basic_attr: HP, attack (P.ATK = S.ATK) and SPD at level 0. */
  basic: { hp: number; atk: number; spd: number };
  /** growth_attr: gained per level. DEF only ever comes from level × growth. */
  growth: { hp: number; atk: number; pDef: number; sDef: number };
  /** 19★+ (Awakening) extras: flat, and per level. */
  extraBasic?: { hp: number; atk: number };
  extraGrowth?: { hp: number; atk: number };
  /** "DMG BST to [faction]" on the card (0.25 = 25%). */
  factionBoost?: { faction: Faction; value: number };
  /** What it costs to go from this star to the next; absent = this star can't be raised by evolving. */
  fodder?: FodderReq[];
  /** Extra items for the next star (Awakening Stones from 19★). */
  fodderItems?: { item: number; count: number }[];
}

/**
 * One fodder line: `count` Wilds at exactly `star`. `own` = the same species; otherwise any species of
 * `faction` (or of any faction when it is absent).
 */
export interface FodderReq {
  own: boolean;
  star: number;
  count: number;
  faction?: Faction;
}

/** One stat line's Power weighting: core points and the percent-value extensions. */
export interface PowerRow {
  powerRate: number;
  extRate: number;
}

export interface PowerWeights {
  core: CoreStats;
  percent: Partial<Record<keyof PercentLines, PowerRow>>;
  /** Percent values are fractions; this scales them to the formula's units. */
  scale: number;
}
