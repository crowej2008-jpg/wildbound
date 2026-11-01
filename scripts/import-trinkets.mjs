#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * R6b part 1: import the source's exclusive trinkets into packages/content/equipment/trinkets.json.
 *
 * Source tables (pokemon_data_cfg): hero_weapon_json (each holder's skills at Lv 10 / 20 / 30 / 40 and its
 * item), hero_weapon_cost_json (per holder and level 0–40: the stats at that level, the price of the next
 * level — Star Shards, plus the holder's own item at 9 / 19 / 29 / 39 — and a display rank `star`),
 * attr_json (stat ids), `_items` (item names). The unlock (account: 6 Pokémon at Lv 220; the Pokémon at
 * 7★) is from kb/exclusive-trinkets.md. The six Origin rows (301–306: stats only, level = the average of
 * the three synergy Pokémon) wait for the Origin synergy system and are not imported.
 * The skills (Lv 10 / 20 / 30 / 40) are ported in R6b part 2; their ids are kept here.
 *
 *   WILDBOUND_SOURCE=…/h5-client node scripts/import-trinkets.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dumpFiles, loadTable, repoRoot } from './source/source.mjs';

const rows = (name) => loadTable(name);
// Item names: every dump's `_items` note merged (later dumps win).
const items = {};
for (const file of dumpFiles()) Object.assign(items, JSON.parse(readFileSync(file, 'utf8'))._items ?? {});

// attr_json ids → our stat lines. Flat stats as-is; the rest are 1/10000.
const ATTR = {
  901: ['core', 'hp'],
  902: ['core', 'pAtk'],
  904: ['core', 'sAtk'],
  406: ['percent', 'hpPct'],
  407: ['percent', 'pAtkPct'],
  409: ['percent', 'sAtkPct'],
  111: ['percent', 'crit'],
  112: ['percent', 'critRes'],
  113: ['percent', 'critPower'],
  114: ['percent', 'block'],
  115: ['percent', 'blockPower'],
  116: ['percent', 'guardBreak'],
  117: ['percent', 'dmgBoost'],
  121: ['percent', 'dmgRdct'],
  129: ['percent', 'controlBoost'],
  130: ['percent', 'controlRes'],
};
const STAR_SHARD = 23001;
// R6b: trinket chests (hero_weapon_box_json): each holder's item has one chest that stands in for it. The names
// are from kb/exclusive-trinkets.md (the chests' item rows are not in the dumps): matched by holder count
// (27 / 15 / 10 / 8 / 6) and, for the two sixes, by the Guild Shop's four chests (which include the Shiny box).
const CHESTS = {
  10232: { currency: 'trinketChestOrange', name: 'Orange Trinket Chest' },
  10234: { currency: 'trinketChestRed', name: 'Red Trinket Chest' },
  10285: { currency: 'trinketChestBlue', name: 'Blue Trinket Chest' },
  10235: { currency: 'trinketChest', name: 'Trinket Chest' },
  10233: { currency: 'trinketBoxShiny', name: 'Shiny Supreme Trinket Box' },
  10286: { currency: 'trinketChestPurple', name: 'Purple Trinket Chest' },
};
const chestOfItem = new Map(Object.values(rows('hero_weapon_box_json')).map((r) => [r.weapon_item, r.weapon_box]));

const speciesDir = join(repoRoot, 'packages/content/species');
const bySource = new Map();
for (const file of ['water', 'fire', 'grass', 'light', 'dark']) {
  const list = JSON.parse(readFileSync(join(speciesDir, `${file}.json`), 'utf8'));
  for (const s of Array.isArray(list) ? list : list.species) bySource.set(s.sourceId, s.id);
}

const weapons = rows('hero_weapon_json');
const costs = rows('hero_weapon_cost_json');
const trinkets = [];
const skipped = [];
for (const [heroId, w] of Object.entries(weapons)) {
  if (!w.skill_list) continue; // the six Origins (301–306)
  const speciesId = bySource.get(Number(heroId));
  if (!speciesId) {
    skipped.push(heroId);
    continue;
  }
  const byLevel = Object.values(costs[heroId]).sort((a, b) => a.lev - b.lev);
  if (byLevel.length !== 41) throw new Error(`${heroId}: ${byLevel.length} levels`);
  let itemId = null;
  const levels = byLevel.map((r) => {
    const lines = (r.attr ?? []).map(([id, v]) => {
      const a = ATTR[id];
      if (!a) throw new Error(`${heroId}: unknown attr ${id}`);
      return { kind: a[0], field: a[1], base: a[0] === 'core' ? v : v / 10000, perLevel: 0 };
    });
    let cost = null;
    if (r.cost_items) {
      cost = { starShard: 0, item: 0 };
      for (const [id, n] of r.cost_items) {
        if (id === STAR_SHARD) cost.starShard += n;
        else {
          if (itemId !== null && itemId !== id) throw new Error(`${heroId}: two own items`);
          itemId = id;
          cost.item += n;
        }
      }
    }
    return { rank: r.star, lines, cost };
  });
  const item = items[String(itemId)];
  trinkets.push({
    id: `trinket-${speciesId}`,
    name: item?.name ?? `${speciesId} trinket`,
    speciesId,
    sourceId: Number(heroId),
    item: { id: itemId, name: item?.name ?? String(itemId) },
    // The chest that can be spent as this item (none for the few holders hero_weapon_box leaves out).
    ...(CHESTS[chestOfItem.get(itemId)] ? { chest: CHESTS[chestOfItem.get(itemId)].currency } : {}),
    levels,
    skills: w.skill_list.map(([level, skillId]) => ({ level, skillId })),
  });
}
trinkets.sort((a, b) => a.sourceId - b.sourceId);

// The price is the same for every holder (kb: 300,430 Star Shards + 2,540 own items to Lv 40).
const total = (t) =>
  t.levels.reduce((a, l) => ({ starShard: a.starShard + (l.cost?.starShard ?? 0), item: a.item + (l.cost?.item ?? 0) }), {
    starShard: 0,
    item: 0,
  });
for (const t of trinkets) {
  const s = total(t);
  if (s.starShard !== 300430 || s.item !== 2540) throw new Error(`${t.speciesId} price ${JSON.stringify(s)}`);
}

const out = {
  unlock: { rosterCount: 6, rosterLevel: 220, stars: 7 },
  maxLevel: 40,
  chests: Object.entries(CHESTS).map(([id, c]) => ({ sourceId: Number(id), ...c })),
  trinkets,
};
writeFileSync(join(repoRoot, 'packages/content/equipment/trinkets.json'), JSON.stringify(out, null, 1) + '\n');
const counts = {};
for (const t of trinkets) if (t.chest) counts[t.chest] = (counts[t.chest] ?? 0) + 1;
console.log(JSON.stringify(counts));
console.log(`trinkets: ${trinkets.length} holders${skipped.length ? `, skipped (no species) ${skipped.join(', ')}` : ''}`);
