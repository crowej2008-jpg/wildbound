import type { Faction, Tier, WildClass } from '../model';
import type { Rng } from '../rng';
import type { CombatSettings } from './settings';

/**
 * Combat vocabulary: resolved stat sheets, skill-kit DSL instances, combatant
 * runtime state, events and results. Everything here is plain data — the engine
 * never touches the DOM and never reads the clock.
 */

/** Fractional modifier keys a buff/debuff may alter at runtime. */
export type CombatField =
  | 'hp'
  | 'pAtk'
  | 'sAtk'
  | 'spd'
  | 'dmgBoost'
  | 'dmgRdct'
  | 'pvpBoost'
  | 'pvpRdct'
  | 'ultBoost'
  | 'ultRed'
  | 'skillBoost'
  | 'skillRed'
  | 'crit'
  | 'critRes'
  | 'critPower'
  | 'block'
  | 'blockPower'
  | 'guardBreak'
  | 'controlBoost'
  | 'controlRes'
  | 'healBoost'
  | 'receiveHealBoost'
  | 'counterBoost'
  | 'spiritAtk'
  | 'spiritDef';

/**
 * A conditional stat change owned by an equipment layer (M7). Applied once, at the
 * start of the big round matching `fromRound`: `add`/`mult` fold into the unit's
 * sheet (permanent) unless `bigRounds` is set, in which case it lands as a timed buff.
 */
export interface RoundEffect {
  tag: string;
  field: CombatField;
  add?: number;
  mult?: number;
  fromRound: number;
  bigRounds?: number;
}

export type BuffKind =
  | 'stat'
  | 'control'
  | 'silence'
  | 'confusion'
  | 'paralysis'
  | 'immune'
  | 'dot';

export interface BuffSpec {
  tag: string;
  kind: BuffKind;
  field?: CombatField;
  amount?: number;
  turns?: number;
  bigRounds?: number;
  maxStacks?: number;
  /** damage-over-time / control chance (fraction) */
  chance?: number;
  /** confusion: share of normal attacks aimed at the holder's own side */
  redirectChance?: number;
}

export type SkillSlot = 'normal' | 'basic' | 'ult';
export type DamageType = 'P' | 'S';
export type TargetRule = 'column' | 'row' | 'all' | 'lowest_hp' | 'random' | 'self';

export interface ControlSpec {
  kind: string;
  /** null == guaranteed (bypasses Control Res; only immunity stops it) */
  chance: number | null;
  /** self-buff duration in the holder's own turns; undefined = one turn */
  turns?: number;
}

export interface SkillDef {
  slot: SkillSlot;
  type: DamageType;
  rates: number[];
  rule: TargetRule;
  targets?: number;
  damageType?: 'hpShare' | 'dot';
  hpShare?: number;
  control?: ControlSpec;
  selfBuffs?: BuffSpec[];
  targetDebuffs?: BuffSpec[];
  counter?: boolean;
  heal?: { target: 'ally' | 'self' | 'allies'; rate: number };
  shield?: { target: 'ally' | 'self' | 'allies'; share: number };
  lifesteal?: number;
}

export interface StatMod {
  field: CombatField;
  mult?: number;
  add?: number;
}

export type TurnHook = 'allyShelterStack';

export interface TalentDef {
  statMods?: StatMod[];
  rageOnHit?: number;
  rageCutChance?: number;
  safeguard?: { active: number; cycle: number };
  turnHooks?: TurnHook[];
}

export interface KitDef {
  id: string;
  name: string;
  faction: Faction;
  class: WildClass;
  tier: Tier;
  skills: Record<SkillSlot, SkillDef>;
  counterShare?: number;
  talents?: TalentDef;
  hooksConfig?: Record<string, Record<string, string | number>>;
}

/** Fully-resolved percent lines, soul stats and flat overrides for a combatant. */
export interface SheetInput {
  hp: number;
  pAtk: number;
  sAtk: number;
  spd: number;
  pDef?: number;
  sDef?: number;
  dmgBoost?: number;
  dmgRdct?: number;
  pvpBoost?: number;
  pvpRdct?: number;
  ultBoost?: number;
  ultRed?: number;
  skillBoost?: number;
  skillRed?: number;
  crit?: number;
  critRes?: number;
  critPower?: number;
  block?: number;
  blockPower?: number;
  guardBreak?: number;
  controlBoost?: number;
  controlRes?: number;
  healBoost?: number;
  receiveHealBoost?: number;
  counterBoost?: number;
  spiritAtk?: number;
  spiritDef?: number;
}

