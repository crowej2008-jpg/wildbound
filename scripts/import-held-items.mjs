#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * R5: import the source's held items (Hoopa's Vault drops) into
 * packages/content/equipment/held-items.json.
 *
 * Source tables: held_items (names), held_item_json (class, quality, pools, line count, refinable
 * slots, dismantle), held_item_basic_attr_pool_json (main stats), held_item_wash_attr_pool_json
 * (the 31-line pools), held_item_upgrade_json (level costs), skill_passivity_json (item skills,
 * matched by name: "<item> I" at Legendary, "<item> II" at Supreme and Mythic).
 * Not in the dumps, copied from kb/held-items.md: the resonance gates on levels 31…181.
 * Owner's rule (2026-10-31): refine costs follow his ladder, not held_item_wash_cost_json.
 *
 *   WILDBOUND_SOURCE=…/h5-client node scripts/import-held-items.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTextMap, repoRoot, tableRows } from './source/source.mjs';

const text = loadTextMap();
const tr = (s) => (typeof s === 'string' ? (text[s] ?? s) : s);

const CLASS = { 1: 'striker', 2: 'guardian', 3: 'adept' };
const TIER = { 1: 'rare', 2: 'epic', 3: 'legendary', 4: 'supreme', 5: 'mythic' };
const FACTIONS = ['water', 'fire', 'grass', 'light', 'dark'];

/** Main-stat attr ids → our stat. Flat values are raw; "Total" values are per ten-thousand. */
const MAIN_STAT = {
  101: { kind: 'core', field: 'hp' },
  102: { kind: 'core', field: 'pAtk' },
  104: { kind: 'core', field: 'sAtk' },
  106: { kind: 'percent', field: 'hpPct' },
  107: { kind: 'percent', field: 'pAtkPct' },
  109: { kind: 'percent', field: 'sAtkPct' },
};

/** Line attr ids → our stat. All lines are per ten-thousand. */
const LINE_STAT = {
  111: { kind: 'percent', field: 'crit' },
  112: { kind: 'percent', field: 'critRes' },
  113: { kind: 'percent', field: 'critPower' },
  114: { kind: 'percent', field: 'block' },
  115: { kind: 'percent', field: 'blockPower' },
  116: { kind: 'percent', field: 'guardBreak' },
  129: { kind: 'percent', field: 'controlBoost' },
  130: { kind: 'percent', field: 'controlRes' },
  148: { kind: 'lifesteal', field: 'lifesteal' },
  149: { kind: 'percent', field: 'receiveHealBoost' },
  150: { kind: 'percent', field: 'healBoost' },
};
// 1801–1820: five factions × (Ult DMG↑, Ult DMG RED, Skill DMG↑, Skill DMG RED).
const FACTION_FIELDS = ['ultBoost', 'ultRed', 'skillBoost', 'skillRed'];
FACTIONS.forEach((faction, f) => {
  FACTION_FIELDS.forEach((field, k) => {
    LINE_STAT[1801 + f * 4 + k] = { kind: 'percent', field, faction };
  });
});

const attrs = Object.fromEntries(tableRows('attr_json').map((r) => [r.attr_id, r]));
const attrName = (id) => tr(attrs[id]?.name) ?? String(id);

// --- skills, by name ------------------------------------------------------------
const MAX_ROUNDS = JSON.parse(readFileSync(join(repoRoot, 'packages/content/tuning/combat.json'), 'utf8')).maxRounds;
const effectsFile = JSON.parse(readFileSync(join(repoRoot, 'scripts/data/held-item-effects.json'), 'utf8'));
function effectsFor(skillId) {
  const raw = effectsFile[String(skillId)];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  const [rule, field, add] = raw.split(':');
  if (rule !== 'evenRounds') throw new Error(`unknown effect rule ${raw}`);
  const out = [];
  for (let round = 2; round <= MAX_ROUNDS; round += 2) {
    out.push({ tag: `held-${skillId}-r${round}`, field, fromRound: round, bigRounds: 1, add: Number(add) });
  }
  return out;
}
const skillsByName = new Map();
for (const s of tableRows('skill_passivity_json')) {
  if (String(s.id).slice(0, 3) !== '130') continue;
  skillsByName.set(tr(s.name), { id: String(s.id), name: tr(s.name), text: tr(s.desc).replace('%%', '%') });
}

