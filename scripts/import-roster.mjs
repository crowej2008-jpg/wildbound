/* eslint-disable no-undef */
// One-off content generator (2026-10-15 owner override).
//
// Turns the owner's wiki roster dump (wiki-pokemon-skills.xlsx, "Roster" sheet)
// into the game's species + kits content. Species names come from the sheet;
// classes, base stats, kits and palettes are generated deterministically so the
// whole roster is reproducible. Run from the repo root:
//
//   node scripts/import-roster.mjs
//
// The M1 parity kits `tidewarden` + `twigleaf` are preserved byte-for-byte for
// the golden regression lock; the sheet's matching creatures (Kyogre, Sceptile)
// re-use those two ids and kits unchanged.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = resolve(root, 'packages/content');
const FILES = ['ember', 'tide', 'grove', 'volt', 'frost', 'shade'];

/** [name, rarity, attribute] — transcribed from the sheet's "Roster" tab. */
const ROSTER = [
  ['Calyrex', 'Origin', 'Light'],
  ['Necrozma', 'Origin', 'Light'],
  ['Origin Lugia', 'Origin', 'Dark'],
  ['Origin Rayquaza', 'Origin', 'Dark'],
  ['Shadow Mewtwo', 'Origin', 'Dark'],
  ['Zacian', 'Origin', 'Light'],
  ['Arceus', 'Mythic', 'Light'],
  ['Wind-God Pidgeot', 'Mythic', 'Light'],
  ['Black Kyurem', 'Mythic', 'Dark'],
  ['Kyogre', 'Mythic', 'Light'],
  ['Hoopa', 'Mythic', 'Dark'],
  ['Mewtwo', 'Mythic', 'Dark'],
  ['Mew', 'Mythic', 'Light'],
  ['Darkrai', 'Mythic', 'Dark'],
  ['Cresselia', 'Mythic', 'Light'],
  ['Jirachi', 'Mythic', 'Light'],
  ['Solgaleo', 'Mythic', 'Light'],
  ['Lunala', 'Mythic', 'Dark'],
  ['Deoxys', 'Mythic', 'Dark'],
  ['Meloetta', 'Mythic', 'Dark'],
  ['Snorlax', 'Mythic', 'Light'],
  ['Psyduck', 'Supreme', 'Water'],
  ['Shiny Venusaur', 'Supreme', 'Grass'],
  ['Shiny Blastoise', 'Supreme', 'Water'],
  ['Shiny Charizard', 'Supreme', 'Fire'],
  ['Shiny Gengar', 'Supreme', 'Fire'],
  ['Shiny Raichu', 'Supreme', 'Grass'],
  ['Shiny God Ash-Pikachu', 'Supreme', 'Grass'],
  ['God Ash-Pikachu', 'Supreme', 'Grass'],
  ['Mimikyu', 'Supreme', 'Fire'],
  ['Wobbuffet', 'Supreme', 'Grass'],
  ['Yveltal', 'Supreme', 'Fire'],
  ['Xerneas', 'Supreme', 'Water'],
  ['Giratina', 'Supreme', 'Fire'],
  ['Zygarde', 'Supreme', 'Grass'],
  ['Palkia', 'Supreme', 'Water'],
  ['Dialga', 'Supreme', 'Grass'],
  ['Keldeo', 'Supreme', 'Water'],
  ['Victini', 'Supreme', 'Fire'],
  ['Shaymin', 'Supreme', 'Grass'],
  ['Infernape', 'Supreme', 'Fire'],
  ['Greninja', 'Supreme', 'Water'],
  ['Manaphy', 'Supreme', 'Water'],
  ['Celebi', 'Supreme', 'Grass'],
  ['Ho-Oh', 'Supreme', 'Fire'],
  ['Groudon', 'Supreme', 'Fire'],
  ['Rayquaza', 'Supreme', 'Grass'],
  ['Lugia', 'Supreme', 'Water'],
  ['Entei', 'Legendary', 'Fire'],
  ['Suicune', 'Legendary', 'Water'],
  ['Raikou', 'Legendary', 'Grass'],
  ['Moltres', 'Legendary', 'Fire'],
  ['Articuno', 'Legendary', 'Water'],
  ['Zapdos', 'Legendary', 'Grass'],
  ['Gyarados', 'Epic', 'Water'],
  ['Blaziken', 'Epic', 'Fire'],
  ['Swampert', 'Epic', 'Water'],
  ['Sceptile', 'Epic', 'Grass'],
  ['Typhlosion', 'Epic', 'Fire'],
  ['Feraligatr', 'Epic', 'Water'],
  ['Meganium', 'Epic', 'Grass'],
  ['Dragonite', 'Epic', 'Water'],
  ['Metagross', 'Epic', 'Grass'],
  ['Garchomp', 'Epic', 'Water'],
  ['Hydreigon', 'Epic', 'Fire'],
  ['Gardevoir', 'Epic', 'Grass'],
  ['Slaking', 'Epic', 'Water'],
  ['Tyranitar', 'Epic', 'Fire'],
  ['Salamence', 'Epic', 'Grass'],
  ['Gengar', 'Epic', 'Fire'],
  ['Charizard', 'Rare', 'Fire'],
  ['Raichu', 'Rare', 'Grass'],
  ['Starmie', 'Rare', 'Water'],
  ['Blastoise', 'Rare', 'Water'],
  ['Ninetales', 'Rare', 'Fire'],
  ['Venusaur', 'Rare', 'Grass'],
  ['Shiny Mewtwo', 'Shiny Mythic', 'Dark'],
  ['Shiny Mew', 'Shiny Mythic', 'Light'],
  ['Shiny Kyogre', 'Shiny Mythic', 'Light'],
  ['Shiny Darkrai', 'Shiny Mythic', 'Dark'],
  ['Shiny Arceus', 'Shiny Mythic', 'Light'],
  ['Shiny Kyurem', 'Shiny Mythic', 'Dark'],
  ['Shiny Hoopa', 'Shiny Mythic', 'Dark'],
  ['Shiny Cresselia', 'Shiny Mythic', 'Light'],
];

