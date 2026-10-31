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
    // E3: an immunity may name the controls it stops ("Immune to Freeze"); none named = all.
    const immunity = t.buffs.some((b) => b.kind === 'immune' && (!b.immuneTo || b.immuneTo.includes(control.kind)));
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
    // E3: Metagross's Confuse forces every normal attack onto an ally; Zen Control is 50%.
    b.redirectChance = kind === 'mindControl' ? 1 : kind === 'zenControl' || kind === 'zen-control' ? 0.5 : ctx.settings.redirectChance;
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
  // E3: kits' named controls. Flinch / Nap = no basic skill; Shallow Sleep = no ultimate;
  // Crit Seal = no crits; Disarm = no normal attack or basic skill.
  if (kind === 'flinch' || kind === 'nap' || kind === 'noBasic') return 'noBasic';
  if (kind === 'shallowSleep' || kind === 'shallow-sleep') return 'silence';
  if (kind === 'critSeal' || kind === 'crit-seal' || kind === 'noCrit') return 'noCrit';
  if (kind === 'disarm') return 'disarm';
  if (kind === 'mindControl' || kind === 'zenControl' || kind === 'zen-control') return 'confusion';
  if (kind === 'silence') return 'silence';
  if (kind === 'confusion') return 'confusion';
  if (kind === 'paralysis') return 'paralysis';
  if (kind === 'taunt') return 'taunt';
  return 'control';
}

function ctrlStat(u: Combatant, field: 'controlRes' | 'controlBoost'): number {
  return u.base[field] + u.buffs.reduce((acc, b) => acc + (b.kind === 'stat' && b.field === field ? b.amount ?? 0 : 0), 0);
}
