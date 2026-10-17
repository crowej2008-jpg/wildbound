import { countStacks } from './buffs';
import type { BattleContext, Combatant, Condition } from './types';

/**
 * Condition evaluation (M9). Every present clause must hold; an absent clause is
 * ignored, so `{}` / `undefined` is always true. Pure and deterministic.
 */

export function evalCondition(
  cond: Condition | undefined,
  ctx: BattleContext,
  self: Combatant,
  target?: Combatant,
): boolean {
  if (!cond) return true;

  if (cond.selfHpBelow !== undefined && !hpBelow(self, cond.selfHpBelow)) return false;
  if (cond.selfHpAbove !== undefined && !hpAbove(self, cond.selfHpAbove)) return false;
  if (target) {
    if (cond.targetHpBelow !== undefined && !hpBelow(target, cond.targetHpBelow)) return false;
    if (cond.targetHpAbove !== undefined && !hpAbove(target, cond.targetHpAbove)) return false;
    if (cond.targetHasTag !== undefined && !hasTag(target, cond.targetHasTag)) return false;
    if (cond.targetHasDot !== undefined && cond.targetHasDot !== hasDot(target)) return false;
    if (cond.targetControlled !== undefined && cond.targetControlled !== isControlled(target)) return false;
    if (cond.targetRow !== undefined && target.row !== cond.targetRow) return false;
    if (cond.targetTrait !== undefined && !(target.kit.traits ?? []).includes(cond.targetTrait)) return false;
    if (cond.targetStackAtLeast && !(stackCount(target, cond.targetStackAtLeast.tag) >= cond.targetStackAtLeast.n)) {
      return false;
    }
  }
  if (cond.selfHasTag !== undefined && !hasTag(self, cond.selfHasTag)) return false;
  if (cond.selfStackAtLeast && !(stackCount(self, cond.selfStackAtLeast.tag) >= cond.selfStackAtLeast.n)) return false;
  if (cond.allyUnderControl !== undefined && cond.allyUnderControl !== allyUnderControl(ctx, self)) return false;

  return true;
}

export function isControlled(u: Combatant): boolean {
  return u.buffs.some((b) => b.kind === 'control' || b.kind === 'silence' || b.kind === 'confusion' || b.kind === 'paralysis');
}

export function hasDot(u: Combatant): boolean {
  return u.buffs.some((b) => b.kind === 'dot');
}

function hasTag(u: Combatant, tag: string): boolean {
  return u.buffs.some((b) => b.tag === tag || b.tag.startsWith(`${tag}#`));
}

/** Stacks for a tag: stat-buff stacks today, plus resource counters once M9.3 lands. */
export function stackCount(u: Combatant, tag: string): number {
  return countStacks(u, tag) + (u.resources?.[tag] ?? 0);
}

function hpBelow(u: Combatant, fraction: number): boolean {
  return u.maxHp > 0 && u.hp / u.maxHp < fraction;
}

function hpAbove(u: Combatant, fraction: number): boolean {
  return u.maxHp > 0 && u.hp / u.maxHp > fraction;
}

function allyUnderControl(ctx: BattleContext, self: Combatant): boolean {
  return ctx.units.some((u) => u.side === self.side && u.alive && isControlled(u));
}
