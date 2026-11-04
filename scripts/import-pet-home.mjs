/* eslint-disable no-undef */
/**
 * R9: Pet Home rows from the source (pet_home_cfg + items_cfg). Rewrites the numbers in
 * packages/content/tuning/pet-home.json and keeps what the source has no table for (the board
 * layout, the album note, our names):
 *
 *  - levels: exp, box_amount → tiles, up_max → merge cap, unlock_cost → padlock gems, reward
 *    (Gems, or Rare Orb Chests → `orbChests`);
 *  - home: free_box_times, offline_time, the _buyTimesCfg summon ladder and the Rare Orb Chest
 *    (13001: one level-1 orb of any of the 12 kinds, colour weights green 6000 / blue 2000 /
 *    purple 666 / orange 222);
 *  - income: _petShowCfg reward per merge level (Home Coin 2^level per settlement step);
 *  - shops: _shopCfg rows (84 Home Exchange, 48 Orb Atelier), each one orb at a fixed level
 *    (item_eqm_compound_json → orb item 750KC: K = kind, C = quality 2 green … 5 orange), the
 *    row's home_lev range, cost and discount; _refreshTimes; orb_home_lev opens the Atelier.
 *
 *   node scripts/import-pet-home.mjs   (WILDBOUND_SOURCE as for the other importers)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, sourceRoot } from './source/source.mjs';

const dump = (dir, file) => JSON.parse(readFileSync(join(sourceRoot, dir, file), 'utf8'));
const ph = dump('2026-10-02', 'pet_home_cfg.json');
const itemsCfg = dump('2026-10-03', 'items_cfg.json');
const compound = itemsCfg.item_eqm_compound_json;
const out = join(repoRoot, 'packages/content/tuning/pet-home.json');
const current = JSON.parse(readFileSync(out, 'utf8'));
const orbs = JSON.parse(readFileSync(join(repoRoot, 'packages/content/equipment/orbs.json'), 'utf8'));

// Source kind order (the tens digit of 750KC) → our kind ids.
const KINDS = [
  'sharp', 'placating', 'momentum', 'pure', 'mystique', 'erudite',
  'leisure', 'wonder', 'fortune', 'defensive', 'quick', 'etiquette',
];
const COLOURS = { 2: 'green', 3: 'blue', 4: 'purple', 5: 'orange', 6: 'red' };
const kindName = Object.fromEntries(orbs.kinds.map((k) => [k.id, k.name]));
const cap = Object.fromEntries(orbs.colours.map((c) => [c.id, c.cap]));

function orbOf(itemId) {
  const row = compound[itemId];
  if (!row) throw new Error(`no compound row for ${itemId}`);
  const [[orbItem, , [lo, hi]]] = row.item_list;
  if (lo !== hi) throw new Error(`${itemId}: level range ${lo}-${hi}`);
  const kind = KINDS[Math.floor((orbItem - 75000) / 10) - 1];
  const colour = COLOURS[orbItem % 10];
  if (!kind || !colour) throw new Error(`${itemId}: cannot decode orb ${orbItem}`);
  if (lo > cap[colour]) throw new Error(`${itemId}: +${lo} is above the ${colour} cap`);
  return { kind, colour, level: lo };
}

// Levels.
const levels = Object.values(ph._homeLevCfg)
  .sort((a, b) => a.lv - b.lv)
  .map((r) => {
    const reward = {};
    let orbChests = 0;
    for (const [id, n] of r.reward ?? []) {
      if (id === 2) reward.gems = (reward.gems ?? 0) + n;
      else if (id === 13001) orbChests += n;
      else throw new Error(`level ${r.lv}: unknown reward item ${id}`);
    }
    const row = {
      level: r.lv,
      xp: r.exp,
      tiles: r.box_amount,
      mergeCap: r.up_max,
      unlockGems: r.unlock_cost?.[0]?.[1] ?? 20,
      reward,
    };
    if (orbChests) row.orbChests = orbChests;
    return row;
  });

// Rare Orb Chest (13001).
const chest = itemsCfg.item_use_json['13001'];
const weights = {};
for (const [orbItem, , w] of chest.rand_item_list) {
  const colour = COLOURS[orbItem % 10];
  if (weights[colour] !== undefined && weights[colour] !== w) throw new Error('chest weights differ by kind');
  weights[colour] = w;
}

// Home.
const basic = ph._basicCfg;
const home = {
  ...current.home,
  offlineHours: basic.offline_time,
  freeSummonsPerDay: basic.free_box_times,
  summonCosts: Object.values(ph._buyTimesCfg)
    .sort((a, b) => a.times - b.times)
    .map((r) => ({ afterPaid: r.times - 1, gems: r.price[0][1] })),
  orbChest: { level: 1, weights },
};

// Income.
const income = Object.values(ph._petShowCfg['1'])
  .sort((a, b) => a.lev - b.lev)
  .map((r) => ({ level: r.lev, coinsPerFiveSeconds: r.reward[0][1] }));

// Shops.
const refreshCosts = Object.values(ph._refreshTimes).sort((a, b) => a.fresh_times - b.fresh_times);
const refresh = {
  maxPerDay: refreshCosts.at(-1).fresh_times,
  costs: refreshCosts
    .map((r, i) => ({ afterRefreshes: i === 0 ? 0 : refreshCosts[i - 1].fresh_times, gems: r.refresh_cost[0][1] }))
    .filter((r, i, all) => i === 0 || r.gems !== all[i - 1].gems),
};
function bandsOf(shopRows, prefix) {
  const groups = new Map();
  for (const r of Object.values(shopRows).sort((a, b) => a.index - b.index)) {
    const [[lo, hi]] = r.home_lev;
    const key = `${lo}-${hi}-${r.cost[0][1]}`;
    if (!groups.has(key)) groups.set(key, { minLevel: lo, maxLevel: Math.min(hi, 16), offers: [] });
    const orb = orbOf(r.item[0][0]);
    groups.get(key).offers.push({
      id: `${prefix}-${r.index}`,
      name: `${orb.colour[0].toUpperCase()}${orb.colour.slice(1)} ${kindName[orb.kind]} +${orb.level}`,
      description: `One ${orb.colour} ${kindName[orb.kind]} at +${orb.level}.`,
      price: r.cost[0][1],
      discount: r.discount,
      grants: {},
      orb,
    });
  }
  return [...groups.values()];
}
const shops = {
  home: { ...current.shops.home, refresh, bands: bandsOf(ph._shopCfg['1'], 'home') },
  deluxe: {
    ...current.shops.deluxe,
    unlockLevel: basic.orb_home_lev,
    refresh,
    bands: bandsOf(ph._shopCfg['2'], 'deluxe'),
  },
};

writeFileSync(out, `${JSON.stringify({ ...current, home, levels, income, shops }, null, 2)}\n`);
const rows = (s) => s.bands.reduce((n, b) => n + b.offers.length, 0);
console.log(`pet-home.json: ${levels.length} levels, ${income.length} income rows, ${rows(shops.home)}+${rows(shops.deluxe)} shop rows`);
