import { applyBuff } from './buffs';
import { effective } from './stats';
import { fireTriggers } from './triggers';
import { addRage, channelHit, computeDamage, type TeamSides } from './damage';
import { applyCounterReflect } from './counter';
import { applyControl } from './control';
import { applyDot, applyDotSpec, tickDots, tickRegen } from './dot';
import { applyEffects } from './effects';
import { selectTargets } from './targeting';
import { applySkillSideEffects } from './sustain';
import { soulheartTurnStart } from './soulheart';
import { scaleBuff } from './scaling';
import { chooseSlot, holdsUltimate, sideStrategy } from './strategy';
import type { BattleContext, Combatant, SkillDef, SkillSlot } from './types';

/**
 * One unit's action: pick the skill from Rage and the basic-skill rate, resolve
 * targets, run the damage pipeline per hit, then controls, riders, side effects
 * and the counter reflect. Ticks DoT and regen at the start of the holder's
 * turn. A controlled unit skips without acting and without action Rage.
 *
 * M9 adds structured DoTs, recast-on-kill (the damage + riders block repeats,
 * sustain and counter reflect apply once per action) and effect riders.
 */
export interface ActionInput {
  bigRound: number;
  team: TeamSides;
}

export function takeTurn(ctx: BattleContext, u: Combatant, input: ActionInput): void {
  ctx.team = input.team;
  tickDots(ctx, u);
  tickRegen(ctx, u);
  soulheartTurnStart(ctx, u);

  const skip = u.buffs.some((b) => b.kind === 'control');
  const strategy = sideStrategy(ctx.strategies, u.side);
  const ultReady =
    ctx.rules?.noUltimate !== true && u.rage >= ctx.settings.ultRageCost && !holdsUltimate(ctx, u, strategy);
  // E3: a disarm works like paralysis — only a ready ultimate can still be cast.
  const paralysis = u.buffs.some((b) => b.kind === 'paralysis' || b.kind === 'disarm');

  if (skip || (paralysis && !ultReady)) {
    ctx.events.push({ type: 'action', unit: u.key, skill: null });
    return;
  }

  const silence = u.buffs.some((b) => b.kind === 'silence');
  const slot: SkillSlot = chooseSlot(
    strategy,
    u.kit,
    ultReady && !silence,
    ultReady && !silence ? 'ult' : rollSkillSlot(ctx, u),
  );
  const skill = u.kit.skills[slot];
  ctx.events.push({ type: 'action', unit: u.key, skill: slot });

  const confused = u.buffs.some((b) => b.kind === 'confusion');
  const redirect = confused && slot === 'normal' && ctx.rng() < confusionChance(ctx, u);

  ctx.damageDealt[u.key] = ctx.damageDealt[u.key] ?? 0;

  let lastTargets: Combatant[] = [];
  let lastHitDamages: number[] = [];
  const maxCasts = 1 + Math.max(0, skill.recastOnKill?.max ?? 0);
  for (let cast = 0; cast < maxCasts; cast += 1) {
    const targets = redirect ? livingAllies(ctx, u) : selectTargets(ctx, u, skill);
    lastTargets = targets;
    const before = targets.filter((t) => t.alive).map((t) => t.key);
    lastHitDamages = resolveCast(ctx, u, skill, targets, input);
    const deaths = before.filter((k) => !(ctx.units.find((x) => x.key === k)?.alive ?? false)).length;
    if (deaths === 0 || !skill.recastOnKill || !u.alive) break;
  }

  applySkillSideEffects(ctx, u, skill, lastTargets, lastHitDamages);
  applyCounterReflect(ctx, u, skill, lastTargets, input.bigRound);

  if (slot === 'ult') {
    // E4: enemies react to an ultimate (Origin Lugia's Feather Dance).
    for (const foe of ctx.units) {
      if (foe.side !== u.side && foe.alive) fireTriggers(ctx, foe, 'onEnemyUlt', { target: u });
    }
    const before = u.rage;
    u.rage = Math.max(0, u.rage - ctx.settings.ultRageCost);
    ctx.events.push({ type: 'rageChange', unit: u.key, delta: u.rage - before, rage: u.rage });
  } else {
    addRage(ctx, u, actionRage(ctx, u));
  }
  processTalentsOnAction(ctx, u);
  // E1: "after using a basic skill / the ultimate" (Muscle Band, Soul Dew, Grip Claw, Leftovers).
  const after = slot === 'ult' ? 'afterUlt' : slot === 'basic' ? 'afterBasic' : 'afterNormal';
  if (u.alive) fireTriggers(ctx, u, after, lastTargets[0] ? { target: lastTargets[0] } : {});
}