export interface SpecInput {
  id: string;
  name: string;
  position: number;
  side: 'attackers' | 'defenders';
  kit: KitDef;
  sheet: SheetInput;
  /** team Power contribution; powers are an input until the M2 Power formula. */
  power?: number;
  /** M7: conditional equipment effects applied during the fight. */
  roundEffects?: RoundEffect[];
}

/** A resolved, buffable stat sheet as the battle sees it (base values). */
export interface StatSheet {
  hp: number;
  pAtk: number;
  sAtk: number;
  spd: number;
  pDef: number;
  sDef: number;
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
  spiritAtk: number;
  spiritDef: number;
}

export interface Buff {
  tag: string;
  kind: BuffKind;
  source: string;
  field?: CombatField;
  amount?: number;
  turns?: number;
  bigRounds?: number;
  chance?: number;
  redirectChance?: number;
}

export interface Combatant {
  key: string;
  id: string;
  name: string;
  side: 'attackers' | 'defenders';
  position: number;
  column: number;
  row: 'front' | 'back';
  kit: KitDef;
  sheet: StatSheet;
  base: StatSheet;
  maxHp: number;
  hp: number;
  shieldHp: number;
  rage: number;
  alive: boolean;
  buffs: Buff[];
  lostThisRound: number;
  lostLastRound: number;
  /** M7: equipment round effects not yet applied. */
  roundEffects?: RoundEffect[];
}

export interface BattleConfig {
  attackers: SpecInput[];
  defenders: SpecInput[];
  seed: number;
  mode?: 'pvp' | 'pve';
  settings?: Partial<CombatSettings>;
  battleId?: string;
  /** deterministic replay mode (golden/parity): random rolls forced to a fixed value. */
  deterministic?: boolean;
  /** faction set → damage multiplier (battle weather etc.) */
  weather?: { factions: Faction[]; dmg: number };
  /** M8: per-mode battle rules (Trials). See docs/design/pve-modes.md. */
  rules?: BattleRules;
}

/** Special rules a PvE mode (M8 Trials) imposes on a battle. */
export interface BattleRules {
  /** Ultimates never fire; the turn falls back to a normal/basic skill. */
  noUltimate?: boolean;
  /**
   * The loop is capped at this many big rounds and the time-out flips: the
   * attackers win if any of them is still alive when the rounds run out.
   */
  survivalRounds?: number;
}

/** Skips give an action slot with no skill (`skill: null`). */
export type BattleEvent =
  | { type: 'roundStart'; bigRound: number }
  | { type: 'action'; unit: string; skill: SkillSlot | null }
  | {
      type: 'hit';
      src: string;
      tgt: string;
      dmg: number;
      crit: boolean;
      blocked: boolean;
      hpAfter: number;
      hpShare?: boolean;
      missed?: boolean;
    }
  | { type: 'reflect'; src: string; tgt: string; dmg: number; hpAfter: number }
  | { type: 'heal'; tgt: string; amount: number; hpAfter: number }
  | { type: 'shield'; tgt: string; amount: number; shieldAfter: number }
  | { type: 'buffApplied'; unit: string; tag: string; amount: number; stacks?: number }
  | { type: 'buffExpired'; unit: string; tag: string }
  | { type: 'control'; tgt: string; kind: string; landed: boolean }
  | { type: 'rageChange'; unit: string; delta: number; rage: number }
  | { type: 'death'; unit: string }
  | { type: 'immunity'; unit: string; kind: string }
  | { type: 'roundEnd'; bigRound: number }
  | { type: 'result'; winner: 'attackers' | 'defenders'; rounds: number };

export interface BattleResult {
  battleId: string;
  seed: number;
  winner: 'attackers' | 'defenders';
  rounds: number;
  events: BattleEvent[];
  units: {
    key: string;
    id: string;
    side: 'attackers' | 'defenders';
    position: number;
    alive: boolean;
    hp: number;
    maxHp: number;
    damageDealt: number;
    damageTaken: number;
    healingDone: number;
  }[];
  damageDealt: Record<string, number>;
}

export interface BattleContext {
  settings: CombatSettings;
  rng: Rng;
  units: Combatant[];
  events: BattleEvent[];
  weather?: BattleConfig['weather'];
  /** M8: per-mode battle rules (Trials); undefined = standard rules. */
  rules?: BattleRules;
  /** deterministic replay: every roll returns ~0, so no crit/block and no
   * chance-based control ever lands (guaranteed ones still land). */
  deterministic: boolean;
  /** current big round number (1-based), for per-round turn hooks. */
  round: number;
  alreadyAppliedHooks: Set<string>;
  damageDealt: Record<string, number>;
  damageTaken: Record<string, number>;
  healingDone: Record<string, number>;
}
