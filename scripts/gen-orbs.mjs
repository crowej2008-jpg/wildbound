#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * R3: the source's Orbs → packages/content/equipment/orbs.json.
 *
 * The orb tables (hero_orb_basic / _suit / _pos) are not in the dumps (re-checked 2026-11-01), so this
 * is written from what is recorded:
 *  - kb/orbs.md: 12 kinds in two families, 5 colours and their level caps (+3/+5/+7/+10/+10), fixed
 *    lines (attack; orange/red add a second), 1 % line for green–purple and 2 for orange/red drawn from
 *    the kind's three, socket families per gear piece, unlock gates, level gold, Quick Upgrade (3 → 1),
 *    the line ceilings L × 0.8 % (DMG Boost / RDCT) and L × 1.2 % (PVP / BOSS).
 *  - The owner's wiki: /orbs (each kind's flat stats and three-line pool), /orbs/sets (all 26 sets: kinds
 *    and the Lv 3/5/7/10 bonuses), /orbs/stats (flat stats and observed % rolls at +1…+7).
 *  - hero_orb_decompose_json (in the dumps): Orb Essence per colour and level; red has no row.
 * Stand-ins (owner 2026-11-01: "the orbs go upto lvl 10 at the max so make sure to scale it up"):
 *  - Flat stats at +8…+10 continue the ×1.5 per level of +5 → +7.
 *  - Other colours' flat stats: the kb's level-1 attack line runs 22 (green) … 125 (red); the steps
 *    between are geometric (×0.176, 0.272, 0.420, 0.648, 1).
 *  - % lines other than DMG / PVP / BOSS: the ceiling per level is the best +7 roll ÷ 7; a roll lands
 *    at 80–100 % of the ceiling (the recorded rolls fall in that band); every colour uses the same.
 * Replace with the real tables when hero_orb_basic_json is re-extracted (wiki/open-questions.md).
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './source/source.mjs';

const KINDS = [
  // [defensive twin, offensive twin, flat lines, three-line pool] (owner's wiki /orbs)
  ['sharp', 'leisure', ['pAtk', 'hp'], ['dmgBoost', 'crit', 'bossBoost']],
  ['placating', 'wonder', ['sAtk', 'hp'], ['dmgRdct', 'critRes', 'controlBoost']],
  ['momentum', 'fortune', ['pAtk', 'sAtk'], ['critPower', 'dmgBoost', 'pvpBoost']],
  ['pure', 'defensive', ['sAtk', 'hp'], ['bossRdct', 'dmgRdct', 'block']],
  ['mystique', 'quick', ['pAtk', 'hp'], ['controlRes', 'guardBreak', 'dmgBoost']],
  ['erudite', 'etiquette', ['sAtk', 'pAtk'], ['pvpRdct', 'dmgRdct', 'blockPower']],
];
const title = (id) => id[0].toUpperCase() + id.slice(1);
const kinds = KINDS.flatMap(([d, o, flat, pool]) => [
  { id: d, name: `${title(d)} Orb`, family: 'defensive', twin: o, flat, pool },
  { id: o, name: `${title(o)} Orb`, family: 'offensive', twin: d, flat, pool },
]);

const greenToRed = 22 / 125;
const step = Math.pow(greenToRed, 1 / 4);
const colours = [
  { id: 'green', quality: 2, cap: 3, flatLines: 1, pctLines: 1 },
  { id: 'blue', quality: 3, cap: 5, flatLines: 1, pctLines: 1 },
  { id: 'purple', quality: 4, cap: 7, flatLines: 1, pctLines: 1 },
  { id: 'orange', quality: 5, cap: 10, flatLines: 2, pctLines: 2 },
  { id: 'red', quality: 6, cap: 10, flatLines: 2, pctLines: 2 },
].map((c, i) => ({ ...c, flatFactor: Math.round(Math.pow(step, 4 - i) * 1000) / 1000 }));

// Red, +1…+7 recorded (/orbs/stats); +8…+10 continue ×1.5.
const ext = (list) => {
  const out = [...list];
  while (out.length < 10) out.push(Math.round(out[out.length - 1] * 1.5));
  return out;
};
const flat = {
  atk: ext([221, 376, 639, 1086, 1846, 2768, 4152]),
  hp: ext([2093, 3557, 6047, 10279, 17474, 26211, 39317]),
};

