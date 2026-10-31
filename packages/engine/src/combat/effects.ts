import { applyBuff, stripBuffs } from './buffs';
import { evalCondition } from './conditions';
import { applyControl } from './control';
import { channelHit } from './damage';
import { addRage } from './rage';
import { applyDotTag, applyRegen } from './dot';
import { applyHeal, applyShieldAmount, resolveHealWithBasis } from './sustain';
import { selectFor } from './targeting';
import { extraAction } from './skills';
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
  // E3: an extra action is the caster's own; it picks its targets itself.
  if (e.op === 'extraAction') return [caster];
  if (!e.target || e.target.event) return fallback;
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
      let amount = resolveHealWithBasis(ctx, caster, t, e.rate, e.basis);
      if (e.bonusVs && evalCondition(e.bonusVs.condition, ctx, caster, t)) amount = Math.floor(amount * e.bonusVs.mult);
      if (e.perResource) amount = Math.floor(amount * (caster.resources?.[e.perResource] ?? 0));
      if (e.perTagged) amount = Math.floor(amount * countTagged(ctx, caster, e.perTagged));
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
      if (e.perTagged) {
        const n = countTagged(ctx, caster, e.perTagged);
        if (n > 0) addRage(ctx, t, (e.delta ?? 0) * n, e.force === true);
        return;
      }
      if (e.fill) {
        addRage(ctx, t, ctx.settings.rageMax - t.rage, e.force === true);
        return;
      }
      const amount = e.delta ?? Math.floor((e.pct ?? 0) * ctx.settings.rageMax);
      if (e.steal) {
        const taken = Math.min(t.rage, Math.max(0, amount));
        addRage(ctx, t, -taken);
        addRage(ctx, caster, taken);
      } else {
        addRage(ctx, t, amount, e.force === true);
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
      let dmg = e.basis ? hpBasisDamage(ctx, e, caster, t) : attackBasisDamage(e, caster, skillType);
      if (e.capRate !== undefined) {
        const atk = effective(caster.base, caster.buffs, (e.type ?? skillType) === 'P' ? 'pAtk' : 'sAtk');
        dmg = Math.max(1, Math.min(dmg, Math.floor(atk * e.capRate)));
      }
      channelHit(ctx, caster, t, dmg, { trueDmg: e.trueDamage === true, kind: 'hit' });
      return;
    }
    case 'extraAction':
      extraAction(ctx, caster, e.slot, e.noRage === true, ctx.team ?? { attackersPower: 0, defendersPower: 0 });
      return;
    case 'splash': {
      const dealt = ctx.castDamage?.get(t.key) ?? ctx.eventAmount ?? 0;
      const amount = Math.floor(e.share * dealt);
      if (amount <= 0) return;
      for (const n of neighbours(ctx, t)) channelHit(ctx, caster, n, amount, { kind: 'hit', trueDmg: true });
      return;
    }
    case 'breakShield':
      if (t.shieldHp > 0) {
        ctx.events.push({ type: 'shield', tgt: t.key, amount: t.shieldHp, shieldAfter: 0 });
        t.shieldHp = 0;
      }
      return;
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

/** A secondary hit scaled from an HP basis: the target's, the caster's (E3) or the event's (E3). */
function hpBasisDamage(
  ctx: BattleContext,
  e: Extract<Effect, { op: 'damage' }>,
  caster: Combatant,
  t: Combatant,
): number {
  const base =
    e.basis === 'targetCurrentHp'
      ? t.hp
      : e.basis === 'targetMissingHp'
        ? Math.max(0, t.maxHp - t.hp)
        : e.basis === 'casterCurrentHp'
          ? caster.hp
          : e.basis === 'casterMissingHp'
            ? Math.max(0, caster.maxHp - caster.hp)
          : e.basis === 'casterLostTotal'
            ? caster.lostTotal ?? 0
            : e.basis === 'casterLostLastRound'
              ? caster.lostLastRound
              : e.basis === 'eventDamage'
                ? ctx.eventAmount ?? 0
                : t.maxHp;
  return Math.max(1, Math.floor((e.share ?? 0) * base));
}

/** E4: living units on one side (relative to the caster) carrying a tag, capped at `max`. */
function countTagged(ctx: BattleContext, caster: Combatant, p: { side: 'enemy' | 'ally'; tag: string; max?: number }): number {
  const n = ctx.units.filter(
    (u) =>
      u.alive &&
      (p.side === 'ally' ? u.side === caster.side : u.side !== caster.side) &&
      u.buffs.some((b) => b.tag === p.tag || b.tag.startsWith(`${p.tag}#`)),
  ).length;
  return p.max === undefined ? n : Math.min(p.max, n);
}

/** E3: the units next to `t` on its own side — left/right in its row and the one in front/behind. */
function neighbours(ctx: BattleContext, t: Combatant): Combatant[] {
  return ctx.units.filter(
    (u) =>
      u !== t &&
      u.alive &&
      u.side === t.side &&
      ((u.row === t.row && Math.abs(u.column - t.column) === 1) || (u.row !== t.row && u.column === t.column)),
  );
}

/** Chance success: deterministic mode never succeeds (mirrors the control roll). */
function rolls(ctx: BattleContext, chance: number): boolean {
  if (ctx.deterministic) return false;
  return ctx.rng() < chance;
}
