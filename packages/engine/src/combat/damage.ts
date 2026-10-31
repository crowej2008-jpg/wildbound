import { effective } from './stats';
import { evalCondition } from './conditions';
import { piecewise } from './settings';
import { addRage } from './rage';
import { fireTriggers } from './triggers';
import { applyControl } from './control';
import { applyHeal } from './sustain';
import type { BattleContext, Combatant, CombatField, SkillDef } from './types';

export { addRage };

/**
 * The measured damage pipeline (PROMPT Â§6.4, stats-and-combat.md):
 *   dmg = raw Ã— G Ã— P Ã— K Ã— Soul Ã— Team Ã— classMult Ã— weather
 * Crit and block roll independently; hpShare skills ignore everything.
 * All damage changes flow through channelHit so Rage, damageTaken and the
 * lost-per-round ledger (for counters) stay consistent.
 */

export interface TeamSides {
  attackersPower: number;
  defendersPower: number;
}

export interface HitParams {
  attacker: Combatant;
  defender: Combatant;
  skill: SkillDef;
  /** 0-based hit index within the skill; 0 for single-hit skills. */
  hitIndex: number;
  team: TeamSides;
}

export interface HitOutcome {
  dmg: number;
  crit: boolean;
  blocked: boolean;
  /** M9: true damage (bypasses every factor, both rolls and shields). */
  trueDmg?: boolean;
}

/** The HP a `%`-share skill reads, per `hpShareBasis` (default `max`, the M1 form). */
function hpShareValue(skill: SkillDef, defender: Combatant): number {
  const basis = skill.hpShareBasis ?? 'max';
  if (basis === 'current') return defender.hp;
  if (basis === 'missing') return Math.max(0, defender.maxHp - defender.hp);
  return eff(defender, 'hp');
}

export function computeDamage(p: HitParams, ctx: BattleContext): HitOutcome {
  const { attacker, defender, skill, hitIndex } = p;
  const S = ctx.settings;

  if (skill.damageType === 'hpShare') {
    return {
      dmg: Math.floor(skill.hpShare! * hpShareValue(skill, defender)),
      crit: false,
      blocked: false,
      trueDmg: skill.trueDamage === true,
    };
  }

  let raw = (skill.type === 'P' ? eff(attacker, 'pAtk') : eff(attacker, 'sAtk')) * (skill.rates[hitIndex] ?? skill.rates[0]!);

  if (skill.trueDamage) {
    return { dmg: Math.max(1, Math.floor(raw)), crit: false, blocked: false, trueDmg: true };
  }

  // E1: the attacker's damage modifiers (held items, talents) that match this hit.
  const mods = activeDamageMods(ctx, attacker, defender, skill);
  if (mods.atk !== 0) raw *= 1 + mods.atk;

  // R1: the star card's "DMG BST to [faction]" joins the additive DMG Boost pair against that faction
  // (how the source combines it is open — ASSUMPTIONS #52).
  const factionBoost =
    attacker.factionBoost && attacker.factionBoost.faction === defender.kit.faction ? attacker.factionBoost.value : 0;
  const G = Math.max(S.gFloor, 1 + eff(attacker, 'dmgBoost') + factionBoost + mods.dmg - eff(defender, 'dmgRdct'));
  const P =
    S.mode === 'pvp' ? Math.max(S.pFloor, 1 + eff(attacker, 'pvpBoost') - eff(defender, 'pvpRdct') - S.pvpConst) : 1;

  let K = 1;
  if (skill.slot === 'ult') K = 1 + eff(attacker, 'ultBoost') - eff(defender, 'ultRed');
  else if (skill.slot === 'basic') K = 1 + eff(attacker, 'skillBoost') - eff(defender, 'skillRed');

  const x = eff(attacker, 'spiritAtk') - eff(defender, 'spiritDef');
  const soul = 1 + (S.soulCap * x) / (Math.abs(x) + S.soulHalf);

  let teamFactor = 1;
  if (p.team.defendersPower > 0) {
    const own = attacker.side === 'attackers' ? p.team.attackersPower : p.team.defendersPower;
    const enemy = attacker.side === 'attackers' ? p.team.defendersPower : p.team.attackersPower;
    const ratio = own / enemy;
    const cutDefenders = !S.tpSymmetric && attacker.side === 'defenders';
    teamFactor = cutDefenders ? 1 : Math.min(1, ratio / S.tpThreshold);
  }

  const classMult = S.classMult[`${attacker.kit.class}>${defender.kit.class}`] ?? 1;
  const weatherMult = ctx.weather?.factions.includes(attacker.kit.faction) ? 1 + ctx.weather.dmg : 1;

  // M9.5: DEF is inert by default (the measured model shows it has no effect).
  // When `defendersUseDef` is on, P.DEF/S.DEF cut incoming damage on a
  // def/(def+defK) curve (half damage at DEF == defK).
  let defMult = 1;
  if (S.defendersUseDef) {
    const rawDef = skill.type === 'P' ? eff(defender, 'pDef') : eff(defender, 'sDef');
    const def = Math.max(0, rawDef * (1 - (skill.ignoreDefense ?? 0)));
    defMult = 1 - def / (def + S.defK);
  }

  let dmg = raw * G * P * K * soul * teamFactor * classMult * weatherMult * defMult;

  if (skill.bonusVs && evalCondition(skill.bonusVs.condition, ctx, attacker, defender)) {
    dmg *= skill.bonusVs.mult;
  }
  // M11.4 Fire (vs shielded) and Grass (while shielded) set multipliers.
  if (defender.shieldHp > 0 && attacker.soulheart?.shieldDmgBonus) {
    dmg *= 1 + attacker.soulheart.shieldDmgBonus;
  }
  if (attacker.shieldHp > 0 && attacker.soulheart?.shieldedDmgBonus) {
    dmg *= 1 + attacker.soulheart.shieldedDmgBonus;
  }

  const critRes = eff(defender, 'critRes');
  const crit = !ctx.deterministic && ctx.rng() < critRateAt(attacker, defender, critRes, S.critSlope, S.critFloor);
  const critMult = Math.max(S.critBaseMult, S.critBaseMult + eff(attacker, 'critPower') - 0.5 * critRes);
  if (crit) dmg *= critMult;

  const ignoreBlock = Math.min(1, Math.max(0, eff(attacker, 'ignoreBlock') + mods.ignoreBlock));
  const blocked = !ctx.deterministic && ctx.rng() < blockChanceAt(attacker, defender, S.blockPoints, ignoreBlock);
  if (blocked) {
    const kept = Math.max(0, S.blockKeep - S.blockIntScale * eff(attacker, 'blockPower'));
    dmg *= kept;
  }

  return { dmg: Math.max(1, Math.floor(dmg)), crit, blocked };
}

