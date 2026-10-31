import type { BattleContext, Combatant } from './types';

/**
 * The single Rage mutator (extracted in M9.4 so talent triggers can use it
 * without a cycle through damage.ts). Clamped to `[0, rageMax]`; emits the
 * `rageChange` event only when the bar actually moved.
 */
export function addRage(ctx: BattleContext, u: Combatant, delta: number): void {
  // E1: a live `rageBlock` stops every Rage gain (losses still apply).
  if (delta > 0 && u.buffs.some((b) => b.kind === 'rageBlock')) return;
  const before = u.rage;
  u.rage = Math.max(0, Math.min(ctx.settings.rageMax, u.rage + delta));
  const applied = u.rage - before;
  if (applied !== 0) ctx.events.push({ type: 'rageChange', unit: u.key, delta: applied, rage: u.rage });
}
