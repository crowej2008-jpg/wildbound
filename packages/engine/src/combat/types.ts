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
  | 'spiritDef'
  /** E1: share of P.ATK and S.ATK added on top (0.1 = +10% attack). */
  | 'atkPct'
  /** E1: share of the target's Block this unit's hits ignore (0.5 = half). */
  | 'ignoreBlock'
  /** E1: added to the unit's basic-skill chance. */
  | 'basicRate'
  /** E3: reduction of physical (P.ATK) / special (S.ATK) damage taken, in the G pair. */
  | 'pRdct'
  | 'sRdct'
  /** E3: extra damage taken from damage-over-time ticks. */
  | 'dotTaken'
  /** E3: share of the damage dealt healed back (buffable lifesteal). */
  | 'lifesteal';

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

/**
 * M11.4 Soul-heart hooks. Static set lines live on the sheet; these are the
 * dynamic effects that need a battle event (shields, lifesteal, cadence heals,
 * control immunity and on-hit rolls). Rates are fractions and are authored data.
 */
export interface SoulheartHooks {
  lifesteal?: number;
  /** Bonus damage against a target that still has a shield. */
  shieldDmgBonus?: number;
  /** Bonus damage while the attacker itself carries a shield. */
  shieldedDmgBonus?: number;
  /** Every N big rounds, gain a one-turn puncture buff. */
  punctureEvery?: number;
  /** Every N big rounds, gain a one-turn control immunity buff. */
  controlImmunityEvery?: number;
  /** Heal this share of max HP at the end of the listed big rounds. */
  roundHeal?: { rounds: number[]; rate: number };
  /** When hit, chance to heal this share of max HP. */
  onHitHeal?: { chance: number; rate: number };
  /** Heal this share of max HP at the start of the holder's turn. */
  turnHeal?: number;
  /** Chance for a direct hit to inflict paralysis. */
  paralysisChance?: number;
  /** Shield this share of max HP at battle start. */
  startShield?: number;
  /** Share of excess healing that becomes a shield. */
  overhealShield?: number;
  /** Permanent damage reduction applied at battle start. */
  startDmgRdct?: number;
  /** First-round-only Soul DEF multiplier (1.5 = +50%). */
  firstRoundSpiritDefMult?: number;
  /** First-round-only damage reduction. */
  firstRoundDmgRdct?: number;
  /** Permanent battle-start multipliers (same-stat ladders keep the highest). */
  spiritAtkMult?: number;
  spiritDefMult?: number;
  sAtkMult?: number;
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
  /** M11.4: attacks ignore shields while this buff is live. */
  | 'puncture'
  /** M9.6: forced targeting — the holder's enemy-side skills are aimed at the taunter. */
  | 'taunt'
  /** E1: the holder gains no Rage while this is live (Shell Bell). */
  | 'rageBlock'
  /** E3: no normal attack or basic skill (the ultimate still fires when Rage is full). */
  | 'disarm'
  /** E3: the basic skill cannot trigger. */
  | 'noBasic'
  /** E3: the holder's hits cannot crit. */
  | 'noCrit'
  /** E3: fatal damage leaves the holder at 1 HP once (the buff is spent). */
  | 'endure'
  /** E3: the holder takes no damage. */
  | 'invulnerable';

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
  /** E3: one stack is removed each time the holder takes a direct hit ("reduced by one layer"). */
  consumeOnHit?: boolean;
  /** E3: an `immune` buff that stops only these controls / DoT tags. */
  immuneTo?: string[];
  /** E3: removed when the unit that applied it dies. */
  endsWithSource?: boolean;
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
export type TargetFilter = 'dot' | 'controlled' | 'debuffed' | 'fullRage' | 'shielded';

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
  /** E1: the target carries any of these tags (e.g. a burn or a poison). */
  targetHasAnyTag?: string[];
  /** E1: the current big round is in this window (`even` = rounds 2, 4, 6…). */
  round?: { from?: number; until?: number; even?: boolean; every?: number };
  /** E1: the unit the condition is evaluated for is controlled. */
  selfControlled?: boolean;
  /** E3: the target carries a shield. */
  targetShielded?: boolean;
  /** E3: the unit's HP share is below / above the target's. */
  selfHpBelowTarget?: boolean;
  selfHpAboveTarget?: boolean;
  /** E3: the unit an ally event is about (e.g. the ally that crit) carries this tag. */
  actorHasTag?: string;
  /** E3: at least this many living enemies / at most this many other living allies. */
  enemiesAtLeast?: number;
  otherAlliesAtMost?: number;
  /** E3: the target's class (the sheet's [ATK] / [DEF] / [SKILL] Pokémon). */
  targetClass?: WildClass;
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
  /** E3: prefer targets carrying this tag (Origin Lugia's confined targets). */
  hasTag?: string;
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
      basis?: HealBasis;
      over?: number;
      /** E3: extra multiplier when the condition holds for the healed unit. */
      bonusVs?: { condition: Condition; mult: number };
      /** E3: multiply by the caster's stacks of this resource. */
      perResource?: string;
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
      /** E3: set Rage to the full bar. */
      fill?: boolean;
      /** E3: ignores a rage block (Solgaleo's own refill). */
      force?: boolean;
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
      /** or a share of an HP basis (E3 adds caster-side bases and the event's damage) */
      basis?:
        | 'targetMaxHp'
        | 'targetCurrentHp'
        | 'targetMissingHp'
        | 'casterCurrentHp'
        | 'casterMissingHp'
        | 'casterLostTotal'
        | 'casterLostLastRound'
        | 'eventDamage';
      share?: number;
      trueDamage?: boolean;
      condition?: Condition;
      chance?: number;
    }
  | ExtraEffect;

