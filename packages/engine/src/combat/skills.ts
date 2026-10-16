import { applyBuff } from './buffs';
import { addRage, channelHit, computeDamage, type TeamSides } from './damage';
import { applyCounterReflect } from './counter';
import { selectTargets } from './targeting';
import { applySkillSideEffects } from './sustain';
import type { BattleContext, Combatant, SkillSlot, Buff } from './types';

/**
 * One unit's action: pick the skill from Rage and the basic-skill rate, resolve
 * targets, run the damage pipeline per hit, then controls, side effects and the
 * counter reflect. Ticks DoT at the start of the holder's turn. A controlled
 * unit skips without acting and without action Rage.
 */
export interface ActionInput {
  bigRound: number;
  team: TeamSides;
}

export function takeTurn(ctx: BattleContext, u: Combatant, input: ActionInput): void {
  tickDots(ctx, u);

  const skip = u.buffs.some((b) => b.kind === 'control');
  const ultReady = ctx.rules?.noUltimate !== true && u.rage >= ctx.settings.ultRageCost;
  const paralysis = u.buffs.some((b) => b.kind === 'paralysis');

  if (skip || (paralysis && !ultReady)) {
    ctx.events.push({ type: 'action', unit: u.key, skill: null });
    return;
  }

  const silence = u.buffs.some((b) => b.kind === 'silence');
  const slot: SkillSlot = ultReady && !silence ? 'ult' : rollSkillSlot(ctx);
  const skill = u.kit.skills[slot];
  ctx.events.push({ type: 'action', unit: u.key, skill: slot });

  let targets = selectTargets(ctx, u, skill);
  const confused = u.buffs.some((b) => b.kind === 'confusion');
  if (confused && slot === 'normal' && ctx.rng() < confusionChance(ctx, u)) {
    // normal attack turns on its own side; ultimates are never redirected
    targets = livingAllies(ctx, u);
  }

  ctx.damageDealt[u.key] = ctx.damageDealt[u.key] ?? 0;

  const hitDamages: number[] = [];
  for (let i = 0; i < skill.rates.length; i += 1) {
    for (const t of [...targets]) {
      if (!t.alive || !u.alive) continue;
      const outcome = computeDamage({ attacker: u, defender: t, skill, hitIndex: i, team: input.team }, ctx);
      const dealt = channelHit(ctx, u, t, outcome.dmg, {
        crit: outcome.crit,
        blocked: outcome.blocked,
        hpShare: skill.damageType === 'hpShare',
      });
      hitDamages.push(dealt);
      ctx.damageDealt[u.key] = (ctx.damageDealt[u.key] ?? 0) + outcome.dmg;
      ctx.damageTaken[t.key] = (ctx.damageTaken[t.key] ?? 0) + outcome.dmg;
    }
  }

  if (skill.control) {
    applyControl(ctx, u, targets, skill.control);
  }
  for (const b of skill.targetDebuffs ?? []) {
    for (const t of targets) if (t.alive) applyBuff(t, b, ctx, u.id);
  }
  if (skill.damageType === 'dot') {
    for (const t of targets) {
      if (t.alive) applyDot(ctx, u, t, skill.hpShare!);
    }
  }
  applySkillSideEffects(ctx, u, skill, targets, hitDamages);
  applyCounterReflect(ctx, u, skill, targets, input.bigRound);

  if (slot === 'ult') {
    const before = u.rage;
    u.rage = Math.max(0, u.rage - ctx.settings.ultRageCost);
    ctx.events.push({ type: 'rageChange', unit: u.key, delta: u.rage - before, rage: u.rage });
  } else {
    addRage(ctx, u, ctx.settings.ragePerAction);
  }
  processTalentsOnAction(ctx, u);
}

function rollSkillSlot(ctx: BattleContext): SkillSlot {
  return ctx.rng() < ctx.settings.basicReplace ? 'basic' : 'normal';
}

