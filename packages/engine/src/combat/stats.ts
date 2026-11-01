import type { Buff, CombatField, SpecInput, StatSheet } from './types';
import { levelScale } from './scaling';

/**
 * Build the ledger stats a combatant starts from: core stats plus fractional
 * percent lines (1.0 == 100%), soul stats, and talent stat mods applied in
 * order on their declared field. Buffs then layer on top at runtime.
 */
export function resolveSheet(spec: SpecInput): StatSheet {
  const s = spec.sheet;
  const pct = (v: number | undefined): number => (v === undefined ? 0 : v);
  const sheet: StatSheet = {
    hp: s.hp,
    pAtk: s.pAtk,
    sAtk: s.sAtk,
    spd: s.spd,
    pDef: pct(s.pDef),
    sDef: pct(s.sDef),
    dmgBoost: pct(s.dmgBoost),
    dmgRdct: pct(s.dmgRdct),
    pvpBoost: pct(s.pvpBoost),
    pvpRdct: pct(s.pvpRdct),
    ultBoost: pct(s.ultBoost),
    ultRed: pct(s.ultRed),
    skillBoost: pct(s.skillBoost),
    skillRed: pct(s.skillRed),
    crit: pct(s.crit),
    critRes: pct(s.critRes),
    critPower: pct(s.critPower),
    block: pct(s.block),
    blockPower: pct(s.blockPower),
    guardBreak: pct(s.guardBreak),
    controlBoost: pct(s.controlBoost),
    controlRes: pct(s.controlRes),
    healBoost: pct(s.healBoost),
    receiveHealBoost: pct(s.receiveHealBoost),
    counterBoost: pct(s.counterBoost),
    spiritAtk: pct(s.spiritAtk),
    spiritDef: pct(s.spiritDef),
    atkPct: pct(s.atkPct),
    ignoreBlock: pct(s.ignoreBlock),
    ignoreDefense: pct(s.ignoreDefense),
    basicRate: pct(s.basicRate),
    pRdct: pct(s.pRdct),
    sRdct: pct(s.sRdct),
    pBoost: pct(s.pBoost),
    sBoost: pct(s.sBoost),
    dotTaken: pct(s.dotTaken),
    lifesteal: pct(s.lifesteal),
  };
  for (const mod of [...(spec.kit.talents?.statMods ?? []), ...(spec.statMods ?? [])]) {
    const level = spec.level ?? 1;
    const mult = mod.mult === undefined ? undefined : levelScale(mod.mult, mod.scalesWithLevel, level);
    const add = mod.add === undefined ? undefined : levelScale(mod.add, mod.scalesWithLevel, level);
    applyStatMod(sheet, mod.field, mult, add);
  }
  return sheet;
}

export function applyStatMod(
  sheet: StatSheet,
  field: CombatField,
  mult?: number,
  add?: number,
): void {
  if (mult !== undefined) sheet[field] *= mult;
  if (add !== undefined) sheet[field] += add;
}

/**
 * Runtime effective stat: base value plus every applied stat buff (additive). P.ATK and S.ATK are
 * then raised by `atkPct` (E1: "+10% attack" buffs).
 */
/** R6b: P.ATK / S.ATK / P.DEF / S.DEF buffs are shares of the unit's own stat (every one in the kits is a %). */
const PCT_OF_BASE: ReadonlySet<CombatField> = new Set(['pAtk', 'sAtk', 'pDef', 'sDef']);

export function effective(base: StatSheet, buffs: Buff[], field: CombatField): number {
  let v = base[field];
  let share = 0;
  for (const b of buffs) {
    if (b.kind === 'stat' && b.field === field && b.amount !== undefined) {
      if (PCT_OF_BASE.has(field)) share += b.amount;
      else v += b.amount;
    }
  }
  if (share !== 0) v *= Math.max(0, 1 + share);
  if (field === 'pAtk' || field === 'sAtk') {
    const pct = effective(base, buffs, 'atkPct');
    if (pct !== 0) v *= 1 + pct;
  }
  return v;
}