import { channelHit } from './damage';
import { applyHeal } from './sustain';
import { effective } from './stats';
import type { BattleContext, Buff, Combatant, DamageType, DotSpec } from './types';

/**
 * Damage-over-time and regeneration (M9 extraction). DoTs tick at the start of
 * the holder's turn; their big-round duration is ticked at big-round end by
 * `tickBigRoundBuffs`. A regen buff heals a flat amount at the same point.
 */

/** M1 DoT form: `%` of the target's max HP, two big rounds. */
export function applyDot(ctx: BattleContext, src: Combatant, t: Combatant, share: number): void {
  if (share <= 0) return;
  t.buffs.push({ tag: `${src.id}#dot`, kind: 'dot', source: src.key, amount: share, basis: 'targetMaxHp', bigRounds: 2 });
  ctx.events.push({ type: 'buffApplied', unit: t.key, tag: 'dot', amount: share });
}

/** M9 structured DoT: a basis (target max HP, caster attack, or target current HP). */
export function applyDotSpec(
  ctx: BattleContext,
  src: Combatant,
  t: Combatant,
  dot: DotSpec,
  skillType: DamageType,
): void {
  if (dot.share <= 0) return;
  if (dot.maxStacks !== undefined) {
    const n = t.buffs.filter((b) => b.kind === 'dot' && b.tag.startsWith(`${src.id}#dot`)).length;
    if (n >= dot.maxStacks) return;
  }
  const basis = dot.basis ?? 'targetMaxHp';
  const type = dot.type ?? skillType;
  const power = type === 'P' ? effective(src.base, src.buffs, 'pAtk') : effective(src.base, src.buffs, 'sAtk');
  t.buffs.push({
    tag: `${src.id}#dot`,
    kind: 'dot',
    source: src.key,
    amount: dot.share,
    basis,
    power,
    undispellable: dot.undispellable,
    bigRounds: dot.turns ?? 2,
  });
  ctx.events.push({ type: 'buffApplied', unit: t.key, tag: 'dot', amount: dot.share });
}

/** A clean, non-stacking DoT applied by an effect/rider (replaces the same source tag). */
export function applyDotTag(ctx: BattleContext, src: Combatant, t: Combatant, tag: string, dot: DotSpec, skillType: DamageType): void {
  if (dot.share <= 0) return;
  const idx = t.buffs.findIndex((b) => b.kind === 'dot' && b.tag === tag);
  const type = dot.type ?? skillType;
  const power = type === 'P' ? effective(src.base, src.buffs, 'pAtk') : effective(src.base, src.buffs, 'sAtk');
  const buff: Buff = {
    tag,
    kind: 'dot',
    source: src.key,
    amount: dot.share,
    basis: dot.basis ?? 'targetMaxHp',
    power,
    undispellable: dot.undispellable,
    bigRounds: dot.turns ?? 2,
  };
  if (idx >= 0) t.buffs[idx] = buff;
  else t.buffs.push(buff);
  ctx.events.push({ type: 'buffApplied', unit: t.key, tag, amount: dot.share });
}

/** Heal-over-time (M9): a `regen` buff that heals `amount` at the holder's turn start. */
export function applyRegen(ctx: BattleContext, src: Combatant, t: Combatant, amount: number, turns: number): void {
  if (amount <= 0) return;
  t.buffs.push({ tag: 'regen', kind: 'regen', source: src.key, amount, turns });
  ctx.events.push({ type: 'buffApplied', unit: t.key, tag: 'regen', amount });
}

export function tickDots(ctx: BattleContext, u: Combatant): void {
  const dots = u.buffs.filter((b) => b.kind === 'dot');
  if (dots.length === 0) return;
  for (const d of dots) {
    const src = ctx.units.find((x) => x.key === d.source);
    const dmg = dotDamage(d, u);
    if (dmg > 0) channelHit(ctx, src ?? u, u, dmg, { kind: 'dot' });
  }
  // duration (bigRounds) is ticked at big-round end by tickBigRoundBuffs
}

export function tickRegen(ctx: BattleContext, u: Combatant): void {
  for (const b of u.buffs.filter((x) => x.kind === 'regen')) {
    applyHeal(ctx, u, b.amount ?? 0);
  }
}

function dotDamage(d: Buff, target: Combatant): number {
  const share = d.amount ?? 0;
  if (d.basis === 'casterAtk') return Math.floor(share * (d.power ?? 0));
  if (d.basis === 'targetCurrentHp') return Math.floor(share * target.hp);
  return Math.floor(share * target.base.hp);
}
