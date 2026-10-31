import type { Buff, Combatant, BattleContext, BuffSpec } from './types';

/**
 * Buff stack rules (measured: stats-and-combat.md Â§1.4):
 * - a live stack with the same tag refreshes its duration and never adds,
 * - stacking buffs (maxStacks) carry one tag per stack and add a further stack,
 * - durations tick at the end of the holder's own turn (setting buffTickTiming).
 */

export function hasLiveBuff(u: Combatant, tag: string): boolean {
  return u.buffs.some((b) => b.tag === tag);
}

export function countStacks(u: Combatant, tag: string): number {
  let n = 0;
  for (const b of u.buffs) if (b.tag.startsWith(tag) && b.kind === 'stat') n += 1;
  return n;
}

/** Stacking amounts must carry a per-stack tag: `${tag}#${i}`. */
export function stackTag(tag: string, index: number): string {
  return `${tag}#${index}`;
}

export function maxStackTag(tag: string, stacks: number): string {
  return stackTag(tag, stacks - 1);
}

/** Apply a buff to `unit`. Same-tag refresh (never stacks); maxStacks caps new stacks. */
export function applyBuff(
  u: Combatant,
  spec: BuffSpec,
  ctx: BattleContext,
  source: string,
): void {
  const explicitStacks = spec.kind === 'stat' && spec.amount !== undefined;
  if (explicitStacks && spec.maxStacks !== undefined) {
    const n = countStacks(u, spec.tag);
    if (n >= spec.maxStacks) return;
    const tag = stackTag(spec.tag, n);
    pushBuff(u, { ...baseBuff(spec, source), tag });
    ctx.events.push({ type: 'buffApplied', unit: u.key, tag: spec.tag, amount: spec.amount ?? 0, stacks: n + 1 });
    return;
  }
  if (hasLiveBuff(u, spec.tag)) return; // refresh, never stack
  const b = baseBuff(spec, source);
  pushBuff(u, b);
  ctx.events.push({ type: 'buffApplied', unit: u.key, tag: spec.tag, amount: spec.amount ?? 0 });
}

function pushBuff(u: Combatant, b: Buff): void {
  u.buffs.push(b);
}

function baseBuff(spec: BuffSpec, source: string): Buff {
  return {
    tag: spec.tag,
    kind: spec.kind,
    source,
    field: spec.field,
    amount: spec.amount,
    turns: spec.turns,
    bigRounds: spec.bigRounds,
    chance: spec.chance,
    redirectChance: spec.redirectChance,
    undispellable: spec.undispellable,
  };
}

/** Kinds a cleanse treats as "negative" (removable by an ally cleanse). */
export const NEGATIVE_KINDS: Buff['kind'][] = ['control', 'silence', 'confusion', 'paralysis', 'dot', 'rageBlock'];

export function isNegativeBuff(b: Buff): boolean {
  if (b.kind === 'stat') return (b.amount ?? 0) < 0;
  return NEGATIVE_KINDS.includes(b.kind);
}

export function isPositiveBuff(b: Buff): boolean {
  if (b.kind === 'stat') return (b.amount ?? 0) > 0;
  return b.kind === 'immune' || b.kind === 'regen' || b.kind === 'stack';
}

/**
 * Remove up to `count` (all when undefined) negative or positive buffs from `u`.
 * `undispellable` buffs are never removed; `kinds` narrows to tags/kinds.
 * Returns how many were removed.
 */
export function stripBuffs(
  u: Combatant,
  ctx: BattleContext,
  negative: boolean,
  count?: number,
  kinds?: string[],
  order: 'oldestFirst' | 'newestFirst' = 'oldestFirst',
): number {
  const matches: number[] = [];
  for (let i = 0; i < u.buffs.length; i += 1) {
    const b = u.buffs[i]!;
    if (b.undispellable === true) continue;
    if (kinds && kinds.length > 0 && !kinds.includes(b.tag) && !kinds.includes(b.kind)) continue;
    const ok = negative ? isNegativeBuff(b) : isPositiveBuff(b);
    if (ok) matches.push(i);
  }
  const picked = order === 'newestFirst' ? matches.slice(-(count ?? matches.length)) : matches.slice(0, count ?? matches.length);
  const remove = new Set(picked);
  let removed = 0;
  for (let i = u.buffs.length - 1; i >= 0; i -= 1) {
    if (!remove.has(i)) continue;
    const b = u.buffs.splice(i, 1)[0]!;
    ctx.events.push({ type: 'buffExpired', unit: u.key, tag: b.tag });
    removed += 1;
  }
  return removed;
}

/**
 * A buff has exactly one duration dimension: `turns` (the holder's own turns,
 * ticked at the end of the holder's action) or `bigRounds` (ticked at big-round
 * end). `tickUnitBuffs` handles turn-based durations only.
 */
export function tickUnitBuffs(u: Combatant, ctx: BattleContext): void {
  for (let i = u.buffs.length - 1; i >= 0; i -= 1) {
    const b = u.buffs[i]!;
    if (b.turns === undefined) continue;
    b.turns -= 1;
    if (b.turns <= 0) {
      u.buffs.splice(i, 1);
      ctx.events.push({ type: 'buffExpired', unit: u.key, tag: b.tag });
    }
  }
}

/** Tick big-round-wide durations (confusion, some DoT) at round end. */
export function tickBigRoundBuffs(u: Combatant, ctx: BattleContext): void {
  for (let i = u.buffs.length - 1; i >= 0; i -= 1) {
    const b = u.buffs[i]!;
    if (b.bigRounds === undefined) continue;
    b.bigRounds -= 1;
    if (b.bigRounds <= 0) {
      u.buffs.splice(i, 1);
      ctx.events.push({ type: 'buffExpired', unit: u.key, tag: b.tag });
    }
  }
}

/** Remove every buff with a tag (used by cleanses). */
export function removeBuffTag(u: Combatant, ctx: BattleContext, tag: string): void {
  for (let i = u.buffs.length - 1; i >= 0; i -= 1) {
    if (u.buffs[i]!.tag.startsWith(tag)) {
      const removed = u.buffs.splice(i, 1)[0]!;
      ctx.events.push({ type: 'buffExpired', unit: u.key, tag: removed.tag });
    }
  }
}

export const CONTROL_KINDS: Record<string, { skip?: boolean; silence?: boolean; confusion?: boolean; paralysis?: boolean }> = {
  freeze: { skip: true },
  stun: { skip: true },
  sleep: { skip: true },
  confinement: { skip: true },
  taunt: { skip: true },
  silence: { silence: true },
  confusion: { confusion: true },
  paralysis: { paralysis: true },
};