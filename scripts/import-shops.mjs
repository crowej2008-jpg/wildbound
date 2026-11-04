#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * R9: import the source's shops into packages/content/shops/{daily,pvp,forest,guild,wilds,island}.json
 * (the Faction Tower Shop stays as R6b imported it).
 *
 * Source (items_cfg / modepages-solo_cfg): shop_basic_json (restock hours — rf_day_hour_list; how many rows show —
 * item_num), shop_item_json (each row's goods, cost, buys per restock — buy_times, the shown discount and the
 * Champion Road badge gate — conditions priv_id), shop_refresh_json (the Daily Shop's Gold ladder, the Pokémon
 * Shop's 3,000 Pokémon Tokens) and vip_priv_json shop_refresh_times (the Daily Shop's refreshes a day by VIP).
 * Which rows show is from kb/shop.md (journal-checked): the Daily Shop's six fixed rows 1221–1226 plus six drawn
 * from 1227–1265; the Island Shop's 35004–35017; the Guild Shop's 10101–10111. Rows whose goods Wildbound does not
 * have are left out and listed in `_leftOut`.
 *
 *   node scripts/import-shops.mjs   (WILDBOUND_SOURCE as for the other importers)
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTable, repoRoot, sourceRoot } from './source/source.mjs';

const dump = (file) => JSON.parse(readFileSync(join(sourceRoot, '2026-10-03', file), 'utf8'));
const items = dump('items_cfg.json').shop_item_json;
const basic = dump('items_cfg.json').shop_basic_json;
const refreshLadder = dump('modepages-solo_cfg.json').shop_refresh_json;
const names = {};
for (const dir of readdirSync(sourceRoot)) {
  for (const f of readdirSync(join(sourceRoot, dir))) {
    const it = JSON.parse(readFileSync(join(sourceRoot, dir, f), 'utf8'))._items;
    if (it && typeof it === 'object') for (const [k, v] of Object.entries(it)) if (typeof v === 'string') names[k] = v;
  }
}

// Species shards: hero_basic chipitemid, else item 39900 + hero id (40011 → hero 111, 40015 → 115).
const species = [];
for (const f of readdirSync(join(repoRoot, 'packages/content/species'))) {
  if (f.endsWith('.json')) species.push(...JSON.parse(readFileSync(join(repoRoot, 'packages/content/species', f), 'utf8')));
}
const bySource = new Map(species.map((s) => [s.sourceId, s.id]));
const chip = {};
for (const r of Object.values(loadTable('hero_basic_json'))) chip[r.chipitemid] = r.hero_id;
const speciesOf = (item) => (item >= 40000 && item < 50000 ? bySource.get(chip[item] ?? item - 39900) : undefined);

const CURRENCY = {
  1: 'gold',
  2: 'gems',
  10: 'wildCoin',
  16: 'guildCoin',
  17: 'arenaToken',
  28: 'forestCoin',
  34: 'islandCoin',
  10006: 'ticketPremium',
  10102: 'pokemonShard3',
  10103: 'pokemonShard5',
  20601: 'stone',
  21102: 'followerStone',
  21103: 'mountStone',
  21104: 'backDecorStone',
  10012: 'berryEssence',
  10232: 'trinketChestOrange',
  10233: 'trinketBoxShiny',
  10234: 'trinketChestRed',
  10235: 'trinketChest',
};
const currencyOf = (id) => CURRENCY[id];

const SHOPS = [
  { source: 1, id: 'daily', name: 'Daily Shop', show: (r) => r >= 1221 && r <= 1265, fixed: (r) => r <= 1226 },
  { source: 7, id: 'pvp', name: 'PvP Shop' },
  { source: 8, id: 'forest', name: 'Forest Shop', fixed: (r) => r === 8016 },
  { source: 10, id: 'guild', name: 'Guild Shop', show: (r) => r >= 10101 },
  { source: 11, id: 'wilds', name: 'Pokémon Shop' },
  { source: 35, id: 'island', name: 'Island Shop', show: (r) => r >= 35004 },
];

function restockOf(b) {
  if (b.rf_type === 3) return { type: 'manual' };
  const [[kind, value]] = b.rf_day_hour_list;
  return kind === 1 ? { type: 'daily', hoursUtc: value } : { type: 'interval', days: value, hourUtc: 0 };
}

for (const def of SHOPS) {
  const b = basic[String(def.source)];
  const rows = Object.values(items[String(def.source)]).sort((x, y) => x.goods_index - y.goods_index);
  const shown = rows.filter((r) => !def.show || def.show(r.goods_index));
  const currency = currencyOf(shown[0].cost_item[0][0]);
  const out = [];
  const leftOut = [];
  for (const r of shown) {
    const [[good, count]] = r.goods;
    const [[costItem, price]] = r.cost_item;
    const sp = speciesOf(good);
    const cur = currencyOf(good);
    const name = `${names[String(good)] ?? good} ×${count}`;
    if (!sp && !cur) {
      leftOut.push(`${r.goods_index} ${name}`);
      continue;
    }
    const rowCurrency = currencyOf(costItem);
    const badge = r.conditions?.find(([k]) => k === 'priv_id')?.[1];
    out.push({
      id: `${def.id}.${r.goods_index}`,
      name,
      price,
      ...(rowCurrency !== currency ? { currency: rowCurrency } : {}),
      grants: cur ? { [cur]: count } : {},
      ...(sp ? { speciesShards: { [sp]: count } } : {}),
      limit: r.buy_times[0][2],
      ...(r.discount ? { discount: r.discount } : {}),
      ...(badge ? { badge } : {}),
    });
  }
  const restock = restockOf(b);
  const shop = { id: def.id, name: def.name, currency, restock, items: out };
  if (def.source === 11) {
    const ladder = Object.values(refreshLadder['11']).sort((x, y) => x.times - y.times);
    shop.restock = { type: 'manual', refreshCost: { [currencyOf(ladder[0].cost[0][0])]: ladder[0].cost[0][1] }, refreshDailyLimit: ladder.length };
  }
  if (def.source === 1) {
    const ladder = Object.values(refreshLadder['1']).sort((x, y) => x.times - y.times);
    shop.refresh = { costs: ladder.map((l) => ({ [currencyOf(l.cost[0][0])]: l.cost[0][1] })), limit: 'vip' };
  }
  if (def.fixed && b.item_num < out.length) {
    // A fixed row that is left out keeps its slot empty (the rotating count stays the source's).
    const fixedLeftOut = leftOut.filter((l) => def.fixed(Number(l.split(' ')[0]))).length;
    shop.slots = b.item_num - fixedLeftOut;
    shop.fixed = out.filter((i) => def.fixed(Number(i.id.split('.')[1]))).map((i) => i.id);
  }
  if (leftOut.length) shop._leftOut = leftOut;
  writeFileSync(join(repoRoot, 'packages/content/shops', `${def.id}.json`), JSON.stringify(shop, null, 2) + '\n');
  console.log(`${def.id}: ${out.length} rows${shop.slots ? ` (${shop.slots} shown)` : ''}; left out ${leftOut.length}: ${leftOut.join(' | ')}`);
}