function confusionChance(ctx: BattleContext, u: Combatant): number {
  const conf = u.buffs.find((b) => b.kind === 'confusion');
  return conf?.redirectChance ?? ctx.settings.redirectChance;
}

function livingAllies(ctx: BattleContext, u: Combatant): Combatant[] {
  return ctx.units.filter((x) => x.side === u.side && x.alive);
}

/** Stated-% controls land with a clamped (1 âˆ’ Res) factor; guaranteed ones only
 * an immunity buff stops. Deterministic mode forces the roll to ~0 (never land). */
function applyControl(
  ctx: BattleContext,
  attacker: Combatant,
  targets: Combatant[],
  control: { kind: string; chance: number | null },
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
    const p = Math.min(1, Math.max(0, control.chance * (1 - (ctrlStat(t, 'controlRes') - ctrlStat(attacker, 'controlBoost')))));
    const landed = ctx.rng() < p;
    if (landed && !immunity) landControl(ctx, attacker, t, control.kind);
    else if (landed) ctx.events.push({ type: 'immunity', unit: t.key, kind: control.kind });
    else ctx.events.push({ type: 'control', tgt: t.key, kind: control.kind, landed: false });
  }
}

function landControl(ctx: BattleContext, attacker: Combatant, t: Combatant, kind: string): void {
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
}

function buffKindFor(kind: string): Buff['kind'] {
  if (kind === 'silence') return 'silence';
  if (kind === 'confusion') return 'confusion';
  if (kind === 'paralysis') return 'paralysis';
  return 'control';
}

function ctrlStat(u: Combatant, field: 'controlRes' | 'controlBoost'): number {
  return u.base[field] + u.buffs.reduce((acc, b) => acc + (b.kind === 'stat' && b.field === field ? b.amount ?? 0 : 0), 0);
}

function applyDot(ctx: BattleContext, src: Combatant, t: Combatant, share: number): void {
  if (share <= 0) return;
  t.buffs.push({ tag: `${src.id}#dot`, kind: 'dot', source: src.key, amount: share, bigRounds: 2 });
  ctx.events.push({ type: 'buffApplied', unit: t.key, tag: 'dot', amount: share });
}

function tickDots(ctx: BattleContext, u: Combatant): void {
  const dots = u.buffs.filter((b) => b.kind === 'dot');
  if (dots.length === 0) return;
  for (const d of dots) {
    const src = ctx.units.find((x) => x.key === d.source);
    const dmg = Math.floor((d.amount ?? 0) * u.base.hp);
    if (dmg > 0) channelHit(ctx, src ?? u, u, dmg, { kind: 'dot' });
  }
  // duration (bigRounds) is ticked at big-round end by tickBigRoundBuffs
}

function processTalentsOnAction(ctx: BattleContext, u: Combatant): void {
  for (const hook of u.kit.talents?.turnHooks ?? []) {
    if (hook === 'allyShelterStack') applyAllyShelter(ctx, u);
  }
}

function applyAllyShelter(ctx: BattleContext, u: Combatant): void {
  ctx.alreadyAppliedHooks ??= new Set();
  const key = `${u.key}#${ctx.round}`;
  if (ctx.alreadyAppliedHooks.has(key)) return;
  ctx.alreadyAppliedHooks.add(key);
  const cfg = u.kit.hooksConfig?.allyShelterStack ?? {};
  const amount = typeof cfg.amount === 'number' ? cfg.amount : 0.03;
  const cap = typeof cfg.cap === 'number' ? cfg.cap : 4;
  for (const ally of livingAllies(ctx, u)) {
    const n = ally.buffs.filter((b) => b.kind === 'stat' && b.field === 'dmgRdct' && b.tag.startsWith('allyShelter')).length;
    if (n >= cap) continue;
    ally.buffs.push({ tag: `allyShelter#${n}`, kind: 'stat', source: u.id, field: 'dmgRdct', amount, turns: 99 });
    ctx.events.push({ type: 'buffApplied', unit: ally.key, tag: 'allyShelter', amount, stacks: n + 1 });
  }
}