// Ceiling of one % line per orb level (fraction).
const lineCeiling = {
  dmgBoost: 0.008,
  dmgRdct: 0.008,
  pvpBoost: 0.012,
  pvpRdct: 0.012,
  bossBoost: 0.012,
  bossRdct: 0.012,
  crit: 0.0699 / 7,
  blockPower: 0.0612 / 7,
  controlRes: 0.0558 / 7,
  controlBoost: 0.0545 / 7,
  critPower: 0.0525 / 7,
  block: 0.0467 / 7,
  critRes: 0.0315 / 7,
  guardBreak: 0.0258 / 7,
};
for (const k of Object.keys(lineCeiling)) lineCeiling[k] = Math.round(lineCeiling[k] * 1e6) / 1e6;

const L = (field, value) => ({ field, value });
const VS = (role, vs, value) => ({ field: role === 'attack' ? 'dmgVs' : 'rdctVs', vs, value });
const DEF3 = (lv5) => [
  { level: 3, lines: [L('orbAtk', 0.15)] },
  { level: 5, lines: lv5 },
  { level: 7, lines: [L('dmgRdct', 0.08)] },
  { level: 10, lines: [L('orbHp', 0.3), L('dmgRdct', 0.12)] },
];
const OFF3 = (lv5) => [
  { level: 3, lines: [L('orbHp', 0.18)] },
  { level: 5, lines: lv5 },
  { level: 7, lines: [L('dmgBoost', 0.08)] },
  { level: 10, lines: [L('orbAtk', 0.9), L('dmgBoost', 0.12)] },
];
const DEF5 = (lv5) => [
  { level: 3, lines: [L('orbAtk', 0.18)] },
  { level: 5, lines: lv5 },
  { level: 7, lines: [L('dmgRdct', 0.12)] },
  { level: 10, lines: [L('orbHp', 0.9), L('dmgRdct', 0.18)] },
];
const OFF5 = (lv5) => [
  { level: 3, lines: [L('orbHp', 0.45)] },
  { level: 5, lines: lv5 },
  { level: 7, lines: [L('dmgBoost', 0.12)] },
  { level: 10, lines: [L('orbAtk', 0.35), L('dmgBoost', 0.18)] },
];
const S = (id, name, family, kindList, tiers) => ({ id, name, family, kinds: kindList, tiers });
const sets = [
  S('dmg-down', 'DMG Down', 'defensive', ['sharp', 'placating', 'mystique'], DEF3([L('dmgRdct', 0.145)])),
  S('crit-rivalry', 'Crit Rivalry', 'defensive', ['sharp', 'placating', 'erudite'], DEF3([L('critRes', 0.08)])),
  S('gb-rivalry', 'GB Rivalry', 'defensive', ['sharp', 'pure', 'erudite'], DEF3([L('block', 0.12)])),
  S('gb-break', 'GB Break', 'defensive', ['momentum', 'pure', 'erudite'], DEF3([L('blockPower', 0.16)])),
  S('control-res', 'Control Res', 'defensive', ['sharp', 'mystique', 'erudite'], DEF3([L('controlRes', 0.145)])),
  S('attack-res', 'Attack Res', 'defensive', ['placating', 'momentum', 'pure'], DEF3([VS('defend', 'striker', 0.15)])),
  S('gb-res', 'GB Res', 'defensive', ['placating', 'momentum', 'mystique'], DEF3([VS('defend', 'guardian', 0.15)])),
  S('skill-attack-res', 'Skill Attack Res', 'defensive', ['momentum', 'pure', 'mystique'], DEF3([VS('defend', 'adept', 0.15)])),
  S('crit-boost', 'Crit Boost', 'offensive', ['leisure', 'defensive', 'quick'], OFF3([L('crit', 0.18)])),
  S('crit-break', 'Crit Break', 'offensive', ['fortune', 'defensive', 'quick'], OFF3([L('critPower', 0.135)])),
  S('def-break', 'DEF Break', 'offensive', ['fortune', 'quick', 'etiquette'], OFF3([L('guardBreak', 0.08)])),
  S('boosts-damage', 'Boosts Damage', 'offensive', ['leisure', 'wonder', 'defensive'], OFF3([L('dmgBoost', 0.145)])),
  S('augmented-control', 'Augmented Control', 'offensive', ['wonder', 'defensive', 'quick'], OFF3([L('controlBoost', 0.145)])),
  S('increases-attack', 'Increases Attack', 'offensive', ['leisure', 'fortune', 'etiquette'], OFF3([VS('attack', 'striker', 0.15)])),
  S('gb-boost', 'GB Boost', 'offensive', ['leisure', 'wonder', 'etiquette'], OFF3([VS('attack', 'guardian', 0.15)])),
  S('enhanced-skill-attack', 'Enhanced Skill Attack', 'offensive', ['wonder', 'fortune', 'etiquette'], OFF3([VS('attack', 'adept', 0.15)])),
  S('ultra-crit-rivalry', 'Ultra·Crit Rivalry', 'defensive', ['sharp', 'momentum', 'pure', 'mystique', 'erudite'], DEF5([L('critRes', 0.135)])),
  S('ultra-gb-rivalry', 'Ultra·Guard Break Rivalry', 'defensive', ['sharp', 'placating', 'momentum', 'mystique', 'erudite'], DEF5([L('block', 0.1), L('blockPower', 0.14)])),
  S('combat-res', 'Combat Res', 'defensive', ['sharp', 'placating', 'momentum', 'pure', 'mystique'], DEF5([L('pvpRdct', 0.36)])),
  S('fortification-res', 'Fortification Res', 'defensive', ['placating', 'momentum', 'pure', 'mystique', 'erudite'], DEF5([L('bossRdct', 0.36)])),
  S('ultra-control-res', 'Ultra·Control Res', 'defensive', ['sharp', 'placating', 'momentum', 'pure', 'erudite'], DEF5([L('controlRes', 0.24)])),
  S('combat-boost', 'Combat Boost', 'offensive', ['leisure', 'wonder', 'defensive', 'quick', 'etiquette'], OFF5([L('pvpBoost', 0.36)])),
  S('ultra-crit-enhancement', 'Ultra·Crit Enhancement', 'offensive', ['wonder', 'fortune', 'defensive', 'quick', 'etiquette'], OFF5([L('crit', 0.17), L('critPower', 0.12)])),
  S('ultra-gb-enhancement', 'Ultra·GB Enhancement', 'offensive', ['leisure', 'wonder', 'fortune', 'defensive', 'etiquette'], OFF5([L('guardBreak', 0.135)])),
  S('enhanced-fortification', 'Enhanced Fortification', 'offensive', ['leisure', 'wonder', 'fortune', 'quick', 'etiquette'], OFF5([L('bossBoost', 0.36)])),
  S('ultra-augmented-control', 'Ultra·Augmented Control', 'offensive', ['leisure', 'fortune', 'defensive', 'quick', 'etiquette'], OFF5([L('controlBoost', 0.24)])),
];