/** Damage + control + debuffs + DoTs + effect riders for one cast. */
function resolveCast(
  ctx: BattleContext,
  u: Combatant,
  skill: SkillDef,
  targets: Combatant[],
  input: ActionInput,
): number[] {
  const hitDamages: number[] = [];
  ctx.castDamage = new Map();
  for (let i = 0; i < skill.rates.length; i += 1) {
    for (const t of [...targets]) {
      if (!t.alive || !u.alive) continue;
      const outcome = computeDamage({ attacker: u, defender: t, skill, hitIndex: i, team: input.team }, ctx);
      const dealt = channelHit(ctx, u, t, outcome.dmg, {
        crit: outcome.crit,
        blocked: outcome.blocked,
        hpShare: skill.damageType === 'hpShare',
        trueDmg: outcome.trueDmg,
        ignoreShield: skill.ignoreShield || u.buffs.some((b) => b.kind === 'puncture'),
      });
      hitDamages.push(dealt);
      ctx.castDamage.set(t.key, (ctx.castDamage.get(t.key) ?? 0) + dealt);
      ctx.damageDealt[u.key] = (ctx.damageDealt[u.key] ?? 0) + outcome.dmg;
      ctx.damageTaken[t.key] = (ctx.damageTaken[t.key] ?? 0) + outcome.dmg;
      // E1: crit / blocked reactions (Scope Lens, Zoom Lens).
      if (outcome.crit && u.alive) {
        fireTriggers(ctx, u, 'onCrit', { target: t });
        // E3: allies react to this unit's crit (Origin Rayquaza's linked strike).
        for (const ally of ctx.units) {
          if (ally !== u && ally.alive && ally.side === u.side) fireTriggers(ctx, ally, 'onAllyCrit', { target: t, actor: u });
        }
      }
      if (outcome.blocked && u.alive) fireTriggers(ctx, u, 'onBlocked', { target: t });
    }
  }

  if (skill.control) {
    applyControl(ctx, u, targets, skill.control);
  }
  for (const b of skill.targetDebuffs ?? []) {
    for (const t of targets) if (t.alive) applyBuff(t, scaleBuff(b, u.level ?? 1), ctx, u.id);
  }
  if (skill.damageType === 'dot') {
    for (const t of targets) {
      if (t.alive) applyDot(ctx, u, t, skill.hpShare!);
    }
  }
  if (skill.dot) {
    for (const t of targets) {
      if (t.alive) applyDotSpec(ctx, u, t, skill.dot, skill.type);
    }
  }
  applyEffects(ctx, u, skill, targets);
  return hitDamages;
}

/**
 * E3: an extra action right away (Dialga "must act again", Mimikyu's extra minor skill, Pikachu's
 * extra attack on a kill, Deoxys's periodic Rage Move). It costs no Rage; `noRage` also skips the
 * action's own Rage gain. Its riders and side effects resolve as usual.
 */
export function extraAction(
  ctx: BattleContext,
  u: Combatant,
  slot: SkillSlot | 'roll',
  noRage: boolean,
  team: TeamSides,
): void {
  if (!u.alive) return;
  const picked: SkillSlot = slot === 'roll' ? rollSkillSlot(ctx, u) : slot;
  const skill = u.kit.skills[picked];
  ctx.events.push({ type: 'action', unit: u.key, skill: picked });
  const targets = selectTargets(ctx, u, skill);
  const hits = resolveCast(ctx, u, skill, targets, { bigRound: ctx.round, team });
  applySkillSideEffects(ctx, u, skill, targets, hits);
  if (!noRage && picked !== 'ult') addRage(ctx, u, actionRage(ctx, u));
}

/** The base Rage a normal attack / basic skill gives its user (owner: SKILL class only). */
function actionRage(ctx: BattleContext, u: Combatant): number {
  return ctx.settings.ragePerActionClasses.includes(u.kit.class) ? ctx.settings.ragePerAction : 0;
}

function rollSkillSlot(ctx: BattleContext, u: Combatant): SkillSlot {
  // E3: a Flinch / Nap (`noBasic`) stops the basic skill.
  if (u.buffs.some((b) => b.kind === 'noBasic')) return 'normal';
  // E1: `basicRate` buffs and lines add to the kit's (or the default) basic-skill chance.
  const rate = (u.kit.talents?.basicRate ?? ctx.settings.basicReplace) + effective(u.base, u.buffs, 'basicRate');
  return ctx.rng() < rate ? 'basic' : 'normal';
}

function confusionChance(ctx: BattleContext, u: Combatant): number {
  const conf = u.buffs.find((b) => b.kind === 'confusion');
  return conf?.redirectChance ?? ctx.settings.redirectChance;
}

function livingAllies(ctx: BattleContext, u: Combatant): Combatant[] {
  return ctx.units.filter((x) => x.side === u.side && x.alive);
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
