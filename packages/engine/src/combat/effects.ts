import { applyBuff, stripBuffs } from './buffs';
import { evalCondition } from './conditions';
import { applyControl } from './control';
import { channelHit } from './damage';
import { addRage } from './rage';
import { applyDotTag, applyRegen } from './dot';
import { applyHeal, applyShieldAmount, resolveHealWithBasis } from './sustain';
import { selectFor } from './targeting';
import { effective } from './stats';
import { scaleBuff } from './scaling';
import type { BattleContext, Combatant, DamageType, Effect, SkillDef } from './types';

/**
 * Effect riders (M9.2). Run after a skill's damage step, in declaration order.
 * A rider targets via `selectFor` (or the skill's own targets when it omits one),
 * and is gated by its own `condition` and `chance`. Deterministic mode never
 * rolls a chance success (the M1 convention).
 */
export function applyEffects(
  ctx: BattleContext,
  caster: Combatant,
  skill: SkillDef,
  fallbackTargets: Combatant[],
): void {
  applyEffectList(ctx, caster, skill.effects, skill.type, fallbackTargets);
}

/** Run an ordered effect list (used by skills and by talent triggers). */
export function applyEffectList(
  ctx: BattleContext,
  caster: Combatant,
  effects: Effect[] | undefined,
  skillType: DamageType,
  fallbackTargets: Combatant[],
  opts: { allowDeadCaster?: boolean } = {},
): void {
  for (const e of effects ?? []) {
    for (const t of targetsFor(ctx, caster, e, fallbackTargets)) {
      if (!caster.alive && opts.allowDeadCaster !== true) return;
      if (e.op !== 'revive' && !t.alive) continue;
      if (e.condition && !evalCondition(e.condition, ctx, caster, t)) continue;
      if (e.chance !== undefined && !rolls(ctx, e.chance)) continue;
      resolve(ctx, caster, t, e, skillType);
    }
  }
}

function targetsFor(ctx: BattleContext, caster: Combatant, e: Effect, fallback: Combatant[]): Combatant[] {
  if (e.op === 'revive') return deadAllies(ctx, caster);
  if (!e.target) return fallback;
  return selectFor(ctx, caster, e.target);
}

function resolve(ctx: BattleContext, caster: Combatant, t: Combatant, e: Effect, skillType: DamageType): void {
  switch (e.op) {
    case 'buff':
      applyBuff(t, scaleBuff(e.buff, caster.level ?? 1), ctx, caster.id);
      return;
    case 'dot': {
      const tag = e.tag ?? `${caster.id}#dot`;
      applyDotTag(ctx, caster, t, tag, e.dot, skillType);
      return;
    }
    case 'control':
      applyControl(ctx, caster, [t], e.control);
      return;
    case 'heal': {
      const amount = resolveHealWithBasis(ctx, caster, t, e.rate, e.basis);
      if (e.over !== undefined && e.over > 0) applyRegen(ctx, caster, t, Math.floor(amount / e.over), e.over);
      else applyHeal(ctx, t, amount);
      return;
    }
    case 'shield': {
      const amount =
        e.basis === 'casterAtk' ? Math.floor(e.share * effective(caster.base, caster.buffs, 'pAtk')) : Math.floor(e.share * caster.base.hp);
      applyShieldAmount(ctx, t, amount);
      return;
    }
    case 'cleanse':
      stripBuffs(t, ctx, true, e.count, e.kinds, ctx.settings.cleanseOrder);
      return;
    case 'dispel':
      stripBuffs(t, ctx, false, e.count, e.kinds, ctx.settings.cleanseOrder);
      return;
    case 'rage': {
      const amount = e.delta ?? Math.floor((e.pct ?? 0) * ctx.settings.rageMax);
      if (e.steal) {
        const taken = Math.min(t.rage, Math.max(0, amount));
        addRage(ctx, t, -taken);
        addRage(ctx, caster, taken);
      } else {
        addRage(ctx, t, amount);
      }
      return;
    }
    case 'revive': {
      const key = `${caster.key}#revive#${t.key}`;
      if (e.once && ctx.alreadyAppliedHooks.has(key)) return;
      ctx.alreadyAppliedHooks.add(key);
      t.alive = true;
      t.hp = Math.max(1, Math.floor(e.hpPct * t.maxHp));
      ctx.events.push({ type: 'heal', tgt: t.key, amount: t.hp, hpAfter: t.hp });
      return;
    }
    case 'resource': {
      const cur = t.resources?.[e.tag] ?? 0;
      const cap = e.max ?? ctx.settings.defaultResourceCap;
      const next = Math.max(0, Math.min(cap, cur + (e.delta ?? 0) - (e.consume ?? 0)));
      if (!t.resources) t.resources = {};
      t.resources[e.tag] = next;
      ctx.events.push({ type: 'buffApplied', unit: t.key, tag: e.tag, amount: next, stacks: next });
      return;
    }
    case 'damage': {
      const dmg = e.basis ? hpBasisDamage(e, t) : attackBasisDamage(e, caster, skillType);
      channelHit(ctx, caster, t, dmg, { trueDmg: e.trueDamage === true, kind: 'hit' });
      return;
    }
  }
}

function deadAllies(ctx: BattleContext, caster: Combatant): Combatant[] {
  return ctx.units.filter((u) => u.side === caster.side && !u.alive);
}

/** A secondary hit scaled from the caster's attack. */
function attackBasisDamage(
  e: Extract<Effect, { op: 'damage' }>,
  caster: Combatant,
  skillType: DamageType,
): number {
  const atk =
    (e.type ?? skillType) === 'P'
      ? effective(caster.base, caster.buffs, 'pAtk')
      : effective(caster.base, caster.buffs, 'sAtk');
  return Math.max(1, Math.floor(atk * (e.rate ?? 1)));
}

/** A secondary hit scaled from the target's HP (max / current / missing). */
function hpBasisDamage(e: Extract<Effect, { op: 'damage' }>, t: Combatant): number {
  const base =
    e.basis === 'targetCurrentHp' ? t.hp : e.basis === 'targetMissingHp' ? Math.max(0, t.maxHp - t.hp) : t.maxHp;
  return Math.max(1, Math.floor((e.share ?? 0) * base));
}

/** Chance success: deterministic mode never succeeds (mirrors the control roll). */
function rolls(ctx: BattleContext, chance: number): boolean {
  if (ctx.deterministic) return false;
  return ctx.rng() < chance;
}
