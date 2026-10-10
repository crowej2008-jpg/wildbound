import { effective } from './stats';
import { piecewise } from './settings';
import type { BattleContext, Combatant, CombatField, SkillDef } from './types';

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
}

export function computeDamage(p: HitParams, ctx: BattleContext): HitOutcome {
  const { attacker, defender, skill, hitIndex } = p;
  const S = ctx.settings;

  if (skill.damageType === 'hpShare') {
    return { dmg: Math.floor(skill.hpShare! * eff(defender, 'hp')), crit: false, blocked: false };
  }

  const raw = (skill.type === 'P' ? eff(attacker, 'pAtk') : eff(attacker, 'sAtk')) * (skill.rates[hitIndex] ?? skill.rates[0]!);

  const G = Math.max(S.gFloor, 1 + eff(attacker, 'dmgBoost') - eff(defender, 'dmgRdct'));
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

  let dmg = raw * G * P * K * soul * teamFactor * classMult * weatherMult;

  const critRes = eff(defender, 'critRes');
  const crit = !ctx.deterministic && ctx.rng() < critRateAt(attacker, defender, critRes, S.critSlope, S.critFloor);
  const critMult = Math.max(S.critBaseMult, S.critBaseMult + eff(attacker, 'critPower') - 0.5 * critRes);
  if (crit) dmg *= critMult;

  const blocked = !ctx.deterministic && ctx.rng() < blockChanceAt(attacker, defender, S.blockPoints);
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

export function blockChanceAt(attacker: Combatant, defender: Combatant, points: [number, number][]): number {
  return Math.min(1, Math.max(0, piecewise(points, eff(defender, 'block') - eff(attacker, 'guardBreak'))));
}

export interface HitFlags {
  kind?: 'hit' | 'dot' | 'reflect';
  crit?: boolean;
  blocked?: boolean;
  hpShare?: boolean;
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
  const shielded = Math.min(defender.shieldHp, dmg);
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

  // The flat +rageHitBase applies only to direct hits (plain and shielded);
  // hpShare is unmodified damage and skips the flat base. The proportional term
  // uses real HP lost from any source. The shielded part never counts toward
  // hpLost (seen).
  const hitLanded = shielded > 0 || hpLost > 0;
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
  return hpLost;
}

export function addRage(ctx: BattleContext, u: Combatant, delta: number): void {
  const before = u.rage;
  u.rage = Math.max(0, Math.min(ctx.settings.rageMax, u.rage + delta));
  const applied = u.rage - before;
  if (applied !== 0) ctx.events.push({ type: 'rageChange', unit: u.key, delta: applied, rage: u.rage });
}

function eff(u: Combatant, field: CombatField): number {
  return effective(u.base, u.buffs, field);
}