/** Pure crit-rate helpers, exported for statistical tests. */
export function critRateAt(
  attacker: Combatant,
  defender: Combatant,
  critRes = eff(defender, 'critRes'),
  slope = 1.2,
  floor = 0.03,
): number {
  return Math.max(floor, Math.min(1, slope * (eff(attacker, 'crit') - critRes)));
}

export function blockChanceAt(
  attacker: Combatant,
  defender: Combatant,
  points: [number, number][],
  ignoreBlock = 0,
): number {
  const block = eff(defender, 'block') * (1 - ignoreBlock);
  return Math.min(1, Math.max(0, piecewise(points, block - eff(attacker, 'guardBreak'))));
}

/** E1: sum the attacker's damage modifiers whose slot, condition and chance pass for this hit. */
function activeDamageMods(
  ctx: BattleContext,
  attacker: Combatant,
  defender: Combatant,
  skill: SkillDef,
): { dmg: number; atk: number; ignoreBlock: number } {
  const out = { dmg: 0, atk: 0, ignoreBlock: 0 };
  for (const mod of attacker.damageMods ?? []) {
    if (mod.slot !== undefined && mod.slot !== skill.slot) continue;
    if (mod.condition && !evalCondition(mod.condition, ctx, attacker, defender)) continue;
    if (mod.chance !== undefined && (ctx.deterministic || !(ctx.rng() < mod.chance))) continue;
    out.dmg += mod.dmg ?? 0;
    out.atk += mod.atk ?? 0;
    out.ignoreBlock += mod.ignoreBlock ?? 0;
  }
  return out;
}

export interface HitFlags {
  kind?: 'hit' | 'dot' | 'reflect';
  crit?: boolean;
  blocked?: boolean;
  hpShare?: boolean;
  /** M9: true damage — bypasses shields. */
  trueDmg?: boolean;
  /** M9: skill-level shield bypass. */
  ignoreShield?: boolean;
}

/**
 * Apply a damage change to `defender`: shields absorb first, then HP. The
 * shielded part never counts toward the rage hpLost term (seen). Rage on being
 * hit = rageHitBase + floor(rageHitScale Ã— hpLost Ã· maxHp). Returns HP lost.
 */
