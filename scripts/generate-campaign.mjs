/* eslint-disable no-undef */
// M13.0a campaign generator (dev-only; the generated JSON is committed).
//
// Source shape: 182 chapters x 10 stages, 60 gym gates at every third chapter,
// ten-stage chapters with a boss at index 10. Names, factions, species picks,
// levels and rewards are ours. Run from the repo root:
//
//   node scripts/generate-campaign.mjs
//
// The first three chapters keep the M5 authored stages 1-6; this script appends
// stages 7-10 and writes chapters 4-182 to stages/campaign.json.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = resolve(root, 'packages/content');
const speciesDir = resolve(contentDir, 'species');
const stagesDir = resolve(contentDir, 'stages');
const tuningDir = resolve(contentDir, 'tuning');

const ARCS = [
  { name: 'Emberfall', faction: 'ember' },
  { name: 'Tidewake', faction: 'tide' },
  { name: 'Groveheart', faction: 'grove' },
  { name: 'Cinder Reach', faction: 'ember' },
  { name: 'Glass Tide', faction: 'tide' },
  { name: 'Deeproot', faction: 'grove' },
  { name: 'Voltspire', faction: 'volt' },
  { name: 'Frostmere', faction: 'frost' },
  { name: 'Shadeveil', faction: 'shade' },
  { name: 'Sunken Chorus', faction: 'tide' },
  { name: 'Ashen Crown', faction: 'ember' },
  { name: 'Stormcoast', faction: 'volt' },
  { name: 'Pale Aurora', faction: 'frost' },
  { name: 'Hollow Star', faction: 'shade' },
];

const CHAPTER_SUFFIXES = [
  'Foothills', 'Trail', 'Crossing', 'Hollow', 'Ridge', 'Basin', 'Gate', 'Spire', 'Mire',
  'Terrace', 'Veil', 'Heart', 'Crown',
];

const STAGE_SUFFIXES = [
  'Approach', 'Trail', 'Crossing', 'Hollow', 'Ridge', 'Basin', 'Gate', 'Spire', 'Mire', 'Heart',
];

const ENEMY_COUNTS = [1, 2, 2, 3, 3, 4, 4, 5, 5, 6];

const GYM_REGIONS = [
  {
    region: 'Emberfall',
    faction: 'ember',
    names: ['Cinderwatch', 'Ashbell', 'Emberford', 'Coalcrest', 'Sootspire', 'Flamewell', 'Scorchgate', 'Magmaward', 'Cinderhall', 'Pyrelight'],
  },
  { region: 'Tidewake', faction: 'tide', names: ['Saltglass', 'Wavecrest', 'Coralstep', 'Tidebell'] },
  {
    region: 'Groveheart',
    faction: 'grove',
    names: ['Mossring', 'Thornvale', 'Fernwatch', 'Bloomstead', 'Rootgarden', 'Canopyhall'],
  },
  { region: 'Voltspire', faction: 'volt', names: ['Sparkpoint', 'Stormloom', 'Arcway', 'Thunderrest', 'Coilspire', 'Voltgard'] },
  { region: 'Frostmere', faction: 'frost', names: ['Snowveil', 'Rimegate', 'Glacierhold', 'Hailwatch', 'Frostbell', 'Iceward'] },
  {
    region: 'Shadeveil',
    faction: 'shade',
    names: ['Duskwatch', 'Nightglass', 'Umbrafall', 'Veilspire', 'Hollowcrown', 'Shadowfen', 'Gloomgate', 'Starless', 'Murkhold', 'Blackthorn', 'Eclipsestead', 'Silent Court', 'Last Lantern'],
  },
  {
    region: 'Sunken Chorus',
    faction: 'tide',
    names: ['Brinehall', 'Choraldeep', 'Kelpward', 'Pearlrest', 'Drowned Bell', 'Reefsong', 'Abyssal Step', 'Tidecrypt', 'Coral Choir', 'Deepcurrent', 'Salt Cathedral', 'Sunken Crown'],
  },
  { region: 'Ashen Crown', faction: 'ember', names: ['Ashcrown', 'Emberthrone', 'Final Pyre'] },
];

const TIER_ORDER = ['common', 'rare', 'epic', 'legendary', 'supreme', 'mythic'];

function readSpecies() {
  const all = [];
  for (const file of readdirSync(speciesDir).filter((f) => f.endsWith('.json')).sort()) {
    all.push(...JSON.parse(readFileSync(resolve(speciesDir, file), 'utf8')));
  }
  return all.sort((a, b) => a.id.localeCompare(b.id));
}

