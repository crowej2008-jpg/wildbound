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
  | 'pDef'
  | 'sDef'
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
  | 'dot'
  | 'regen'
  | 'stack'
  /** M9.6: forced targeting — the holder's enemy-side skills are aimed at the taunter. */
  | 'taunt';

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
  /** M9: cannot be removed by cleanse/dispel. */
  undispellable?: boolean;
  /** M9: `[level, value][]` ladder replacing `amount` at the caster's level. */
  scalesWithLevel?: [number, number][];
}

export type SkillSlot = 'normal' | 'basic' | 'ult';
export type DamageType = 'P' | 'S';
export type TargetRule =
  | 'column'
  | 'row'
  | 'all'
  | 'lowest_hp'
  | 'highest_hp'
  | 'highest_atk'
  | 'highest_spd'
  | 'random'
  | 'frontline'
  | 'backline'
  | 'same_position'
  | 'adjacent'
  | 'self';

/** Which team a skill's targets are drawn from (M9; default `enemy` = the M1 behaviour). */
export type TargetSide = 'enemy' | 'ally';
/** Row restriction applied before the target rule (M9). */
export type TargetRow = 'front' | 'back';
/** Predicate a candidate must satisfy to stay targetable (M9). */
export type TargetFilter = 'dot' | 'controlled' | 'debuffed';

/**
 * A predicate over the caster/target/battle (M9). Every present clause must hold
 * (logical AND); an absent clause is ignored. An empty condition is always true.
 */
export interface Condition {
  selfHpBelow?: number;
  selfHpAbove?: number;
  targetHpBelow?: number;
  targetHpAbove?: number;
  selfHasTag?: string;
  targetHasTag?: string;
  selfStackAtLeast?: { tag: string; n: number };
  targetStackAtLeast?: { tag: string; n: number };
  targetControlled?: boolean;
  targetHasDot?: boolean;
  allyUnderControl?: boolean;
  targetRow?: TargetRow;
  targetTrait?: string;
}

/** A damage-over-time instance (M9). `damageType: 'dot'` + `hpShare` is the M1 form. */
export interface DotSpec {
  /** fraction of the basis, applied per tick */
  share: number;
  basis?: 'targetMaxHp' | 'casterAtk' | 'targetCurrentHp';
  type?: DamageType;
  /** big-round duration (default 2, the M1 value) */
  turns?: number;
  maxStacks?: number;
  undispellable?: boolean;
  /** M9.6: bypasses shields ("deals true damage"). */
  trueDamage?: boolean;
}

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
  /** M9: which team the skill targets (default `enemy`). */
  side?: TargetSide;
  /** M9: restrict the candidate pool to a row before the rule runs. */
  rowFilter?: TargetRow;
  /** M9: candidate predicates; if the narrowed pool is empty the pool is not narrowed. */
  filters?: TargetFilter[];
  /** M9: hpShare basis (default `max`, the measured M1 behaviour). */
  hpShareBasis?: 'max' | 'current' | 'missing';
  /** M9: bypasses every damage factor, both rolls and (by default) shields. */
  trueDamage?: boolean;
  /** M9: bypass shields for this skill's direct hits. */
  ignoreShield?: boolean;
  /** M9: fraction of the target's DEF ignored (live only when `defendersUseDef`). */
  ignoreDefense?: number;
  /** M9: a structured damage-over-time application (rider). */
  dot?: DotSpec;
  /** M9: extra multiplier when the condition holds. */
  bonusVs?: { condition: Condition; mult: number };
  /** M9: re-run the skill when a target dies, up to `max` extra casts. */
  recastOnKill?: { max: number };
  /** M9: when present and false, the skill falls back to plain column targeting. */
  condition?: Condition;
  /** M9: ordered side effects resolved after the damage step. */
  effects?: Effect[];
}

