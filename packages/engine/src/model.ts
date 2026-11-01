/**
 * Core domain vocabulary (types only — see the domain model in PROMPT.md §5).
 * Faction and class names are generic mechanic names, written for Wildbound.
 */
/** The source's five factions (R1: race 1–5). */
export type Faction = 'water' | 'fire' | 'grass' | 'light' | 'dark';

export const FACTIONS: readonly Faction[] = ['water', 'fire', 'grass', 'light', 'dark'];

export type WildClass = 'striker' | 'guardian' | 'adept';

/** Quality, from the source's potential number (13 Rare … 17 Mythic, 18 Origin). */
export type Tier = 'common' | 'rare' | 'epic' | 'legendary' | 'supreme' | 'mythic' | 'origin';

/** The six core stats. P.ATK / S.ATK drive the two damage pipelines; P.DEF /
 * S.DEF feed Power and are otherwise inert under `defendersUseDef=false`. */
export interface CoreStats {
  hp: number;
  pAtk: number;
  sAtk: number;
  spd: number;
  pDef: number;
  sDef: number;
}

/** Fractional percent lines (1.0 == 100%). PvP/Ult/Skill lines are additive
 * boost-vs-reduction pairs; Crit/Block/etc. pair with the target's resistance. */
export interface PercentLines {
  /** Percent of the sheet's HP / P.ATK / S.ATK (0.02 = +2%). */
  hpPct?: number;
  pAtkPct?: number;
  sAtkPct?: number;
  dmgBoost: number;
  dmgRdct: number;
  pvpBoost: number;
  pvpRdct: number;
  ultBoost: number;
  ultRed: number;
  skillBoost: number;
  skillRed: number;
  crit: number;
  critRes: number;
  critPower: number;
  block: number;
  blockPower: number;
  guardBreak: number;
  controlBoost: number;
  controlRes: number;
  healBoost: number;
  receiveHealBoost: number;
  counterBoost: number;
  /** R3: BOSS DMG BST / RDCT (orb lines and sets). Shown and counted; boss modes read them from R9. */
  bossBoost?: number;
  bossRdct?: number;
}

/** Flat soul stats feeding the soul factor (Spirit ATK − Spirit DEF). */
export interface SoulStats {
  spiritAtk: number;
  spiritDef: number;
}