export function channelHit(
  ctx: BattleContext,
  attacker: Combatant,
  defender: Combatant,
  dmg: number,
  flags: HitFlags = {},
): number {
  const kind = flags.kind ?? 'hit';
  const wasAlive = defender.alive;
  const bypassShield = flags.trueDmg === true || flags.ignoreShield === true;
  const shielded = bypassShield ? 0 : Math.min(defender.shieldHp, dmg);
  if (shielded > 0) {
    defender.shieldHp -= shielded;
    ctx.events.push({ type: 'shield', tgt: defender.key, amount: shielded, shieldAfter: defender.shieldHp });
  }
  const hpLost = Math.min(defender.hp, dmg - shielded);
  if (hpLost > 0) {
    defender.hp -= hpLost;
    defender.lostThisRound += hpLost;
    if (kind === 'reflect') {
      ctx.events.push({ type: 'reflect', src: attacker.key, tgt: defender.key, dmg: hpLost, hpAfter: defender.hp });
    } else {
      ctx.events.push({
        type: 'hit',
        src: attacker.key,
        tgt: defender.key,
        dmg: hpLost,
        crit: flags.crit === true,
        blocked: flags.blocked === true,
        hpAfter: defender.hp,
        hpShare: flags.hpShare === true ? true : undefined,
      });
    }
    if (defender.hp <= 0 && defender.alive) {
      defender.alive = false;
      ctx.events.push({ type: 'death', unit: defender.key });
    }
  }

  const hitLanded = shielded > 0 || hpLost > 0;
  // E1: "when dealing damage" (Shell Bell) fires before the target's Rage gain so it can stop it.
  if (hitLanded && kind === 'hit' && attacker !== defender && attacker.alive) {
    fireTriggers(ctx, attacker, 'onDealDamage', { target: defender });
  }

  // The flat +rageHitBase applies only to direct hits (plain and shielded);
  // hpShare is unmodified damage and skips the flat base. The proportional term
  // uses real HP lost from any source. The shielded part never counts toward
  // hpLost (seen).
  let gain = 0;
  if (hitLanded && kind === 'hit' && !flags.hpShare) gain += ctx.settings.rageHitBase;
  gain += defender.kit.talents?.rageOnHit ?? 0;
  const lostBase = ctx.settings.shieldCountsForRage ? shielded + hpLost : hpLost;
  if (lostBase > 0) gain += Math.floor((ctx.settings.rageHitScale * lostBase) / defender.base.hp);
  if (gain > 0) addRage(ctx, defender, gain);

  const rageCut = defender.kit.talents?.rageCutChance;
  if (hitLanded && kind === 'hit' && rageCut && !flags.hpShare && !ctx.deterministic && ctx.rng() < rageCut) {
    addRage(ctx, attacker, -(ctx.settings.rageMax / 8));
  }

  // M11.4 Water 6 (heal when attacked) and Thunder 6 (paralysis on hit).
  if (hitLanded && kind === 'hit' && !flags.hpShare) {
    const onHit = defender.soulheart?.onHitHeal;
    if (onHit && defender.alive && !ctx.deterministic && ctx.rng() < onHit.chance) {
      applyHeal(ctx, defender, Math.floor(onHit.rate * defender.base.hp));
    }
    const paralysis = attacker.soulheart?.paralysisChance;
    if (paralysis && defender.alive) {
      applyControl(ctx, attacker, [defender], { kind: 'paralysis', chance: paralysis });
    }
  }

  // M9.4 talent triggers. `onHit` fires for the defender on a direct hit;
  // `hpBelow` follows any HP loss; `onKill`/`onDeath` fire on a kill. Each call
  // runs one level deep and `fireTriggers` bounds the nesting.
  if (hitLanded) {
    if (kind === 'hit') fireTriggers(ctx, defender, 'onHit', { target: attacker });
    fireTriggers(ctx, defender, 'hpBelow', { target: attacker });
  }
  if (!defender.alive && wasAlive) {
    fireTriggers(ctx, defender, 'onDeath', { target: attacker });
    if (attacker.alive) fireTriggers(ctx, attacker, 'onKill', { target: defender });
    for (const ally of ctx.units) {
      if (ally.side !== defender.side || ally === defender || !ally.alive) continue;
      fireTriggers(ctx, ally, 'onAllyDeath', { target: defender });
    }
  }
  return hpLost;
}

function eff(u: Combatant, field: CombatField): number {
  return effective(u.base, u.buffs, field);
}