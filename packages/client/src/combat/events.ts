import type { BattleEvent, SkillSlot } from '@wildbound/engine';
import { t } from '../i18n';

/** Human-readable one-line description of a battle event for the log drawer. */
export type NameLookup = (key: string) => string;

export function skillName(slot: SkillSlot): string {
  switch (slot) {
    case 'normal':
      return t('combat.skill.normal');
    case 'basic':
      return t('combat.skill.basic');
    case 'ult':
      return t('combat.skill.ult');
  }
}

export function describeEvent(e: BattleEvent, nameOf: NameLookup): string {
  switch (e.type) {
    case 'roundStart':
      return `${t('combat.logRound')} ${e.bigRound}`;
    case 'roundEnd':
      return `${t('combat.logRoundEnd')} ${e.bigRound}`;
    case 'action':
      return e.skill ? `${nameOf(e.unit)} · ${skillName(e.skill)}` : `${nameOf(e.unit)} ${t('combat.skips')}`;
    case 'hit': {
      const flags = [
        e.crit ? t('combat.crit') : '',
        e.blocked ? t('combat.blocked') : '',
        e.missed ? t('combat.missed') : '',
        e.hpShare ? 'hp' : '',
      ].filter(Boolean);
      const tail = flags.length > 0 ? ` (${flags.join(', ')})` : '';
      return `${nameOf(e.src)} → ${nameOf(e.tgt)}  −${e.dmg}${tail}`;
    }
    case 'reflect':
      return `${nameOf(e.src)} ↺ ${nameOf(e.tgt)}  −${e.dmg} (${t('combat.logReflect')})`;
    case 'heal':
      return `${nameOf(e.tgt)}  +${e.amount} (${t('combat.logHeal')})`;
    case 'shield':
      return `${nameOf(e.tgt)}  +${e.amount} (${t('combat.logShield')})`;
    case 'buffApplied':
      return `${nameOf(e.unit)} ${t('combat.buffGain')} ${e.tag}`;
    case 'buffExpired':
      return `${nameOf(e.unit)} ${t('combat.buffEnd')} ${e.tag}`;
    case 'control':
      return `${nameOf(e.tgt)} ${e.landed ? t('combat.controlled') : t('combat.immune')} ${e.kind}`;
    case 'rageChange':
      return `${nameOf(e.unit)} ${t('combat.logRage')} ${e.delta >= 0 ? '+' : ''}${e.delta}`;
    case 'death':
      return `${nameOf(e.unit)} ${t('combat.knockedOut')}`;
    case 'immunity':
      return `${nameOf(e.unit)} ${t('combat.immune')} ${e.kind}`;
    case 'result':
      return `${t('combat.result')}: ${e.winner} (${e.rounds})`;
  }
}