// --- items ----------------------------------------------------------------------
const names = new Map(tableRows('held_items').map((r) => [r.id, r.name]));
const items = tableRows('held_item_json')
  .sort((a, b) => a.item_id - b.item_id)
  .map((r) => {
    const name = names.get(r.item_id);
    if (!name) throw new Error(`held item ${r.item_id} has no name`);
    const tier = TIER[r.qua];
    const roman = r.qua >= 4 ? 'II' : r.qua === 3 ? 'I' : null;
    let skill = null;
    if (roman) {
      const s = skillsByName.get(`${name} ${roman}`);
      if (!s) throw new Error(`no skill "${name} ${roman}"`);
      const effects = effectsFor(s.id);
      skill = { ...s, active: effects.length > 0, effects };
    }
    const [[shardItem, shards]] = r.decompose;
    if (shardItem !== 100001) throw new Error(`unexpected dismantle item ${shardItem}`);
    return {
      id: String(r.item_id),
      name,
      className: CLASS[r.career],
      tier,
      mainPool: r.basic_attr_pool,
      linePool: r.extra_attr_pool,
      lineCount: r.extra_attr_num,
      refineSlots: r.refine_max,
      dismantle: shards,
      skill,
    };
  });

const mainPool = tableRows('held_item_basic_attr_pool_json')
  .sort((a, b) => a.index - b.index)
  .map((r) => {
    const stat = MAIN_STAT[r.attr_id];
    if (!stat) throw new Error(`unmapped main stat ${r.attr_id}`);
    const [[every, step]] = r.stren_value;
    return {
      index: r.index,
      pool: r.basic_pool,
      group: r.attr_group,
      weight: r.weight,
      name: attrName(r.attr_id),
      ...stat,
      value: r.attr_value,
      every,
      step,
    };
  });

const linePool = tableRows('held_item_wash_attr_pool_json')
  .sort((a, b) => a.index - b.index)
  .map((r) => {
    const stat = LINE_STAT[r.attr_id];
    if (!stat) throw new Error(`unmapped line ${r.attr_id}`);
    const [[min, max]] = r.value;
    return { index: r.index, pool: r.extra_attr_pool, weight: r.weight, name: attrName(r.attr_id), ...stat, min, max };
  });

const levelCost = tableRows('held_item_upgrade_json')
  .sort((a, b) => a.lev - b.lev)
  .map((r, i) => {
    if (r.lev !== i + 1) throw new Error('level table has a gap');
    const [[item, count]] = r.cost;
    if (item !== 100001) throw new Error(`unexpected level cost item ${item}`);
    return count;
  });

const out = {
  _source:
    'Generated by scripts/import-held-items.mjs from the source dumps (held_item_*, skill_passivity_json). Do not edit by hand.',
  items,
  mainPool,
  linePool,
  levelCost,
  // kb/held-items.md (not in the dumps): an item level needs this resonance (Link Crystal) level.
  levelGates: [
    { level: 31, resonance: 250 },
    { level: 61, resonance: 300 },
    { level: 81, resonance: 350 },
    { level: 101, resonance: 400 },
    { level: 121, resonance: 450 },
    { level: 141, resonance: 500 },
    { level: 161, resonance: 550 },
    { level: 181, resonance: 600 },
  ],
  // Owner's ladder (2026-10-31): Held Item Resetters per refine, first free, 21 refines per item.
  refineLadder: [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10],
  // item_compound_json: 20 Resetter Shards (100002) → 1 Held Item Resetter (100003).
  resetterCompound: tableRows('item_compound_json').find((r) => r.item_id === 100002).item_num,
};

const file = join(repoRoot, 'packages/content/equipment/held-items.json');
writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
console.log(
  `wrote ${items.length} items, ${mainPool.length} main-stat rows, ${linePool.length} lines, ${levelCost.length} levels → ${file}`,
);
console.log(`skills active in battle: ${items.filter((i) => i.skill?.active).map((i) => `${i.name} (${i.tier})`).join(', ')}`);
