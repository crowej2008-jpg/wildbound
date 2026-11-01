import { applyBuff } from './buffs';
import { evalCondition } from './conditions';
import { addRage } from './rage';
import { applyEffectList } from './effects';
import { scaleBuff } from './scaling';
import type { BattleContext, Combatant, TriggerDef, TriggerOn, SkillSlot } from './types';

/**
 * Talent triggers (M9.4). A trigger is gated by its own condition, HP threshold,
 * per-turn cap, cooldown and chance roll before its payload (effect list, a Rage
 * delta, or a self buff) resolves. Nesting is bounded by
 * `settings.triggerDepthCap` so two on-hit retaliations cannot loop forever.
 */
export function fireTriggers(
  ctx: BattleContext,
  self: Combatant,
  on: TriggerOn,
  opts: { target?: Combatant; amount?: number; actor?: Combatant; slot?: SkillSlot } = {},
): void {
  const kitList = self.kit.talents?.triggers ?? [];
  const list = self.triggers && self.triggers.length > 0 ? [...kitList, ...self.triggers] : kitList;
  if (list.length === 0) return;
  if ((ctx.triggerDepth ?? 0) >= ctx.settings.triggerDepthCap) return;

  ctx.triggerDepth = (ctx.triggerDepth ?? 0) + 1;
  try {
    const counters = counterMap(ctx);
    for (let idx = 0; idx < list.length; idx += 1) {
      const t = list[idx]!;
      if (t.on !== on) continue;
      if (on !== 'onDeath' && !self.alive) continue;
      if (t.condition) {
        const prevActor = ctx.eventActor;
        const prevSlot = ctx.eventSlot;
        ctx.eventActor = opts.actor;
        ctx.eventSlot = opts.slot;
        const ok = evalCondition(t.condition, ctx, self, opts.target);
        ctx.eventActor = prevActor;
        ctx.eventSlot = prevSlot;
        if (!ok) continue;
      }

      const firedKey = `${self.key}#trig#${idx}#fired`;
      if (t.hpBelow !== undefined) {
        const frac = self.maxHp > 0 ? self.hp / self.maxHp : 0;
        if (frac >= t.hpBelow) {
          counters.delete(firedKey); // re-arm once HP climbs back above
          continue;
        }
        if (counters.has(firedKey)) continue; // already fired this crossing
      }

      if (t.perTurn !== undefined) {
        const key = `${self.key}#trig#${idx}#r${ctx.round}`;
        if ((counters.get(key) ?? 0) >= t.perTurn) continue;
      }
      if (t.cooldown !== undefined && ctx.round < (counters.get(`${self.key}#trig#${idx}#cd`) ?? 0)) continue;
      const firesKey = `${self.key}#trig#${idx}#fires`;
      if (t.maxFires !== undefined && (counters.get(firesKey) ?? 0) >= t.maxFires) continue;
      if (t.chance !== undefined && !(ctx.deterministic ? false : ctx.rng() < t.chance)) continue;

      if (t.hpBelow !== undefined) counters.set(firedKey, 1);
      if (t.perTurn !== undefined) {
        const key = `${self.key}#trig#${idx}#r${ctx.round}`;
        counters.set(key, (counters.get(key) ?? 0) + 1);
      }
      if (t.cooldown !== undefined) counters.set(`${self.key}#trig#${idx}#cd`, ctx.round + t.cooldown);
      if (t.maxFires !== undefined) counters.set(firesKey, (counters.get(firesKey) ?? 0) + 1);
      const prevAmount = ctx.eventAmount;
      const prevActor = ctx.eventActor;
      ctx.eventAmount = opts.amount;
      ctx.eventActor = opts.actor;
      try {
        activate(ctx, self, t, opts.target);
      } finally {
        ctx.eventAmount = prevAmount;
        ctx.eventActor = prevActor;
      }
    }
  } finally {
    ctx.triggerDepth -= 1;
  }
}

function activate(ctx: BattleContext, self: Combatant, t: TriggerDef, target?: Combatant): void {
  if (t.rage) addRage(ctx, self, t.rage);
  if (t.buff) applyBuff(self, scaleBuff(t.buff, self.level ?? 1), ctx, self.id);
  applyEffectList(ctx, self, t.effects, 'P', target ? [target] : [], { allowDeadCaster: true });
}

function counterMap(ctx: BattleContext): Map<string, number> {
  ctx.counters ??= new Map<string, number>();
  return ctx.counters;
}