/**
 * What a heal reads: the target's max HP (default), the caster's P.ATK (`casterAtk`), S.ATK
 * (`casterSAtk`, E1) or current HP (`casterCurrentHp`, E1).
 */
export type HealBasis =
  | 'targetMaxHp'
  | 'casterAtk'
  | 'casterSAtk'
  | 'casterCurrentHp'
  /** E3: the target's lost HP. */
  | 'targetMissingHp'
  /** E3: the damage the triggering event dealt (Celebi). */
  | 'eventDamage';

/**
 * E1: a damage modifier owned by a unit (held items, talents). On each of the unit's direct hits
 * whose slot and condition match (and whose chance rolls), `dmg` joins the additive G pair,
 * `atk` raises the attack the hit reads, and `ignoreBlock` ignores that share of the target's Block.
 */
export interface DamageMod {
  tag: string;
  slot?: SkillSlot;
  condition?: Condition;
  chance?: number;
  dmg?: number;
  atk?: number;
  ignoreBlock?: number;
  /**
   * E3: scale `dmg`/`atk` by a battle quantity (0–1 shares, or a resource's stacks), capped at
   * `cap`: e.g. Dialga's damage by its own Rage share, up to 30%.
   */
  scale?: 'selfRage' | 'targetRage' | 'selfMissingHp' | 'selfHp' | { resource: string };
  /** E3: only hits of this damage type (P.ATK / S.ATK). */
  type?: DamageType;
  cap?: number;
  /** E3: `defend` mods belong to the unit being hit; their `dmg` cuts the damage it takes. */
  role?: 'attack' | 'defend';
}

/** E3: extra effect ops. */
export type ExtraEffect =
  /** Take an extra action right away (`roll` = basic skill at its chance, else normal). */
  | { op: 'extraAction'; target: TargetSel; slot: SkillSlot | 'roll'; noRage?: boolean; condition?: Condition; chance?: number }
  /** Splash: the units next to the event's target take `share` of the damage dealt to it. */
  | { op: 'splash'; target: TargetSel; share: number; condition?: Condition; chance?: number }
  /** Remove every shield on the target. */
  | { op: 'breakShield'; target: TargetSel; condition?: Condition; chance?: number };

/** A target selection for an effect (M9): side + rule + narrowing. */
export interface TargetSel {
  /** E1: the unit the trigger's event is about (the attacker, the one hit, the controller…). */
  event?: boolean;
  /** E3: prefer units carrying this tag (no narrowing when none do). */
  hasTag?: string;
  /** E3: never pick the unit itself (an ally-side pick of "another" ally). */
  excludeSelf?: boolean;
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
  | 'hpBelow'
  /** E1: the owner landed a critical hit (target = the one hit). */
  | 'onCrit'
  /** E1: the owner's hit was blocked (target = the blocker). */
  | 'onBlocked'
  /** E1: the owner's direct hit landed (target = the one hit). */
  | 'onDealDamage'
  /** E1: a control landed on the owner (target = the controller). */
  | 'onControlled'
  /** E1: the owner landed a control (target = the controlled unit). */
  | 'onInflictControl'
  /** E1: after the owner's normal attack / basic skill / ultimate (target = its first target). */
  | 'afterNormal'
  | 'afterBasic'
  | 'afterUlt'
  /** E3: an ally landed a crit (target = the one hit; the ally is the event's actor). */
  | 'onAllyCrit'
  /** E3: an endure buff saved the owner from fatal damage. */
  | 'onEndure'
  /** An enemy of the owner fell, whoever defeated it (Mew: "every fallen enemy"). */
  | 'onEnemyDeath';

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
  /** E1: activations allowed per battle ("once per battle" = 1). */
  maxFires?: number;
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
  /** E3: the kit's own damage modifiers. */
  damageMods?: DamageMod[];
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
  atkPct?: number;
  ignoreBlock?: number;
  basicRate?: number;
  pRdct?: number;
  sRdct?: number;
  dotTaken?: number;
  lifesteal?: number;
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
  /** M11.4: dynamic Soul-heart set hooks. */
  soulheart?: SoulheartHooks;
  /** M9: the creature's level, for `scalesWithLevel` ladders (default 1). */
  level?: number;
  /** R1: the star card's "DMG BST to [faction]" (source basic_attr 138–146). */
  factionBoost?: FactionBoost;
  /** E1: extra triggers from gear (held-item skills); they fire after the kit's own. */
  triggers?: TriggerDef[];
  /** E1: damage modifiers from gear. */
  damageMods?: DamageMod[];
}