const out = {
  kinds,
  colours,
  flat,
  lineCeiling,
  rollRange: [0.8, 1],
  // +1 → +2 … +9 → +10 (ORB_UP_LEV); each level also takes 2 same-kind, same-colour, same-level copies.
  levelGold: [10000, 30000, 50000, 75000, 120000, 250000, 500000, 750000, 1000000],
  copiesPerLevel: 2,
  // Two orb rows × four gear pieces (Core, Cube, trinket slot, Wings): the families each socket takes.
  sockets: [
    ['any', 'defensive'],
    ['defensive', 'offensive'],
    ['offensive', 'defensive'],
    ['any', 'offensive'],
  ],
  unlock: { playerLevel: 50, stars: 9, secondRow: { stars: 9, level: 240 } },
  // hero_orb_decompose_json: Orb Essence by colour and level; red cannot be dismantled.
  dismantle: {
    green: [1, 2, 3],
    blue: [2, 6, 18, 54, 162],
    purple: [30, 40, 54, 95, 165, 500, 1500],
    orange: [75, 230, 660, 2000, 6000, 18000, 54000, 162000, 486000, 1458000],
  },
  sets,
};
writeFileSync(join(repoRoot, 'packages/content/equipment/orbs.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`orbs: ${kinds.length} kinds × ${colours.length} colours, ${sets.length} sets`);