/** One rider resolved after a skill's damage (M9). */
export type Effect =
  | { op: 'buff'; target: TargetSel; buff: BuffSpec; condition?: Condition; chance?: number }
  | { op: 'dot'; target: TargetSel; dot: DotSpec; tag?: string; condition?: Condition; chance?: number }
  | { op: 'control'; target: TargetSel; control: ControlSpec; condition?: Condition; chance?: number }
  | {
      op: 'heal';
      target: TargetSel;
      rate: number;
      basis?: 'targetMaxHp' | 'casterAtk';
      over?: number;
      condition?: Condition;
      chance?: number;
    }
  | { op: 'shield'; target: TargetSel; share: number; basis?: 'casterHp' | 'casterAtk'; condition?: Condition; chance?: number }
  | { op: 'cleanse'; target: TargetSel; count?: number; kinds?: string[]; condition?: Condition; chance?: number }
  | { op: 'dispel'; target: TargetSel; count?: number; kinds?: string[]; condition?: Condition; chance?: number }
  | {
      op: 'rage';
      target: TargetSel;
      delta?: number;
      pct?: number;
      steal?: boolean;
      condition?: Condition;
      chance?: number;
    }
  | { op: 'revive'; target: TargetSel; hpPct: number; once?: boolean; condition?: Condition; chance?: number }
  | { op: 'resource'; target: TargetSel; tag: string; delta?: number; max?: number; consume?: number; condition?: Condition; chance?: number }
  | {
      op: 'damage';
      target: TargetSel;
      /** attack ratio (P/S.ATK × rate) */
      rate?: number;
      type?: DamageType;
      /** or a share of an HP basis */
      basis?: 'targetMaxHp' | 'targetCurrentHp' | 'targetMissingHp';
      share?: number;
      trueDamage?: boolean;
      condition?: Condition;
      chance?: number;
    };

/** A target selection for an effect (M9): side + rule + narrowing. */
export interface TargetSel {
  side?: TargetSide;
  rule?: TargetRule;
  n?: number;
  rowFilter?: TargetRow;
  filters?: TargetFilter[];
  condition?: Condition;
}

export interface StatMod {
  field: CombatField;
  mult?: number;
  add?: number;
  /** M9: `[level, value][]` ladder replacing the flat value at the holder's level. */
  scalesWithLevel?: [number, number][];
}

export type TurnHook = 'allyShelterStack';

/** When a talent trigger fires (M9.4). */
export type TriggerOn =
  | 'battleStart'
  | 'roundStart'
  | 'roundEnd'
  | 'turnStart'
  | 'turnEnd'
  | 'onHit'
  | 'onKill'
  | 'onDeath'
  | 'onAllyDeath'
  | 'hpBelow';

/**
 * A talent trigger (M9.4): an event on the owner (`on`), optional gates
 * (`condition`, `hpBelow`, `chance`, `perTurn`, `cooldown`) and a payload
 * (`effects`, or the `rage` / `buff` shorthands). Fired by `fireTriggers`.
 */
export interface TriggerDef {
  on: TriggerOn;
  /** HP fraction threshold for an `hpBelow` trigger (re-arms when HP rises above it). */
  hpBelow?: number;
  chance?: number;
  /** max activations per big round */
  perTurn?: number;
  /** big rounds to wait after activating */
  cooldown?: number;
  condition?: Condition;
  effects?: Effect[];
  /** shorthand: Rage delta applied to the owner */
  rage?: number;
  /** shorthand: a buff applied to the owner */
  buff?: BuffSpec;
}

export interface TalentDef {
  statMods?: StatMod[];
  rageOnHit?: number;
  rageCutChance?: number;
  safeguard?: { active: number; cycle: number };
  turnHooks?: TurnHook[];
  /** M9.4: start-of-battle Rage override (default: class-based). */
  rageStart?: number;
  /** M9.6: per-unit basic-skill trigger rate (overrides `combat.basicReplace`). */
  basicRate?: number;
  /** M9.4: event triggers. */
  triggers?: TriggerDef[];
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
  /** M9: tags a `Condition.targetTrait` can match (e.g. "def"). */
  traits?: string[];
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
  /** M9: the creature's level, for `scalesWithLevel` ladders (default 1). */
  level?: number;
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
  /** M9: DoT basis (`targetMaxHp` | `casterAtk` | `targetCurrentHp`). */
  basis?: string;
  /** M9: the caster's attack captured when a `casterAtk` DoT was applied. */
  power?: number;
  /** M9: cannot be removed by cleanse/dispel. */
  undispellable?: boolean;
  /** M9.6: a DoT that bypasses shields. */
  trueDamage?: boolean;
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
  /** M9: per-creature stack counters ("Frost", "sanction", …). */
  resources?: Record<string, number>;
  /** M9: the creature's level (for `scalesWithLevel` ladders; default 1). */
  level?: number;
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
  /** M9.4: current trigger nesting depth (bounded by `settings.triggerDepthCap`). */
  triggerDepth?: number;
  /** M9: scratch counters for trigger caps/cooldowns (not part of the result). */
  counters?: Map<string, number>;
  alreadyAppliedHooks: Set<string>;
  damageDealt: Record<string, number>;
  damageTaken: Record<string, number>;
  healingDone: Record<string, number>;
}
