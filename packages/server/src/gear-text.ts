import { lineValue, type StatLine } from '@wildbound/engine';

/** Display labels shared by the flat/percent gear cards (plates, trinkets). */
const LINE_LABELS: Record<string, string> = {
  hp: 'HP',
  pAtk: 'P.ATK',
  sAtk: 'S.ATK',
  hpPct: 'Total HP',
  pAtkPct: 'Total P.ATK',
  sAtkPct: 'Total S.ATK',
  pDef: 'P.DEF',
  sDef: 'S.DEF',
  spd: 'SPD',
  spiritAtk: 'Soul ATK',
  spiritDef: 'Soul DEF',
  dmgBoost: 'DMG Boost',
  dmgRdct: 'DMG Reduction',
  crit: 'Crit Chance',
  critRes: 'Crit Resist',
  critPower: 'Crit Intensity',
  block: 'Block',
  blockPower: 'Block Intensity',
  guardBreak: 'Guard Break',
  controlBoost: 'Control Boost',
  controlRes: 'Control Resist',
  healBoost: 'Healing Done',
  receiveHealBoost: 'Healing Received',
  counterBoost: 'Counter Boost',
};

/** One authored line at a level, formatted for a gear card. */
export function statLineText(line: StatLine, level: number): string {
  const value = lineValue(line, level);
  const label = LINE_LABELS[line.field] ?? line.field;
  if (line.kind === 'percent') return `${label} +${(value * 100).toFixed(1)}%`;
  return `${label} +${Math.round(value).toLocaleString()}`;
}
