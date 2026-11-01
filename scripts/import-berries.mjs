#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * R6d: import the source's berries into packages/content/equipment/berries.json.
 *
 * Source tables (boosts_cfg): berry_basic_json (19 berries: type, start star, dismantle), berry_star_up_json (the
 * one star ladder all 16 star-able berries share: stats per star and the price of the next star — copies of the
 * same berry at 1★, any 1★ berries, Gold), berry_break_up_json (breakthrough +1…+4: trainer level, Mulch, stats),
 * berry_attr_json (the 15 cultivatable / washable line kinds and their caps by breakthrough stage),
 * berry_reborn_reset_json (cultivation, reforge and rebirth prices). Names, tiers and the skill texts per star come
 * from the dump's `_berries` research note (skill_passivity rows, item texts, client TreeBerry* pages).
 * The skills themselves are hand-ported in scripts/data/berry-skills.py.
 *
 *   WILDBOUND_SOURCE=…/h5-client node scripts/import-berries.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dumpFiles, loadTable, repoRoot } from './source/source.mjs';

let note;
for (const file of dumpFiles()) {
  const dump = JSON.parse(readFileSync(file, 'utf8'));
  if (dump._berries) note = dump._berries;
}
if (!note) throw new Error('no _berries note in the dumps');

const basic = loadTable('berry_basic_json');
const starUp = loadTable('berry_star_up_json');
const breakUp = loadTable('berry_break_up_json');
const attrs = loadTable('berry_attr_json');
const reset = loadTable('berry_reborn_reset_json');

const TIER = { 2: 'common', 3: 'basic', 4: 'intermediate', 5: 'greater' };
const STAT = { 701: 'hp', 702: 'pAtk', 704: 'sAtk' };
// berry_attr attr_id → our line: flat HP / ATK, everything else hundredths of a percent.
const LINE = {
  701: ['core', 'hp'],
  702: ['core', 'pAtk'],
  704: ['core', 'sAtk'],
  111: ['percent', 'crit'],
  112: ['percent', 'critRes'],
  113: ['percent', 'critPower'],
  114: ['percent', 'block'],
  115: ['percent', 'blockPower'],
  116: ['percent', 'guardBreak'],
  117: ['percent', 'dmgBoost'],
  121: ['percent', 'dmgRdct'],
  127: ['percent', 'pvpBoost'],
  128: ['percent', 'pvpRdct'],
  129: ['percent', 'controlBoost'],
  130: ['percent', 'controlRes'],
};
const MULCH = { 10013: 'berryMulchBlue', 10014: 'berryMulchPurple', 10015: 'berryMulchOrange', 10016: 'berryMulchRed' };
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const stats = (list) => {
  const out = { hp: 0, pAtk: 0, sAtk: 0 };
  for (const [id, v] of list ?? []) out[STAT[id]] = v;
  return out;
};

// One star ladder for every star-able berry (checked).
const ladders = Object.values(starUp).map((rows) =>
  Object.values(rows)
    .sort((a, b) => a.star - b.star)
    .map((r) => ({
      star: r.star,
      ...stats(r.attr_list),
      next: r.cost_coin ? { sameCopies: r.cost_num_1, anyCopies: r.cost_num_2, gold: r.cost_coin } : null,
    })),
);
for (const l of ladders) if (JSON.stringify(l) !== JSON.stringify(ladders[0])) throw new Error('star ladders differ');

const berries = note.berries.map((b) => {
  const row = basic[String(b.berry_id)];
  const name = b.berry_id === 70010 ? 'Lemon Fruit (Intermediate)' : b.name;
  return {
    id: `berry-${slug(name)}`,
    sourceId: b.berry_id,
    name,
    tier: TIER[b.item_quality],
    typeId: row.type_id,
    initStar: row.init_star,
    maxStar: b.max_star,
    dismantleEssence: row.decompose.reduce((n, [, c]) => n + c, 0),
    skills: b.skill_by_star.map((s) => ({ star: s.star, name: s.name, text: s.effect })),
  };
});

const out = {
  // berry_break_up attr_num 1 a stage and element_num 1: one line to start, +1 per breakthrough (the note's reading).
  linesAtStart: 1,
  maxLines: 5,
  cultivateEssence: reset.single_cost[0][1],
  fastCultivateTimes: 10,
  reforgePotions: reset.rf_cost.map(([, , n]) => n),
  rebirthGems: reset.reborn_cost[0][1],
  stars: ladders[0],
  breakthrough: Object.values(breakUp)
    .sort((a, b) => a.stage - b.stage)
    .map((r) => ({
      stage: r.stage,
      trainerLevel: r.role_lev,
      cost: { currency: MULCH[r.cost[0][0]], amount: r.cost[0][1] },
      ...stats(r.attr),
    })),
  elements: Object.values(attrs)
    .sort((a, b) => a.element_id - b.element_id)
    .map((r) => {
      const [kind, field] = LINE[r.attr_id];
      return {
        id: r.element_id,
        kind,
        field,
        caps: r.attr_limit.sort((a, b) => a[0] - b[0]).map(([, v]) => (kind === 'core' ? v : v / 10000)),
      };
    }),
  berries,
};
writeFileSync(join(repoRoot, 'packages/content/equipment/berries.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`berries: ${berries.length}, ${out.elements.length} line kinds, ${out.breakthrough.length} breakthroughs`);
