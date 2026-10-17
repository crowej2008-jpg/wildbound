import { effective } from './stats';
import { scaleBuff } from './scaling';
import { applyBuff } from './buffs';
import type { BattleContext, Combatant, SkillDef } from './types';

/**
 * Sustain (measured â€” stats-and-combat.md 7):
 * - heal = base% Ã— maxHp Ã— (1 + healer.healBoost) Ã— (1 + target.receiveHealBoost)
 *   (Treatment multiplies the base; receive-treatment adds to a bonus term).
 * - shields scale with the caster's max HP and absorb damage first.
 * - lifesteal heals `damage dealt Ã— rate`.
 */
export function resolveHealAmount(
  ctx: BattleContext,
  caster: Combatant,
  target: Combatant,
  rate: number,
): number {
  const base = ctx.settings.healBasis === 'casterAtk' ? eff(caster, 'pAtk') : target.base.hp;
  return Math.floor(rate * base * (1 + eff(caster, 'healBoost')) * (1 + eff(target, 'receiveHealBoost')));
}

export function applyHeal(ctx: BattleContext, target: Combatant, amount: number): void {
  const before = target.hp;
  target.hp = Math.min(target.base.hp, target.hp + amount);
  const delta = target.hp - before;
  if (delta > 0) {
    ctx.events.push({ type: 'heal', tgt: target.key, amount: delta, hpAfter: target.hp });
    ctx.healingDone[target.key] = (ctx.healingDone[target.key] ?? 0) + delta;
  }
}

export function applyShield(ctx: BattleContext, target: Combatant, share: number, caster: Combatant): void {
  applyShieldAmount(ctx, target, Math.floor(share * caster.base.hp));
}

/** M9: add a flat shield amount (already resolved). */
export function applyShieldAmount(ctx: BattleContext, target: Combatant, amount: number): void {
  if (amount <= 0) return;
  target.shieldHp += amount;
  ctx.events.push({ type: 'shield', tgt: target.key, amount, shieldAfter: target.shieldHp });
}

/** M9: heal amount with an explicit basis (effect riders, regen). */
export function resolveHealWithBasis(
  ctx: BattleContext,
  caster: Combatant,
  target: Combatant,
  rate: number,
  basis?: 'targetMaxHp' | 'casterAtk',
): number {
  const b = basis ?? ctx.settings.healBasis;
  const base = b === 'casterAtk' ? eff(caster, 'pAtk') : target.base.hp;
  return Math.floor(rate * base * (1 + eff(caster, 'healBoost')) * (1 + eff(target, 'receiveHealBoost')));
}

export function applyLifesteal(ctx: BattleContext, caster: Combatant, damaged: number, rate: number): void {
  const amount = Math.floor(damaged * rate);
  if (amount > 0) applyHeal(ctx, caster, amount);
}

/** Resolve a skill's buffs / heal / shield / lifesteal side effects. */
export function applySkillSideEffects(
  ctx: BattleContext,
  attacker: Combatant,
  skill: SkillDef,
  targets: Combatant[],
  hitDamages: number[],
): void {
  for (const b of skill.selfBuffs ?? []) applyBuff(attacker, scaleBuff(b, attacker.level ?? 1), ctx, attacker.id);
  if (skill.lifesteal) {
    applyLifesteal(ctx, attacker, hitDamages.reduce((a, b) => a + b, 0), skill.lifesteal);
  }
  if (skill.heal) {
    const pool = resolvePool(ctx, attacker, skill.heal.target, targets);
    for (const t of pool) applyHeal(ctx, t, resolveHealAmount(ctx, attacker, t, skill.heal.rate));
  }
  if (skill.shield) {
    const pool = resolvePool(ctx, attacker, skill.shield.target, targets);
    for (const t of pool) applyShield(ctx, t, skill.shield.share, attacker);
  }
}

function resolvePool(
  ctx: BattleContext,
  attacker: Combatant,
  target: 'ally' | 'self' | 'allies',
  targets: Combatant[],
): Combatant[] {
  const ownSide = ctx.units.filter((u) => u.side === attacker.side && u.alive);
  if (target === 'self') return [attacker];
  if (target === 'allies') return ownSide;
  if (target === 'ally') {
    const hurt = ownSide.slice().sort((a, b) => a.hp / a.base.hp - b.hp / b.base.hp);
    return hurt.slice(0, 1);
  }
  return targets;
}

function eff(u: Combatant, field: 'pAtk' | 'healBoost' | 'receiveHealBoost'): number {
  return effective(u.base, u.buffs, field);
}