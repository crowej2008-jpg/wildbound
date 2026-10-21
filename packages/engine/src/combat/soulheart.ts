import { applyHeal, applyShieldAmount } from './sustain';
import type { BattleContext, Combatant } from './types';

/**
 * M11.4 Soul-heart cadences. Set lines are folded into the sheet by the
 * equipment layer; these helpers own the timed parts: battle-start shields and
 * guards, turn-3-style puncture/immunity, and Water's end-of-round heals.
 */

export function soulheartBattleStart(ctx: BattleContext): void {
  for (const u of ctx.units) {
    if (!u.alive) continue;
    const h = u.soulheart;
    if (!h) continue;
    if (h.startDmgRdct) {
      u.buffs.push({ tag: 'soulheartGuard', kind: 'stat', source: u.id, field: 'dmgRdct', amount: h.startDmgRdct });
      ctx.events.push({ type: 'buffApplied', unit: u.key, tag: 'soulheartGuard', amount: h.startDmgRdct });
    }
    if (h.firstRoundDmgRdct) {
      u.buffs.push({
        tag: 'soulheartFirstGuard',
        kind: 'stat',
        source: u.id,
        field: 'dmgRdct',
        amount: h.firstRoundDmgRdct,
        bigRounds: 1,
      });
      ctx.events.push({ type: 'buffApplied', unit: u.key, tag: 'soulheartFirstGuard', amount: h.firstRoundDmgRdct });
    }
    addMultiplier(ctx, u, 'soulheartSoulAtk', 'spiritAtk', h.spiritAtkMult);
    addMultiplier(ctx, u, 'soulheartSoulDef', 'spiritDef', h.spiritDefMult);
    addMultiplier(ctx, u, 'soulheartSpAtk', 'sAtk', h.sAtkMult);
    if (h.firstRoundSpiritDefMult && h.firstRoundSpiritDefMult > 1) {
      const bonus = Math.round((u.base.spiritDef ?? 0) * (h.firstRoundSpiritDefMult - 1));
      if (bonus > 0) {
        u.buffs.push({
          tag: 'soulheartFirstSoul',
          kind: 'stat',
          source: u.id,
          field: 'spiritDef',
          amount: bonus,
          bigRounds: 1,
        });
        ctx.events.push({ type: 'buffApplied', unit: u.key, tag: 'soulheartFirstSoul', amount: bonus });
      }
    }
    if (h.startShield) applyShieldAmount(ctx, u, Math.floor(h.startShield * u.base.hp));
  }
}

function addMultiplier(
  ctx: BattleContext,
  u: Combatant,
  tag: string,
  field: 'spiritAtk' | 'spiritDef' | 'sAtk',
  mult: number | undefined,
): void {
  if (mult === undefined || mult <= 1) return;
  const bonus = Math.round((u.base[field] ?? 0) * (mult - 1));
  if (bonus <= 0) return;
  u.buffs.push({ tag, kind: 'stat', source: u.id, field, amount: bonus });
  ctx.events.push({ type: 'buffApplied', unit: u.key, tag, amount: bonus });
}

/** Refresh one-turn puncture / control immunity at the start of a big round. */
export function soulheartRoundStart(ctx: BattleContext): void {
  for (const u of ctx.units) {
    if (!u.alive) continue;
    const h = u.soulheart;
    if (!h) continue;
    u.buffs = u.buffs.filter((b) => b.tag !== 'soulheartImmune' && b.tag !== 'soulheartPuncture');
    if (h.controlImmunityEvery && ctx.round % h.controlImmunityEvery === 0) {
      u.buffs.push({ tag: 'soulheartImmune', kind: 'immune', source: u.id, turns: 1 });
      ctx.events.push({ type: 'buffApplied', unit: u.key, tag: 'soulheartImmune', amount: 0 });
    }
    if (h.punctureEvery && ctx.round % h.punctureEvery === 0) {
      u.buffs.push({ tag: 'soulheartPuncture', kind: 'puncture', source: u.id, turns: 1 });
      ctx.events.push({ type: 'buffApplied', unit: u.key, tag: 'soulheartPuncture', amount: 0 });
    }
  }
}

/** Water 4-piece: heal at the end of authored big rounds (4/8/12). */
export function soulheartRoundEnd(ctx: BattleContext, bigRound: number): void {
  for (const u of ctx.units) {
    const h = u.soulheart;
    if (!u.alive || !h?.roundHeal) continue;
    if (!h.roundHeal.rounds.includes(bigRound)) continue;
    applyHeal(ctx, u, Math.floor(h.roundHeal.rate * u.base.hp));
  }
}

/** Rock 6-piece: heal at the start of the holder's turn. */
export function soulheartTurnStart(ctx: BattleContext, u: Combatant): void {
  if (!u.alive || !u.soulheart?.turnHeal) return;
  applyHeal(ctx, u, Math.floor(u.soulheart.turnHeal * u.base.hp));
}
