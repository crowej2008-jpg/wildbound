/* eslint-disable no-undef */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTable, loadTextMap, repoRoot } from './source/source.mjs';

/**
 * R1 (source retrofit): copy every species' identity and star ladder exactly from the source game's
 * config (hero_basic_json, hero_evolution_json; reference/game-rebuild/kb/pokemon-growth.md).
 *
 * Kept from the owner's roster (his exception to "copy the source"): the species ids and names,
 * descriptions, portrait seeds and the M9 skill kits. Everything else comes from the source:
 * faction (`race`), class (`career`), quality (`potential`), the shards that make one Pokémon
 * (`item_num`), and per star: the card name, level cap, base and per-level stats, the faction damage
 * bonus, and the fodder for the next star.
 *
 * Run on a machine with the source dumps (reference/ is gitignored), from the repo root:
 *
 *   node scripts/import-species.mjs
 *
 * It reads the current species/kits JSON for the kept fields, so it is safe to re-run.
 */

const contentDir = join(repoRoot, 'packages/content');
const heroMap = JSON.parse(readFileSync(join(repoRoot, 'scripts/data/source-hero-map.json'), 'utf8'));

/** Source race → our faction id (the source has five). */
const FACTION_BY_RACE = { 1: 'water', 2: 'fire', 3: 'grass', 4: 'light', 5: 'dark' };
/** Source career → our class id (ATK / DEF / SKILL). */
const CLASS_BY_CAREER = { 1: 'striker', 2: 'guardian', 3: 'adept' };
/** Source potential number → our tier. */
const TIER_BY_POTENTIAL = { 13: 'rare', 14: 'epic', 15: 'legendary', 16: 'supreme', 17: 'mythic', 18: 'origin' };
/** attr_json ids of "DMG BST to [faction]" on a star card. */
const FACTION_BOOST_ATTR = { 138: 'water', 140: 'fire', 142: 'grass', 144: 'light', 146: 'dark' };
const FACTIONS = ['water', 'fire', 'grass', 'light', 'dark'];
const OLD_FILES = ['ember', 'tide', 'grove', 'volt', 'frost', 'shade', ...FACTIONS];

const basics = loadTable('hero_basic_json');
const cards = Object.values(loadTable('hero_evolution_json'));
const text = loadTextMap();

/** English for a source string (the dump's `_text` table), falling back to the raw string. */
function english(raw) {
  return text[raw] ?? raw;
}

function attrMap(list) {
  const out = {};
  for (const [id, value] of list ?? []) out[id] = value;
  return out;
}

/** [heroId|0, star, race|0, count] → our fodder requirement. */
function fodder(rows) {
  if (!rows) return null;
  return rows.map(([heroId, star, race, count]) => {
    const own = heroId !== 0;
    const req = { own, star, count };
    if (!own && race) req.faction = FACTION_BY_RACE[race];
    return req;
  });
}

function starRow(card) {
  const basic = attrMap(card.basic_attr);
  const growth = attrMap(card.growth_attr);
  const row = {
    star: card.qua_star,
    name: english(card.name),
    maxLevel: card.max_lev,
    basic: { hp: basic[401] ?? 0, atk: basic[402] ?? 0, spd: basic[131] ?? 0 },
    growth: { hp: growth[401] ?? 0, atk: growth[402] ?? 0, pDef: growth[403] ?? 0, sDef: growth[405] ?? 0 },
  };
  if (card.extra_basic_attr) {
    const extra = attrMap(card.extra_basic_attr);
    row.extraBasic = { hp: extra[401] ?? 0, atk: extra[402] ?? 0 };
  }
  if (card.extra_growth_attr) {
    const extra = attrMap(card.extra_growth_attr);
    row.extraGrowth = { hp: extra[401] ?? 0, atk: extra[402] ?? 0 };
  }
  for (const [id, faction] of Object.entries(FACTION_BOOST_ATTR)) {
    if (basic[id]) row.factionBoost = { faction, value: basic[id] / 10_000 };
  }
  const next = fodder(card.evolution_item);
  if (next) row.fodder = next;
  if (card.evolution_extra_item) {
    row.fodderItems = card.evolution_extra_item.map(([item, count]) => ({ item, count }));
  }
  return row;
}

// The kept, owner-side fields.
const oldSpecies = new Map();
const oldKits = new Map();
for (const file of OLD_FILES) {
  for (const [dir, map] of [
    ['species', oldSpecies],
    ['kits', oldKits],
  ]) {
    const path = join(contentDir, dir, `${file}.json`);
    if (!existsSync(path)) continue;
    for (const entry of JSON.parse(readFileSync(path, 'utf8'))) map.set(entry.id, entry);
  }
}

const speciesOut = Object.fromEntries(FACTIONS.map((f) => [f, []]));
const kitsOut = Object.fromEntries(FACTIONS.map((f) => [f, []]));

for (const hero of Object.values(basics).sort((a, b) => a.hero_id - b.hero_id)) {
  const id = heroMap[hero.hero_id];
  const old = oldSpecies.get(id);
  const kit = oldKits.get(id);
  if (!id || !old || !kit) throw new Error(`No species/kit for source hero ${hero.hero_id} (${id})`);
  const faction = FACTION_BY_RACE[hero.race];
  const className = CLASS_BY_CAREER[hero.career];
  const tier = TIER_BY_POTENTIAL[hero.potential];
  if (!faction || !className || !tier) throw new Error(`Unmapped race/career/potential on hero ${hero.hero_id}`);
  const stars = cards
    .filter((card) => card.hero_id === hero.hero_id)
    .sort((a, b) => a.qua_star - b.qua_star)
    .map(starRow);
  speciesOut[faction].push({
    id,
    name: old.name,
    faction,
    class: className,
    tier,
    description: old.description,
    paletteSeed: old.paletteSeed,
    sourceId: hero.hero_id,
    shards: hero.item_num,
    stars,
  });
  kitsOut[faction].push({ ...kit, faction, class: className, tier });
}

for (const file of OLD_FILES) {
  for (const dir of ['species', 'kits']) {
    const path = join(contentDir, dir, `${file}.json`);
    if (existsSync(path)) unlinkSync(path);
  }
}
for (const faction of FACTIONS) {
  writeFileSync(join(contentDir, 'species', `${faction}.json`), `${JSON.stringify(speciesOut[faction], null, 2)}\n`);
  writeFileSync(join(contentDir, 'kits', `${faction}.json`), `${JSON.stringify(kitsOut[faction], null, 2)}\n`);
  console.log(`${faction}: ${speciesOut[faction].length} species`);
}
