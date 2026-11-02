/* eslint-disable no-undef */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './source/source.mjs';

/**
 * R9 (owner, 2026-11-02): the 14 low Pokémon the source's summon pools and Pokémon boxes give out
 * that are not in the owner's 84 (source heroes 101–110 and 112–115). The owner chose "full Pokémon
 * with made-up stats" — the dumps hold only each one's name, faction, rarity and the star cards the
 * pools draw (gacha_cfg `_gacha` catalogue), so everything else here is invented:
 *
 * - Normal (tier `common`): stars 1–3 (the pools draw 1★ and 2★, the 3★ box 3★); Uncommon (tier
 *   `uncommon`): stars 3–5. Level caps follow the source's star caps (60 / 80 / 100 at 3 / 4 / 5★;
 *   20 / 40 at 1 / 2★).
 * - Stats: the Rare tier's average star row × 0.85 (Uncommon) or × 0.7 (Normal); 1★ / 2★ step down
 *   by the Rare 3★ → 4★ ratio. Faction bonus: 25 % on the faction each beats (water → fire → grass →
 *   water), as on the Rares.
 * - Fodder: own copies at the same star (×2) except Uncommon 4★ → 5★, which takes two same-faction
 *   4★ Pokémon (the Rare ladder's pattern).
 * - Kits: the class's Rare kit (striker = Ninetales, adept = Starmie, guardian = Blastoise) with
 *   weaker talents. Caterpie's kit also carries the owner's hidden `lethalHits` (his words: "a one
 *   shot god … but dont say it in its kit") — no text anywhere describes it.
 *
 * Reads the Rare species/kits already in packages/content and the gacha catalogue in reference/;
 * writes packages/content/species/summon-pool.json and kits/summon-pool.json.
 *
 *   node scripts/generate-summon-pokemon.mjs
 */

const contentDir = join(repoRoot, 'packages/content');
const FACTIONS = ['water', 'fire', 'grass', 'light', 'dark'];
const BEATS = { water: 'fire', fire: 'grass', grass: 'water' };

/** hero id → owner-facing id, class (made up), palette seed (made up). */
const ROSTER = {
  101: { id: 'caterpie', class: 'striker', seed: 101_31 },
  102: { id: 'jigglypuff', class: 'guardian', seed: 102_47 },
  103: { id: 'pidgeotto', class: 'striker', seed: 103_59 },
  104: { id: 'ekans', class: 'adept', seed: 104_61 },
  105: { id: 'meowth', class: 'striker', seed: 105_73 },
  106: { id: 'koffing', class: 'adept', seed: 106_89 },
  107: { id: 'poliwag', class: 'guardian', seed: 107_97 },
  108: { id: 'abra', class: 'adept', seed: 108_13 },
  109: { id: 'oddish', class: 'adept', seed: 109_27 },
  110: { id: 'slowpoke', class: 'guardian', seed: 110_39 },
  112: { id: 'onix', class: 'guardian', seed: 112_43 },
  113: { id: 'scyther', class: 'striker', seed: 113_57 },
  114: { id: 'growlithe', class: 'striker', seed: 114_67 },
  115: { id: 'togepi', class: 'adept', seed: 115_79 },
};

const TEMPLATE_KIT = { striker: 'ninetales', adept: 'starmie', guardian: 'blastoise' };
const LEVEL_CAP = { 1: 20, 2: 40, 3: 60, 4: 80, 5: 100 };

function readAll(dir) {
  return FACTIONS.flatMap((f) => JSON.parse(readFileSync(join(contentDir, dir, `${f}.json`), 'utf8')));
}

const species = readAll('species');
const kits = readAll('kits');
const catalogue = JSON.parse(
  readFileSync(join(repoRoot, 'reference/game-rebuild/data/h5-client/2026-10-03/gacha_cfg.json'), 'utf8'),
)._gacha.pools;