// Creatures supplied by the retained M1 parity kits (see docs/ASSUMPTIONS.md).
const PARITY = { Kyogre: 'tidewarden', Sceptile: 'twigleaf' };

const TIER_BY_RARITY = {
  Rare: 'rare',
  Epic: 'epic',
  Legendary: 'legendary',
  Supreme: 'supreme',
  Mythic: 'mythic',
  Origin: 'mythic',
  'Shiny Mythic': 'mythic',
};

const TIER_MULT = { common: 0.65, rare: 1, epic: 1.35, legendary: 1.8, supreme: 2.4, mythic: 3.2 };

const CLASS_BASE = {
  striker: { hp: 950, pAtk: 130, sAtk: 60, spd: 110, pDef: 65, sDef: 60 },
  adept: { hp: 1150, pAtk: 66, sAtk: 122, spd: 103, pDef: 100, sDef: 108 },
  guardian: { hp: 1400, pAtk: 105, sAtk: 73, spd: 92, pDef: 130, sDef: 130 },
};

const CLASS_CYCLE = ['striker', 'guardian', 'adept'];

/** The sheet lists final forms only, so growth stages are generated. */
function evolutionStages(name) {
  return [name, `${name} Prime`, `${name} Zenith`];
}

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function hash(text) {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function baseStats(className, tier) {
  const t = TIER_MULT[tier];
  const raw = CLASS_BASE[className];
  const out = {};
  for (const [k, v] of Object.entries(raw)) out[k] = Math.round(v * t);
  return out;
}

/** Canonical kits per class (same shapes the M2 roster shipped). */
function kitFor(id, name, faction, className, tier) {
  const skills =
    className === 'striker'
      ? {
          normal: { type: 'P', rates: [1], rule: 'column' },
          basic: { type: 'P', rates: [1.2], rule: 'column' },
          ult: { type: 'P', rates: [1.7, 1.4], rule: 'row' },
        }
      : className === 'guardian'
        ? {
            normal: {
              type: 'S',
              rates: [0.95],
              rule: 'column',
              selfBuffs: [{ tag: 'bulwark', field: 'dmgRdct', amount: 0.1, turns: 2 }],
            },
            basic: { type: 'S', rates: [1.15], rule: 'column' },
            ult: { type: 'S', rates: [1.6], rule: 'row' },
          }
        : {
            normal: { type: 'S', rates: [1], rule: 'column' },
            basic: {
              type: 'S',
              rates: [1.15],
              rule: 'row',
              targetDebuffs: [{ tag: 'chill', field: 'dmgRdct', amount: -0.15, turns: 2 }],
            },
            ult: {
              type: 'S',
              rates: [1.7],
              rule: 'row',
              targetDebuffs: [{ tag: 'daze', field: 'spd', amount: -40, turns: 2 }],
            },
          };

  const talents =
    className === 'striker'
      ? {
          statMods: [
            { field: 'pAtk', mult: 1.15 },
            { field: 'sAtk', mult: 1.15 },
            { field: 'crit', add: 0.05 },
          ],
        }
      : className === 'guardian'
        ? {
            statMods: [
              { field: 'hp', mult: 1.2 },
              { field: 'dmgRdct', add: 0.08 },
              { field: 'block', add: 0.05 },
            ],
            rageOnHit: 125,
          }
        : {
            statMods: [
              { field: 'sAtk', mult: 1.15 },
              { field: 'controlBoost', add: 0.1 },
              { field: 'healBoost', add: 0.1 },
            ],
          };

  return { id, name, faction, class: className, tier, skills, talents };
}

function loadJson(...parts) {
  return JSON.parse(readFileSync(resolve(contentDir, ...parts), 'utf8'));
}

const speciesByFaction = Object.fromEntries(FILES.map((f) => [f, []]));
const kitsByFaction = Object.fromEntries(FILES.map((f) => [f, []]));

// 1. Retain the two M1 parity kits (renamed) so the golden lock keeps replaying.
for (const [name, id] of Object.entries(PARITY)) {
  const file = id === 'tidewarden' ? 'tide' : 'grove';
  const species = loadJson('species', `${file}.json`).find((s) => s.id === id);
  const kit = loadJson('kits', `${file}.json`).find((k) => k.id === id);
  speciesByFaction[file].push({
    ...species,
    name,
    description: `${name}, a ${kit.tier} ${file} Wild from the owner's collection.`,
    paletteSeed: 1000 + (hash(name) % 9000),
    stages: evolutionStages(name),
  });
  kitsByFaction[file].push({ ...kit, name });
}

// 2. Generate the rest of the roster.
let lightCounter = 0;
let index = 0;
for (const [name, rarity, attribute] of ROSTER) {
  if (PARITY[name]) continue;
  index += 1;
  const faction =
    attribute === 'Fire'
      ? 'ember'
      : attribute === 'Water'
        ? 'tide'
        : attribute === 'Grass'
          ? 'grove'
          : attribute === 'Dark'
            ? 'shade'
            : lightCounter++ % 2 === 0
              ? 'volt'
              : 'frost';
  const id = slug(name);
  const className = CLASS_CYCLE[index % CLASS_CYCLE.length];
  const tier = TIER_BY_RARITY[rarity];
  speciesByFaction[faction].push({
    id,
    name,
    faction,
    class: className,
    tier,
    description: `${name}, a ${rarity.toLowerCase()} ${attribute.toLowerCase()} Wild from the owner's collection.`,
    paletteSeed: 1000 + (hash(id) % 9000),
    stages: evolutionStages(name),
    base: baseStats(className, tier),
  });
  kitsByFaction[faction].push(kitFor(id, name, faction, className, tier));
}

for (const faction of FILES) {
  writeFileSync(resolve(contentDir, 'species', `${faction}.json`), `${JSON.stringify(speciesByFaction[faction], null, 2)}\n`);
  writeFileSync(resolve(contentDir, 'kits', `${faction}.json`), `${JSON.stringify(kitsByFaction[faction], null, 2)}\n`);
  console.log(`${faction}: ${speciesByFaction[faction].length} species, ${kitsByFaction[faction].length} kits`);
}
