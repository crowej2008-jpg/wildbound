#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * R4: import the source's Potential (天赋 "talent") into packages/content/potential/potential.json.
 *
 * Source tables (potential_cfg): hero_talent_unlock_condition_json (stars per tier),
 * hero_talent_up_json (Potential Shard costs), hero_talent_unlock_cost_json (fodder per species and
 * tier), hero_talent_unlock_item_cost_json (who may use a Potential Core), hero_talent_skill_json
 * (each species' three options per tier), skill_fight_attr_json / skill_passivity_json (the 67
 * options and their six level values). English names and effect readings follow kb/potential.md,
 * which writes the effects from the game's Chinese text (its English text drops several triggers).
 * Reset price (16 Diamonds) is from kb/potential.md (the client's reset text).
 *
 *   WILDBOUND_SOURCE=…/h5-client node scripts/import-potential.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { dumpFiles, repoRoot } from './source/source.mjs';

const FACTION_BY_RACE = { 1: 'water', 2: 'fire', 3: 'grass', 4: 'light', 5: 'dark' };
const ATK = 'striker';
const DEF = 'guardian';
const SKILL = 'adept';

/**
 * The 67 options by skill group: English name (kb), effect (engine `PotentialEffect`), and whether
 * the level values are percentages (divided by 100) or points (SPD).
 */
const S = (field, more = {}) => ({ kind: 'stat', field, ...more });
const FA = (field, more = {}) => ({ kind: 'factionAllies', field, cap: 2, ...more });
const CA = (allyClass, field, more = {}) => ({ kind: 'classAlly', allyClass, field, ...more });
const CD = (allyClass, role, vs) => ({ kind: 'classAllyDmg', allyClass, role, vs });
const AL = (cond, field) => ({ kind: 'alive', ...cond, field });
const EV = (on, act, more = {}) => ({ kind: 'event', on, act, target: 'self', ...more });
const OPTIONS = {
  50101: ['Symbiosis', FA('hp', { mult: true }), 'Same-faction allies deployed: HP +{v}%, up to 2 times'],
  50102: ['Victory Star', FA('atkPct'), 'Same-faction allies deployed: ATK +{v}%, up to 2 times'],
  50103: ['Amplified Morale', FA('crit'), 'Same-faction allies deployed: Crit +{v}%, up to 2 times'],
  50104: ['Friendly Defense', FA('block'), 'Same-faction allies deployed: Block +{v}%, up to 2 times'],
  50105: ['Stakeout', FA('critRes'), 'Same-faction allies deployed: Crit Res +{v}%, up to 2 times'],
  50106: ['Area Attack', FA('guardBreak'), 'Same-faction allies deployed: Guard Break +{v}%, up to 2 times'],
  50201: ['Valor', S('atkPct'), 'In battle: ATK +{v}%'],
  50202: ['Sturdy', S('hp', { mult: true }), 'In battle: HP +{v}%'],
  50203: ['Natural Cure', S('receiveHealBoost'), 'In battle: Incoming Healing +{v}%'],
  50204: ['Blessing', S('healBoost'), 'In battle: Healing +{v}%'],
  50205: ['Loose Cannon', S('controlBoost'), 'In battle: Control Boost +{v}%'],
  50206: ['Immune', S('controlRes'), 'In battle: Control Res +{v}%'],
  50301: ['Delightful', EV('afterAttack', 'buff', { field: 'atkPct', turns: 2 }), 'After attacking: ATK +{v}% until its next action; no stacking'],
  50302: ['Fury', EV('onHit', 'buff', { field: 'atkPct', turns: 1, maxStacks: 2 }), 'When hit: ATK +{v}%, up to 2 times, until its next action'],
  50303: ['Hawk Eye', EV('afterAttack', 'buff', { target: 'event', field: 'dmgRdct', negate: true, bigRounds: 2 }), 'After attacking: the target takes +{v}% damage for 2 rounds; no stacking'],
  50304: ['Serene Grace', EV('onHit', 'buff', { field: 'controlBoost', bigRounds: 2 }), 'When hit: Control Boost +{v}% for 2 rounds; no stacking'],
  50305: ['Curse', EV('afterAttack', 'buff', { target: 'event', field: 'dotTaken', bigRounds: 3 }), 'After attacking: the target takes +{v}% damage over time for 3 rounds; no stacking'],
  50306: ['Regenerator', EV('afterAttack', 'heal'), 'After attacking: restores {v}% of its max HP'],
  50401: ['Guardian Shell', CA(DEF, 'hp', { mult: true }), 'A DEF-class ally deployed: HP +{v}%'],
  50402: ['Wonder Guard', CA(DEF, 'dmgRdct'), 'A DEF-class ally deployed: DMG RDCT +{v}%'],
  50403: ['Crowd Immunity', CA(DEF, 'controlRes'), 'A DEF-class ally deployed: Control Res +{v}%'],
  50404: ['Shell Armor', CD(DEF, 'defend', ATK), 'A DEF-class ally deployed: DMG RDCT from [ATK] +{v}%'],
  50405: ['Battle Armor', CD(DEF, 'defend', SKILL), 'A DEF-class ally deployed: DMG RDCT from [SKILL] +{v}%'],
  50406: ['Compound Eye', CA(DEF, 'controlBoost'), 'A DEF-class ally deployed: Control Boost +{v}%'],
  50407: ['Numerical Strength', CA(ATK, 'hp', { mult: true }), 'An ATK-class ally deployed: HP +{v}%'],
  50408: ['Synchronized Attack', CA(ATK, 'atkPct'), 'An ATK-class ally deployed: ATK +{v}%'],
  50409: ['Analyze', CA(ATK, 'controlBoost'), 'An ATK-class ally deployed: Control Boost +{v}%'],
  50410: ['Infiltrator', CD(ATK, 'attack', ATK), 'An ATK-class ally deployed: DMG BST to [ATK] +{v}%'],
  50411: ['Intimidate', CD(ATK, 'attack', SKILL), 'An ATK-class ally deployed: DMG BST to [SKILL] +{v}%'],
  50412: ['Numerical Strength', CA(SKILL, 'hp', { mult: true }), 'A SKILL-class ally deployed: HP +{v}%'],
  50413: ['Synchronized Attack', CA(SKILL, 'atkPct'), 'A SKILL-class ally deployed: ATK +{v}%'],
  50414: ['Analyze', CA(SKILL, 'controlBoost'), 'A SKILL-class ally deployed: Control Boost +{v}%'],
  50415: ['Infiltrator', CD(SKILL, 'attack', ATK), 'A SKILL-class ally deployed: DMG BST to [ATK] +{v}%'],
  50416: ['Intimidate', CD(SKILL, 'attack', SKILL), 'A SKILL-class ally deployed: DMG BST to [SKILL] +{v}%'],
  50501: ['Embolden', EV('afterUlt', 'buff', { field: 'atkPct', turns: 2 }), 'After its Ultimate: ATK +{v}% until its next action; no stacking'],
  50502: ['Tit for Tat', EV('afterUlt', 'damage', { target: 'event' }), 'Its Ultimate adds damage equal to {v}% of its own lost HP'],
  50503: ['Pre-war Prayer', EV('battleStart', 'buff', { field: 'controlBoost', bigRounds: 1 }), 'First round: Control Boost +{v}%'],
  50504: ['Momentum', EV('afterNonUlt', 'buff', { field: 'atkPct', maxStacks: 4 }), 'After a non-Ultimate skill: ATK +{v}%, up to 4 times, for the rest of the battle'],
  50505: ['Healing Heart', EV('afterNonUlt', 'buff', { target: 'allies', field: 'receiveHealBoost', maxStacks: 4 }), "After a non-Ultimate skill: all allies' Incoming Healing +{v}%, up to 4 times, for the rest of the battle"],
  50601: ['Rivalry', S('pvpBoost'), 'In battle: PVP DMG BST +{v}%'],
  50602: ['steady', S('pvpRdct'), 'In battle: PVP DMG RDCT +{v}%'],
  50603: ['Timid', S('atkPct', { negate: true, extra: { field: 'spd', add: 8 } }), 'In battle: SPD +8 but ATK −{v}%'],
  50604: ['Heavy Armor', S('dmgRdct', { extra: { field: 'spd', add: -8 } }), 'In battle: DMG RDCT +{v}% but SPD −8'],
  50605: ['Unburden', S('hp', { mult: true, negate: true, extra: { field: 'spd', add: 8 } }), 'In battle: SPD +8 but HP −{v}%'],
  50701: ['Telepathy', AL({ atLeast: 3 }, 'controlRes'), 'At least 3 allies alive: Control Res +{v}%'],
  50702: ['Team up to defend', AL({ atLeast: 3 }, 'dmgRdct'), 'At least 3 allies alive: DMG RDCT +{v}%'],
  50703: ['Tacit Defense', AL({ atLeast: 3 }, 'block'), 'At least 3 allies alive: Block +{v}%'],
  50704: ['Competitive', AL({ atLeast: 3 }, 'crit'), 'At least 3 allies alive: Crit +{v}%'],
  50705: ['Iron Pokémon', AL({ below: 3 }, 'dmgRdct'), 'Fewer than 3 allies alive: DMG RDCT +{v}%'],
  50706: ['Super Lucky', AL({ below: 4 }, 'controlBoost'), 'Fewer than 4 allies alive: Control Boost +{v}%'],
  50707: ['Defiant', AL({ below: 4 }, 'lifesteal'), 'Fewer than 4 allies alive: Lifesteal +{v}%'],
  50708: ['Weak Armor', AL({ below: 4 }, 'spd'), 'Fewer than 4 allies alive: SPD +{v}'],
  50709: ['Bandage', AL({ below: 6 }, 'receiveHealBoost'), 'Fewer than 6 allies alive: Incoming Healing +{v}%'],
  50710: ['First aid', AL({ below: 6 }, 'healBoost'), 'Fewer than 6 allies alive: Healing +{v}%'],
  50711: ['Toughness', AL({ below: 6 }, 'blockPower'), 'Fewer than 6 allies alive: Block INT +{v}%'],
  50712: ['Joined Forces', AL({ atLeast: 5 }, 'dmgBoost'), 'At least 5 allies alive: DMG Boost +{v}%'],
  50713: ['Focus Attack', AL({ atLeast: 5 }, 'critPower'), 'At least 5 allies alive: Crit INT +{v}%'],
  50801: ['Robust', S('hp', { mult: true }), 'In battle: HP +{v}%'],
  50802: ['Reckless', S('atkPct'), 'In battle: ATK +{v}%'],
  50803: ['Sniper', S('critPower'), 'In battle: Crit INT +{v}%'],
  50804: ['Tough Skin', S('blockPower'), 'In battle: Block INT +{v}%'],
  50901: ['Warm up', EV('afterNormal', 'buff', { field: 'atkPct', turns: 2 }), 'After a normal attack: ATK +{v}% until its next action; no stacking'],
  50902: ['Greed', EV('afterBasic', 'buff', { field: 'lifesteal', turns: 2 }), 'After a basic skill: Lifesteal +{v}% until its next action; no stacking'],
  50903: ['Dauntless', EV('onHit', 'buff', { hitBy: 'ult', field: 'dmgRdct', bigRounds: 1 }), 'When hit by an Ultimate: DMG RDCT +{v}% for 1 round; no stacking'],
  50904: ['Hold Grudges', EV('onHit', 'buff', { hitBy: 'normal', field: 'atkPct', turns: 1, maxStacks: 2 }), 'When hit by a normal attack: ATK +{v}%, up to 2 times, until its next action'],
  50905: ['Swift Learner', EV('onHit', 'buff', { hitBy: 'basic', field: 'basicRate', turns: 1 }), "When hit by a basic skill: its basic skill's trigger chance +{v}% until its next action; no stacking"],
  50906: ['Thick Fat', EV('onHit', 'heal', { hitBy: 'ult', perTurn: 1 }), 'When hit by an Ultimate: restores {v}% of its max HP, once a round'],
};
/** Options whose values are points, not percentages. */
const POINTS = new Set([50708]);

// The Potential dump holds every hero_talent_* table complete and the skill tables trimmed to the
// rows the talent table points at; read them from that one dump (other dumps' skill tables differ).
const potentialDump = dumpFiles().filter((f) => f.endsWith('potential_cfg.json')).pop();
if (!potentialDump) throw new Error('potential_cfg.json not found under WILDBOUND_SOURCE');
const dump = JSON.parse(readFileSync(potentialDump, 'utf8'));
function rowsOf(name) {
  const rows = dump[name];
  if (!rows) throw new Error(`${name} missing from ${potentialDump}`);
  return Array.isArray(rows) ? rows : Object.values(rows);
}

// --- options: six level values from the Chinese descriptions ------------------------------------
const skillRows = [...rowsOf('skill_fight_attr_json'), ...rowsOf('skill_passivity_json')];
const byGroup = new Map();
for (const r of skillRows) {
  const g = Math.floor(r.basic_id / 10);
  if (!byGroup.has(g)) byGroup.set(g, {});
  byGroup.get(g)[r.lv] = r;
}
const options = [...byGroup.keys()].sort((a, b) => a - b).map((g) => {
  const def = OPTIONS[g];
  if (!def) throw new Error(`No reading for Potential option ${g}`);
  const levels = byGroup.get(g);
  const values = [1, 2, 3, 4, 5, 6].map((lv) => {
    const nums = (levels[lv].desc.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
    // The level value is the one number that changes across levels (Timid/Unburden: the first).
    const all = [1, 2, 3, 4, 5, 6].map((l) => (levels[l].desc.match(/\d+(?:\.\d+)?/g) ?? []).map(Number));
    const idx = nums.findIndex((_, i) => new Set(all.map((a) => a[i])).size > 1);
    const raw = nums[idx];
    return POINTS.has(g) ? raw : Math.round((raw / 100) * 1e6) / 1e6;
  });
  return { id: g, name: def[0], tier: Math.floor(g / 100) % 10, values, effect: def[1], text: def[2] };
});
if (options.length !== 67) throw new Error(`expected 67 options, got ${options.length}`);

// --- tier stars and shard costs -------------------------------------------------------------
const unlockStars = [];
for (const r of rowsOf('hero_talent_unlock_condition_json')) if (r.class >= 1) unlockStars[r.class - 1] = r.star;
const costs = [];
for (const tierRows of rowsOf('hero_talent_up_json')) {
  const rows = Object.values(tierRows).sort((a, b) => a.lv - b.lv);
  const tier = rows[0].class;
  costs[tier - 1] = rows.filter((r) => r.cost).map((r) => r.cost[0][1]);
}

// --- species ------------------------------------------------------------------------------
const speciesDir = join(repoRoot, 'packages/content/species');
const bySource = new Map();
for (const file of ['water', 'fire', 'grass', 'light', 'dark']) {
  const list = JSON.parse(readFileSync(join(speciesDir, `${file}.json`), 'utf8'));
  for (const s of Array.isArray(list) ? list : list.species) bySource.set(s.sourceId, s.id);
}
const coreHeroes = new Set(rowsOf('hero_talent_unlock_item_cost_json').map((r) => r.hero_id));
const species = {};
const fodderOf = (heroId) => (item) => {
  const [hid, star, race, count] = item;
  return hid === heroId ? { own: true, star, count } : { own: false, star, count, faction: FACTION_BY_RACE[race] };
};
for (const row of rowsOf('hero_talent_unlock_cost_json')) {
  const tiers = Object.values(row);
  const heroId = tiers[0].hero_id;
  const id = bySource.get(heroId);
  if (!id) throw new Error(`No species for source hero ${heroId}`);
  species[id] ??= { tiers: [], fodder: [], core: coreHeroes.has(heroId) };
  for (const t of tiers) species[id].fodder[t.class - 1] = t.unlock_item.map(fodderOf(heroId));
}
for (const row of rowsOf('hero_talent_skill_json')) {
  const perTier = Object.values(row);
  const first = Object.values(perTier[0])[0][0];
  const id = bySource.get(first.hero_id);
  for (const tierMap of perTier) {
    for (const list of Object.values(tierMap)) {
      const r = list[0];
      species[id].tiers[r.class - 1] ??= [];
      species[id].tiers[r.class - 1][r.index - 1] = Math.floor(r.skill_group / 10);
    }
  }
}
const ids = Object.keys(species).sort();
if (ids.length !== 62) throw new Error(`expected 62 species, got ${ids.length}`);

const out = {
  unlockStars,
  costs,
  maxLevel: 6,
  resetGems: 16,
  options,
  species: Object.fromEntries(ids.map((id) => [id, species[id]])),
};
mkdirSync(join(repoRoot, 'packages/content/potential'), { recursive: true });
writeFileSync(join(repoRoot, 'packages/content/potential/potential.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`potential: ${options.length} options, ${ids.length} species`);
