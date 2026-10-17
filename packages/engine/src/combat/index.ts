export { runBattle } from './battle';
export {
  computeDamage,
  channelHit,
  critRateAt,
  blockChanceAt,
  type HitOutcome,
  type HitParams,
  type TeamSides,
  type HitFlags,
} from './damage';
export { DEFAULT_COMBAT_SETTINGS, resolveSettings, piecewise } from './settings';
export { resolveSheet, effective, applyStatMod } from './stats';
export { selectTargets, selectFor, orderedByColumn } from './targeting';
export { evalCondition, isControlled, hasDot, stackCount } from './conditions';
export { applyHeal, applyShield, applyShieldAmount, resolveHealAmount, resolveHealWithBasis, applyLifesteal, applySkillSideEffects } from './sustain';
export { applyCounterReflect } from './counter';
export { takeTurn } from './skills';
export { applyControl, landControl } from './control';
export { applyDot, applyDotSpec, applyDotTag, applyRegen, tickDots, tickRegen } from './dot';
export { applyEffects, applyEffectList } from './effects';
export { fireTriggers } from './triggers';
export { addRage } from './rage';
export { levelScale, scaleBuff } from './scaling';
export {
  applyBuff,
  tickUnitBuffs,
  tickBigRoundBuffs,
  removeBuffTag,
  stripBuffs,
  isNegativeBuff,
  isPositiveBuff,
  hasLiveBuff,
  countStacks,
  CONTROL_KINDS,
} from './buffs';
export { initReplay, stepReplay, replayTo, lastActor, lastTarget } from './replay';
export type { ReplayUnit, ReplayState } from './replay';
export type {
  BattleConfig,
  BattleContext,
  BattleEvent,
  BattleResult,
  BattleRules,
  Buff,
  BuffKind,
  BuffSpec,
  Combatant,
  CombatField,
  Condition,
  ControlSpec,
  DotSpec,
  Effect,
  KitDef,
  SheetInput,
  SkillDef,
  SkillSlot,
  SpecInput,
  StatSheet,
  TalentDef,
  TargetFilter,
  TargetRow,
  TargetRule,
  TargetSel,
  TargetSide,
  TriggerDef,
  TriggerOn,
  TurnHook,
  RoundEffect,
} from './types';
export type { CombatSettings } from './settings';