function hash32(n) {
  let x = n >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function tierBand(chapter) {
  if (chapter <= 20) return ['rare', 'epic'];
  if (chapter <= 45) return ['epic', 'legendary'];
  if (chapter <= 78) return ['legendary', 'supreme'];
  if (chapter <= 120) return ['supreme', 'mythic'];
  return ['mythic', 'supreme'];
}

function poolFor(species, faction, chapter) {
  const factionPool = species.filter((s) => s.faction === faction);
  const tiers = tierBand(chapter);
  const filtered = factionPool.filter((s) => tiers.includes(s.tier));
  return filtered.length > 0 ? filtered : factionPool;
}

function pick(pool, seed) {
  return pool[hash32(seed) % pool.length];
}

function levelAt(chapter, index) {
  if (chapter <= 3) return null; // authored 1-6; appended stages handled below
  return Math.max(1, Math.min(135, Math.round(14 + (chapter - 4) * 0.65 + (index - 1) * 0.1)));
}

function starsAt(chapter, index) {
  return Math.min(10, 1 + Math.floor((chapter - 1) / 20) + (index === 10 ? 1 : 0));
}

function evolutionAt(chapter) {
  return Math.min(2, Math.floor((chapter - 1) / 70));
}

function starsForRounds(chapter) {
  if (chapter > 120) return [5, 8];
  if (chapter > 60) return [4, 7];
  return [3, 6];
}

function stageRewards(chapter, index) {
  const firstGold = Math.round(120 * chapter ** 1.25 + 40 * index * chapter ** 0.9);
  const firstCandy = Math.round(30 * chapter ** 1.1 + 8 * index);
  const firstShard = 5 + Math.floor(chapter / 4) + (index === 10 ? 5 : 0);
  const firstXp = 20 + chapter * 3 + index * 2;
  const gems = (index === 5 ? 10 + Math.floor(chapter / 2) : 0) + (index === 10 ? 20 + Math.floor(chapter / 2) : 0);
  const stone = index === 10 && chapter % 10 === 0 ? 1 + Math.floor(chapter / 40) : 0;
  return {
    firstClear: {
      gold: firstGold,
      ...(gems > 0 ? { gems } : {}),
      candy: firstCandy,
      shard: firstShard,
      ...(stone > 0 ? { stone } : {}),
      xp: firstXp,
    },
    repeat: {
      gold: Math.round(firstGold * 0.18),
      candy: Math.round(firstCandy * 0.18),
      xp: Math.round(firstXp * 0.25),
    },
    idlePerMinute: {
      gold: Math.round(60 + 3.6 * (chapter - 1) + index * 0.2),
      candy: Math.round(6 + 1.3 * (chapter - 1) + index * 0.1),
      xp: 2 + Math.floor(chapter / 8),
    },
  };
}

function chapterMeta(number) {
  if (number === 1) return { number, name: 'Hatchling Trail', region: 'Emberfall', faction: 'ember' };
  if (number === 2) return { number, name: 'Frostline Approach', region: 'Frostmere', faction: 'tide' };
  if (number === 3) return { number, name: 'Shadewood Fringe', region: 'Shadeveil', faction: 'grove' };
  const arc = ARCS[Math.min(ARCS.length - 1, Math.floor((number - 1) / 13))];
  const suffix = CHAPTER_SUFFIXES[(number - 1) % 13];
  return { number, name: `${arc.name} ${suffix}`, region: arc.name, faction: arc.faction };
}

function enemiesFor(species, chapter, index, faction) {
  const pool = poolFor(species, faction, chapter);
  const count = ENEMY_COUNTS[index - 1];
  const bossTier = index === 10 ? Math.max(...pool.map((s) => TIER_ORDER.indexOf(s.tier))) : -1;
  const bossPool = index === 10 ? pool.filter((s) => TIER_ORDER.indexOf(s.tier) === bossTier) : [];
  const boss = index === 10 ? pick(bossPool.length > 0 ? bossPool : pool, chapter * 1000 + index) : null;
  const enemies = [];
  for (let slot = 0; slot < count; slot += 1) {
    const speciesEntry =
      slot === 0 && boss ? boss : pick(pool, chapter * 1000 + index * 100 + slot);
    enemies.push({
      speciesId: speciesEntry.id,
      level: levelAt(chapter, index),
      stars: starsAt(chapter, index),
      stage: evolutionAt(chapter),
    });
  }
  return enemies;
}

function generateStages(species, chapters) {
  const out = [];
  for (const chapter of chapters) {
    if (chapter.number <= 3) continue;
    for (let index = 1; index <= 10; index += 1) {
      const rewards = stageRewards(chapter.number, index);
      out.push({
        id: `c${chapter.number}-${index}`,
        chapter: chapter.number,
        index,
        name: `${chapter.name} ${STAGE_SUFFIXES[index - 1]}`,
        enemies: enemiesFor(species, chapter.number, index, chapter.faction),
        ...rewards,
        starRounds: starsForRounds(chapter.number),
        ...(index === 1 && chapter.number % 3 === 0
          ? { gate: { gymId: `gym-${chapter.number / 3}` } }
          : {}),
      });
    }
  }
  return out;
}

function extendEarlyChapter(chapterNumber, source, species, chapter) {
  // Keep the M5 authored stages 1-6 byte-for-byte (apart from a new gate).
  const authored = source.slice(0, 6);
  const lastLevel = authored[authored.length - 1].enemies[0].level;
  const out = authored.map((stage) =>
    chapterNumber === 3 && stage.index === 1
      ? { ...stage, gate: { gymId: 'gym-1' } }
      : stage,
  );
  for (let index = 7; index <= 10; index += 1) {
    const rewards = stageRewards(chapterNumber, index);
    const level = Math.min(135, lastLevel + Math.ceil((index - 6) * 0.6));
    const enemies = enemiesFor(species, chapterNumber, index, chapter.faction).map((enemy) => ({
      ...enemy,
      level,
    }));
    out.push({
      id: `c${chapterNumber}-${index}`,
      chapter: chapterNumber,
      index,
      name: `${chapter.name} ${['Rise', 'Deep', 'Crown', 'Summit'][index - 7]}`,
      enemies,
      ...rewards,
      starRounds: starsForRounds(chapterNumber),
    });
  }
  return out;
}

function generateGyms(species) {
  const gyms = [];
  let index = 1;
  for (const region of GYM_REGIONS) {
    for (const baseName of region.names) {
      const chapterNumber = index * 3;
      const baseLevel = chapterNumber <= 3 ? 11 : levelAt(chapterNumber, 1);
      const level = Math.min(135, baseLevel + 2);
      const stars = Math.min(10, 1 + Math.floor((chapterNumber - 1) / 20) + 1);
      const stage = evolutionAt(chapterNumber);
      const pool = poolFor(species, region.faction, chapterNumber);
      const bossTier = Math.max(...pool.map((s) => TIER_ORDER.indexOf(s.tier)));
      const bossPool = pool.filter((s) => TIER_ORDER.indexOf(s.tier) === bossTier);
      const boss = pick(bossPool.length > 0 ? bossPool : pool, index * 17);
      const team = [];
      for (let slot = 0; slot < 6; slot += 1) {
        const member = slot === 0 ? boss : pick(pool, index * 100 + slot);
        team.push({
          speciesId: member.id,
          level: level + (slot >= 3 ? 1 : 0),
          stars,
          stage,
        });
      }
      gyms.push({
        id: `gym-${index}`,
        index,
        chapter: chapterNumber,
        name: `${baseName} Gym`,
        region: region.region,
        faction: region.faction,
        enemies: team,
        firstClear: {
          gold: 5000 + chapterNumber * 500,
          gems: 100 + chapterNumber * 2,
          candy: 2000 + chapterNumber * 100,
          shard: 20 + Math.floor(chapterNumber / 2),
          xp: 200 + chapterNumber * 10,
        },
        repeat: { gold: 1000 + chapterNumber * 100 },
        starRounds: [4, 8],
      });
      index += 1;
    }
  }
  return gyms;
}

function main() {
  const species = readSpecies();
  const chapters = Array.from({ length: 182 }, (_, i) => chapterMeta(i + 1));

  const chapterFiles = [1, 2, 3].map((n) => {
    const file = resolve(stagesDir, `chapter${n}.json`);
    return { number: n, file, source: JSON.parse(readFileSync(file, 'utf8')) };
  });

  const campaign = {
    chapterChestGems: 200,
    chapters,
    gyms: generateGyms(species),
  };

  writeFileSync(resolve(tuningDir, 'campaign.json'), `${JSON.stringify(campaign, null, 2)}\n`);

  for (const entry of chapterFiles) {
    const chapter = chapters.find((c) => c.number === entry.number);
    const extended = extendEarlyChapter(entry.number, entry.source, species, chapter);
    writeFileSync(entry.file, `${JSON.stringify(extended, null, 2)}\n`);
  }

  const generated = generateStages(species, chapters);
  writeFileSync(resolve(stagesDir, 'campaign.json'), `${JSON.stringify(generated, null, 2)}\n`);

  console.log(
    `wrote ${campaign.chapters.length} chapters, ${campaign.gyms.length} gyms, ` +
      `${generated.length + 30} stages`,
  );
}

main();
