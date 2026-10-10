import { channelHit } from './damage';
import { effective } from './stats';
import type { BattleContext, Combatant, SkillDef } from './types';

/**
 * Counter reflect (measured â€” stats-and-combat.md Current picture 75):
 *   reflect = floor(counterShare Ã— T Ã— (1 + counterBoost))
 * T = the HP the caster lost in the previous big round from any source (shield
 * loss excluded); none in big round 1. It is a separate HP change applied after
 * the base hit: no factor, no shield, no crit, no block; every target of the
 * hit takes the full amount.
 */
export function applyCounterReflect(
  ctx: BattleContext,
  caster: Combatant,
  skill: SkillDef,
  targets: Combatant[],
  bigRound: number,
): void {
  if (!skill.counter || bigRound <= 1) return;
  const share = caster.kit.counterShare ?? ctx.settings.counterShare;
  const boost = effective(caster.base, caster.buffs, 'counterBoost');
  const reflected = Math.floor(share * caster.lostLastRound * (1 + boost));
  if (reflected <= 0) return;
  for (const t of targets) {
    if (!t.alive) continue;
    channelHit(ctx, caster, t, reflected, { kind: 'reflect' });
  }
}