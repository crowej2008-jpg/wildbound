import type { Faction } from '../model';
import type { TrialDef, TrialRule } from './types';

/**
 * Trials rules (M8, PROMPT §7.6). Five cards, each with one special rule. The
 * engine decides eligibility and derives the combat `rules`; the server enforces
 * the squad/level gates it owns. Pure. See docs/design/pve-modes.md.
 */

/** The rule is fielded as a faction-restricted squad. */
export function trialFaction(trial: TrialDef): Faction | null {
  return trial.rule === 'factionLocked' ? (trial.faction ?? null) : null;
}

/** The level a `levelCapped` trial clamps fielded Wilds to (else null). */
export function trialLevelCap(trial: TrialDef): number | null {
  return trial.rule === 'levelCapped' ? (trial.maxLevel ?? null) : null;
}

/** The big-round count a `survival` trial demands (else null). */
export function trialSurvivalRounds(trial: TrialDef): number | null {
  return trial.rule === 'survival' ? (trial.survivalRounds ?? null) : null;
}

/** True when the trial is open on this weekday (always open unless `weekdayBoss`). */
export function trialOpenOn(trial: TrialDef, weekday: number): boolean {
  if (trial.rule !== 'weekdayBoss') return true;
  const days = trial.weekdays;
  return !days || days.length === 0 || days.includes(weekday);
}

/** The trial is plannable at this trainer level and on this weekday. */
export function trialAvailable(trial: TrialDef, trainerLevel: number, weekday: number): boolean {
  return trainerLevel >= trial.unlockLevel && trialOpenOn(trial, weekday);
}

/** Whether a fielded Wild's faction satisfies the trial's rule. */
export function isTrialEligible(trial: TrialDef, faction: Faction): boolean {
  const required = trialFaction(trial);
  return required === null || required === faction;
}

/** Combat rules the trial imposes on a battle (M8 combat change). */
export interface TrialBattleRules {
  noUltimate?: boolean;
  survivalRounds?: number;
}

export function trialBattleRules(trial: TrialDef): TrialBattleRules {
  const rules: TrialBattleRules = {};
  if (trial.rule === 'noUltimate') rules.noUltimate = true;
  const rounds = trialSurvivalRounds(trial);
  if (rounds !== null) rules.survivalRounds = rounds;
  return rules;
}

/** The five shipped rules, in display order (used by the server/cards). */
export const TRIAL_RULES: readonly TrialRule[] = [
  'factionLocked',
  'noUltimate',
  'levelCapped',
  'survival',
  'weekdayBoss',
];