/** hero id → { name, faction, rarity, cards: star → card name } from every pool that draws it. */
const heroes = {};
for (const pool of catalogue) {
  for (const entry of pool.entries ?? []) {
    if (!ROSTER[entry.hero_id]) continue;
    const hero = (heroes[entry.hero_id] ??= { name: entry.pokemon, faction: entry.faction, rarity: entry.rarity, cards: {} });
    hero.cards[entry.star] = entry.card_name;
  }
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const rares = species.filter((s) => s.tier === 'rare');
function rareRow(star) {
  const rows = rares.flatMap((s) => s.stars.filter((c) => c.star === star));
  const avg = (part, key) => mean(rows.map((r) => r[part][key]));
  return {
    basic: { hp: avg('basic', 'hp'), atk: avg('basic', 'atk'), spd: avg('basic', 'spd') },
    growth: { hp: avg('growth', 'hp'), atk: avg('growth', 'atk'), pDef: avg('growth', 'pDef'), sDef: avg('growth', 'sDef') },
  };
}
const RARE = { 3: rareRow(3), 4: rareRow(4), 5: rareRow(5) };
// 1★ / 2★ step down from 3★ by the 3★ → 4★ ratio.
const STEP = { basic: RARE[3].basic.hp / RARE[4].basic.hp, growth: RARE[3].growth.hp / RARE[4].growth.hp };
function scaledRow(star) {
  if (RARE[star]) return RARE[star];
  const up = scaledRow(star + 1);
  return {
    basic: { hp: up.basic.hp * STEP.basic, atk: up.basic.atk * STEP.basic, spd: up.basic.spd },
    growth: {
      hp: up.growth.hp * STEP.growth,
      atk: up.growth.atk * STEP.growth,
      pDef: up.growth.pDef * STEP.growth,
      sDef: up.growth.sDef * STEP.growth,
    },
  };
}

const round2 = (x) => Math.round(x * 100) / 100;

function starCard(hero, faction, star, last, factor, uncommon) {
  const row = scaledRow(star);
  const card = {
    star,
    name: hero.cards[star] ?? hero.cards[star - 1] ?? hero.name,
    maxLevel: LEVEL_CAP[star],
    basic: { hp: Math.round(row.basic.hp * factor), atk: Math.round(row.basic.atk * factor), spd: Math.round(row.basic.spd * 0.8) },
    growth: {
      hp: round2(row.growth.hp * factor),
      atk: round2(row.growth.atk * factor),
      pDef: round2(row.growth.pDef * factor),
      sDef: round2(row.growth.sDef * factor),
    },
  };
  if (BEATS[faction]) card.factionBoost = { faction: BEATS[faction], value: 0.25 };
  if (star < last) {
    card.fodder =
      uncommon && star === 4
        ? [{ own: false, star: 4, count: 2, faction }]
        : [{ own: true, star, count: 2 }];
  }
  return card;
}

const speciesOut = [];
const kitsOut = [];
for (const [heroId, own] of Object.entries(ROSTER)) {
  const hero = heroes[heroId];
  if (!hero) throw new Error(`hero ${heroId} is not in the gacha catalogue`);
  const faction = hero.faction.toLowerCase();
  const uncommon = hero.rarity === 'Uncommon';
  const tier = uncommon ? 'uncommon' : 'common';
  const [first, last] = uncommon ? [3, 5] : [1, 3];
  const factor = uncommon ? 0.85 : 0.7;
  const stars = [];
  for (let star = first; star <= last; star++) stars.push(starCard(hero, faction, star, last, factor, uncommon));
  speciesOut.push({
    id: own.id,
    name: hero.name,
    faction,
    class: own.class,
    tier,
    description: `${hero.name}, a ${uncommon ? 'Uncommon' : 'Normal'} ${faction} Pokémon from the source's summon pools.`,
    paletteSeed: own.seed,
    sourceId: Number(heroId),
    shards: 30,
    stars,
  });

  const template = kits.find((k) => k.id === TEMPLATE_KIT[own.class]);
  const mult = uncommon ? 1.12 : 1.06;
  const talents = {
    ...template.talents,
    statMods: template.talents.statMods.map((m) => (m.mult !== undefined ? { ...m, mult } : { ...m, add: round2(m.add * 0.6) })),
  };
  if (own.id === 'caterpie') talents.lethalHits = true;
  kitsOut.push({ id: own.id, name: hero.name, faction, class: own.class, tier, skills: template.skills, talents });
}

writeFileSync(join(contentDir, 'species/summon-pool.json'), `${JSON.stringify(speciesOut, null, 2)}\n`);
writeFileSync(join(contentDir, 'kits/summon-pool.json'), `${JSON.stringify(kitsOut, null, 2)}\n`);
console.log(`summon-pool: ${speciesOut.length} species`);
