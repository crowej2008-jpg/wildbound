import type { OrbTables } from './orbs';

/** Test fixture: a slice of the source orb tables (content/equipment/orbs.json). */
const tier = (level: number, field: string, value: number) => ({ level, lines: [{ field, value }] });
export const ORB_TABLES: OrbTables = {
  kinds: [
    { id: 'sharp', name: 'Sharp Orb', family: 'defensive', twin: 'leisure', flat: ['pAtk', 'hp'], pool: ['dmgBoost', 'crit', 'bossBoost'] },
    { id: 'leisure', name: 'Leisure Orb', family: 'offensive', twin: 'sharp', flat: ['pAtk', 'hp'], pool: ['dmgBoost', 'crit', 'bossBoost'] },
    { id: 'placating', name: 'Placating Orb', family: 'defensive', twin: 'wonder', flat: ['sAtk', 'hp'], pool: ['dmgRdct', 'critRes', 'controlBoost'] },
    { id: 'mystique', name: 'Mystique Orb', family: 'defensive', twin: 'quick', flat: ['pAtk', 'hp'], pool: ['controlRes', 'guardBreak', 'dmgBoost'] },
    { id: 'erudite', name: 'Erudite Orb', family: 'defensive', twin: 'etiquette', flat: ['sAtk', 'pAtk'], pool: ['pvpRdct', 'dmgRdct', 'blockPower'] },
  ],
  colours: [
    { id: 'green', quality: 2, cap: 3, flatLines: 1, pctLines: 1, flatFactor: 0.176 },
    { id: 'orange', quality: 5, cap: 10, flatLines: 2, pctLines: 2, flatFactor: 0.648 },
    { id: 'red', quality: 6, cap: 10, flatLines: 2, pctLines: 2, flatFactor: 1 },
  ],
  flat: {
    atk: [221, 376, 639, 1086, 1846, 2768, 4152, 6228, 9342, 14013],
    hp: [2093, 3557, 6047, 10279, 17474, 26211, 39317, 58976, 88464, 132696],
  },
  lineCeiling: { dmgBoost: 0.008, dmgRdct: 0.008, crit: 0.009986, pvpRdct: 0.012 },
  rollRange: [0.8, 1],
  levelGold: [10000, 30000, 50000, 75000, 120000, 250000, 500000, 750000, 1000000],
  copiesPerLevel: 2,
  sockets: [
    ['any', 'defensive'],
    ['defensive', 'offensive'],
    ['offensive', 'defensive'],
    ['any', 'offensive'],
  ],
  unlock: { playerLevel: 50, stars: 9, secondRow: { stars: 9, level: 240 } },
  dismantle: { green: [1, 2, 3], orange: [75, 230, 660, 2000, 6000, 18000, 54000, 162000, 486000, 1458000] },
  sets: [
    {
      id: 'dmg-down',
      name: 'DMG Down',
      family: 'defensive',
      kinds: ['sharp', 'placating', 'mystique'],
      tiers: [tier(3, 'orbAtk', 0.15), tier(5, 'dmgRdct', 0.145), tier(7, 'dmgRdct', 0.08), { level: 10, lines: [{ field: 'orbHp', value: 0.3 }, { field: 'dmgRdct', value: 0.12 }] }],
    },
    {
      id: 'crit-rivalry',
      name: 'Crit Rivalry',
      family: 'defensive',
      kinds: ['sharp', 'placating', 'erudite'],
      tiers: [tier(3, 'orbAtk', 0.15), tier(5, 'critRes', 0.08)],
    },
    {
      id: 'attack-res',
      name: 'Attack Res',
      family: 'defensive',
      kinds: ['placating', 'erudite', 'mystique'],
      tiers: [tier(3, 'orbAtk', 0.15), { level: 5, lines: [{ field: 'rdctVs', value: 0.15, vs: 'striker' }] }],
    },
  ],
};
