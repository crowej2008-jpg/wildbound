/* eslint-disable no-undef */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTable, repoRoot } from './source/source.mjs';

/**
 * R9 (source retrofit): the Bag's generic Pokémon shards and Pokémon boxes, copied from the source —
 * the compose recipes (item_compound_json), the random and choose-a-Pokémon boxes (item_hero_json)
 * and the Selectable Precious Giftbox's choices (item_use_json 10503). Rules from
 * reference/game-rebuild/kb/pokemon-growth.md: a composed random Pokémon box opens itself at once;
 * the Giftbox (an item choice box) stays in the bag until it is opened. A box row [1, hero, w] is the
 * species at its first star, [2, card, w] that exact card (hero × 10,000 + form × 100 + star).
 *
 * Writes packages/content/tuning/bag.json.   node scripts/import-bag.mjs
 */

const contentDir = join(repoRoot, 'packages/content');
const speciesBySource = new Map();
for (const file of ['water', 'fire', 'grass', 'light', 'dark', 'summon-pool']) {
  for (const s of JSON.parse(readFileSync(join(contentDir, 'species', `${file}.json`), 'utf8'))) {
    speciesBySource.set(s.sourceId, s);
  }
}

/** Source item → our currency (shards, and the boxes that stay in the bag). */
const CURRENCY = {
  10102: 'pokemonShard3',
  10103: 'pokemonShard5',
  10262: 'pokemonShard4',
  10501: 'preciousShard',
  10503: 'preciousGiftbox',
  10215: 'boxSupreme',
  10217: 'boxLegendary',
  10218: 'boxShinySupreme',
  10187: 'boxLD',
};
/** Random Pokémon boxes that open themselves when composed (never kept in the bag). */
const AUTO_OPEN = { 10106: 'box3Star', 10107: 'box5Star', 10266: 'chest4Star' };
/** Source species-shard item ids (hero_basic chipitemid) → the species they belong to. */
const SHARD_SPECIES = { 40037: 137, 40038: 138, 40039: 139, 40042: 142, 40043: 143, 40044: 144 };
/** Golden Egg Vouchers: the Golden Egg is not built, so this Giftbox choice is left out (ASSUMPTIONS #84). */
const LEFT_OUT = new Set([10055]);

const compound = loadTable('item_compound_json');
const heroBoxes = Object.values(loadTable('item_hero_json'));
const itemBoxes = Object.values(loadTable('item_use_json'));

function speciesOf(heroId) {
  const s = speciesBySource.get(heroId);
  if (!s) throw new Error(`no species for source hero ${heroId}`);
  return s;
}

function boxId(item) {
  const id = CURRENCY[item] ?? AUTO_OPEN[item];
  if (!id) throw new Error(`unmapped box ${item}`);
  return id;
}

function heroRow(entry, select) {
  if (select) return { species: speciesOf(entry).id, star: null, weight: 1 };
  const [kind, value, weight] = entry;
  if (kind === 1) return { species: speciesOf(value).id, star: null, weight };
  if (kind === 2) {
    const s = speciesOf(Math.floor(value / 10_000));
    const star = value % 100;
    if (!s.stars.some((c) => c.star === star)) throw new Error(`card ${value}: ${s.id} has no ${star}★`);
    return { species: s.id, star, weight };
  }
  throw new Error(`unknown box row kind ${kind}`);
}

const BOX_ITEMS = [10106, 10107, 10266, 10215, 10217, 10218, 10187];
const boxes = BOX_ITEMS.map((item) => {
  const row = heroBoxes.find((h) => h.item_id === item);
  if (!row) throw new Error(`no item_hero row for ${item}`);
  const select = row.is_select === 1;
  return {
    id: boxId(item),
    kind: select ? 'chooseSpecies' : 'random',
    autoOpen: item in AUTO_OPEN,
    rows: row.hero_id_list.map((e) => heroRow(e, select)),
  };
});

const giftbox = itemBoxes.find((u) => u.item_id === 10503);
if (!giftbox || giftbox.can_choose !== 1) throw new Error('Selectable Precious Giftbox is not a choice box');
boxes.push({
  id: 'preciousGiftbox',
  kind: 'chooseShards',
  autoOpen: false,
  rows: giftbox.fixed_item
    .filter(([item]) => !LEFT_OUT.has(item))
    .map(([item, qty]) => {
      const hero = SHARD_SPECIES[item];
      if (!hero) throw new Error(`Giftbox: unmapped item ${item}`);
      return { species: speciesOf(hero).id, star: null, weight: qty };
    }),
});

const recipes = [10102, 10103, 10262, 10501].map((item) => {
  const row = compound[String(item)];
  if (!row) throw new Error(`no compose recipe for ${item}`);
  return { from: CURRENCY[item], count: row.item_num, box: boxId(row.target_item_id) };
});

const out = {
  _note:
    'R9: copied from the source by scripts/import-bag.mjs (item_compound_json, item_hero_json, item_use_json 10503; kb/pokemon-growth.md). A random box row with star null gives the species at its first star; chooseShards rows give `weight` shards of the chosen species.',
  recipes,
  boxes,
};
writeFileSync(join(contentDir, 'tuning/bag.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(recipes.map((r) => `${r.from} ×${r.count} → ${r.box}`).join(' · '));
console.log(boxes.map((b) => `${b.id} (${b.kind}${b.autoOpen ? ', opens itself' : ''}, ${b.rows.length})`).join(' · '));