/** "DMG BST to [faction]": extra damage against defenders of that faction (0.25 = 25%). */
export interface FactionBoost {
  faction: Faction;
  value: number;
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
  atkPct: number;
  ignoreBlock: number;
  basicRate: number;
  pRdct: number;
  sRdct: number;
  dotTaken: number;
  lifesteal: number;
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
  /** E3: see BuffSpec. */
  consumeOnHit?: boolean;
  immuneTo?: string[];
  endsWithSource?: boolean;
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
  /** E3: HP lost over the whole battle (heals do not reduce it). */
  lostTotal?: number;
  /** M7: equipment round effects not yet applied. */
  roundEffects?: RoundEffect[];
  /** M11.4: dynamic Soul-heart set hooks folded from the equipped pieces. */
  soulheart?: SoulheartHooks;
  /** M9: per-creature stack counters ("Frost", "sanction", …). */
  resources?: Record<string, number>;
  /** M9: the creature's level (for `scalesWithLevel` ladders; default 1). */
  level?: number;
  /** R1: "DMG BST to [faction]" from the star card. */
  factionBoost?: FactionBoost;
  /** E1: gear triggers and damage modifiers (see SpecInput). */
  triggers?: TriggerDef[];
  damageMods?: DamageMod[];
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
  /** M10.5: per-side squad strategy; omitted sides fight `balanced`. */
  strategies?: BattleStrategies;
}

/**
 * Squad strategy (M10.5). `balanced` is the measured M1 model and the default;
 * `aggressive` and `defensive` are the Squad screen's opt-in policies. See
 * `strategy.ts` for what each one changes.
 */
export type BattleStrategy = 'aggressive' | 'balanced' | 'defensive';

export const BATTLE_STRATEGIES: readonly BattleStrategy[] = ['aggressive', 'balanced', 'defensive'];

/** One strategy per side; a missing side keeps the measured `balanced` model. */
export interface BattleStrategies {
  attackers?: BattleStrategy;
  defenders?: BattleStrategy;
}

/** Special rules a PvE mode (M8 Trials) imposes on a battle. */
export interface BattleRules {
  /** Ultimates never fire; the turn falls back to a normal/basic skill. */
  noUltimate?: boolean;
  /**
   * The loop is capped at this many big rounds. Unlike `survivalRounds`, a
   * time-out is a loss; Sky Pillar uses the source's 15-turn counter.
   */
  roundLimit?: number;
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
  /** M10.5: per-side squad strategy; omitted sides fight `balanced`. */
  strategies?: BattleStrategies;
  /** deterministic replay: every roll returns ~0, so no crit/block and no
   * chance-based control ever lands (guaranteed ones still land). */
  deterministic: boolean;
  /** current big round number (1-based), for per-round turn hooks. */
  round: number;
  /** M9.4: current trigger nesting depth (bounded by `settings.triggerDepthCap`). */
  triggerDepth?: number;
  /** E3: the damage and actor of the event a trigger is resolving (splash, Celebi, ally crit). */
  eventAmount?: number;
  eventActor?: Combatant;
  /** E3: damage the current action dealt to each target (for splash). */
  castDamage?: Map<string, number>;
  /** E3: the team Power pair of the battle (extra actions need it). */
  team?: { attackersPower: number; defendersPower: number };
  /** E3: units whose endure fired during the current hit (their `onEndure` triggers run next). */
  pendingEndure?: Combatant[];
  /** M9: scratch counters for trigger caps/cooldowns (not part of the result). */
  counters?: Map<string, number>;
  alreadyAppliedHooks: Set<string>;
  damageDealt: Record<string, number>;
  damageTaken: Record<string, number>;
  healingDone: Record<string, number>;
}
