export { runBattle } from './battle';
export {
  computeDamage,
  channelHit,
  addRage,
  critRateAt,
  blockChanceAt,
  type HitOutcome,
  type HitParams,
  type TeamSides,
  type HitFlags,
} from './damage';
export { DEFAULT_COMBAT_SETTINGS, resolveSettings, piecewise } from './settings';
export { resolveSheet, effective, applyStatMod } from './stats';
export { selectTargets, orderedByColumn } from './targeting';
export { applyHeal, applyShield, resolveHealAmount, applyLifesteal, applySkillSideEffects } from './sustain';
export { applyCounterReflect } from './counter';
export { takeTurn } from './skills';
export { applyBuff, tickUnitBuffs, tickBigRoundBuffs, removeBuffTag, hasLiveBuff, countStacks, CONTROL_KINDS } from './buffs';
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
  ControlSpec,
  KitDef,
  SheetInput,
  SkillDef,
  SkillSlot,
  SpecInput,
  StatSheet,
  TalentDef,
  TargetRule,
  TurnHook,
  RoundEffect,
} from './types';
export type { CombatSettings } from './settings';