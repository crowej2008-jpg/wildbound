import { fireTriggers } from './triggers';
import type { BattleContext, Combatant, ControlSpec, Buff } from './types';

/**
 * Control application (M9 extraction of the M1 logic in skills.ts).
 * Stated-% controls land with a clamped (1 − Res) factor; guaranteed ones only
 * an immunity buff stops. Deterministic mode forces the roll to ~0 (never land).
 */
export function applyControl(
  ctx: BattleContext,
  attacker: Combatant,
  targets: Combatant[],
  control: Pick<ControlSpec, 'kind' | 'chance'>,
): void {
  for (const t of targets) {
    if (!t.alive) continue;
    const immunity = t.buffs.some((b) => b.kind === 'immune');
    if (control.chance === null) {
      if (immunity) {
        ctx.events.push({ type: 'immunity', unit: t.key, kind: control.kind });
        continue;
      }
      landControl(ctx, attacker, t, control.kind);
      continue;
    }
    if (ctx.deterministic) {
      ctx.events.push({ type: 'control', tgt: t.key, kind: control.kind, landed: false });
      continue;
    }
    const p = Math.min(
      1,
      Math.max(0, control.chance * (1 - (ctrlStat(t, 'controlRes') - ctrlStat(attacker, 'controlBoost')))),
    );
    const landed = ctx.rng() < p;
    if (landed && !immunity) landControl(ctx, attacker, t, control.kind);
    else if (landed) ctx.events.push({ type: 'immunity', unit: t.key, kind: control.kind });
    else ctx.events.push({ type: 'control', tgt: t.key, kind: control.kind, landed: false });
  }
}

export function landControl(ctx: BattleContext, attacker: Combatant, t: Combatant, kind: string): void {
  const b: Buff = { tag: kind, kind: buffKindFor(kind), source: attacker.id, turns: 1 };
  if (b.kind === 'confusion') {
    b.redirectChance = ctx.settings.redirectChance;
    b.bigRounds = 1;
  }
  // a live same-kind control is never refreshed or stacked (measured)
  if (t.buffs.some((x) => x.tag === kind)) {
    ctx.events.push({ type: 'control', tgt: t.key, kind, landed: false });
    return;
  }
  t.buffs.push(b);
  ctx.events.push({ type: 'control', tgt: t.key, kind, landed: true });
  // E1: "when controlled" (Lax Incense, Assault Vest) and "after landing a control" (King's Rock).
  if (b.kind !== 'taunt') {
    fireTriggers(ctx, t, 'onControlled', { target: attacker });
    if (attacker !== t) fireTriggers(ctx, attacker, 'onInflictControl', { target: t });
  }
}

export function buffKindFor(kind: string): Buff['kind'] {
  if (kind === 'silence') return 'silence';
  if (kind === 'confusion') return 'confusion';
  if (kind === 'paralysis') return 'paralysis';
  if (kind === 'taunt') return 'taunt';
  return 'control';
}

function ctrlStat(u: Combatant, field: 'controlRes' | 'controlBoost'): number {
  return u.base[field] + u.buffs.reduce((acc, b) => acc + (b.kind === 'stat' && b.field === field ? b.amount ?? 0 : 0), 0);
}
