/* eslint-disable no-undef */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * One-time generator for the M13.1 Pet Home tuning table. The source's visible
 * shapes are preserved (17 Home levels, 6 -> 21 tiles, 16 merge levels, 50 free
 * summons, 8h offline, 5-minute settlement, 9 offers per page, 84 + 48 shop
 * rows); every name, number and description is original. The runtime never
 * generates content. Run from the repo root:
 *
 *   node scripts/generate-pet-home.mjs
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'packages/content/tuning/pet-home.json');

const levels = [
  { level: 0, xp: 0, tiles: 6, mergeCap: 8, unlockGems: 20, reward: {} },
  { level: 1, xp: 200, tiles: 6, mergeCap: 8, unlockGems: 20, reward: { gems: 20 } },
  { level: 2, xp: 550, tiles: 7, mergeCap: 8, unlockGems: 20, reward: { gems: 20 } },
  { level: 3, xp: 1000, tiles: 8, mergeCap: 8, unlockGems: 20, reward: { orbEssence: 50 } },
  { level: 4, xp: 2500, tiles: 10, mergeCap: 9, unlockGems: 20, reward: { orbEssence: 50 } },
  { level: 5, xp: 6000, tiles: 11, mergeCap: 9, unlockGems: 60, reward: { orbEssence: 100 } },
  { level: 6, xp: 10000, tiles: 11, mergeCap: 9, unlockGems: 60, reward: { orbEssence: 100 } },
  { level: 7, xp: 15000, tiles: 11, mergeCap: 10, unlockGems: 90, reward: { orbEssence: 150 } },
  { level: 8, xp: 22000, tiles: 12, mergeCap: 10, unlockGems: 90, reward: { orbEssence: 150 } },
  { level: 9, xp: 32000, tiles: 13, mergeCap: 10, unlockGems: 90, reward: { orbEssence: 200 } },
  { level: 10, xp: 45000, tiles: 14, mergeCap: 11, unlockGems: 120, reward: { orbEssence: 250 } },
  { level: 11, xp: 60000, tiles: 15, mergeCap: 11, unlockGems: 120, reward: { orbEssence: 250 } },
  { level: 12, xp: 80000, tiles: 16, mergeCap: 12, unlockGems: 120, reward: { orbEssence: 300 } },
  { level: 13, xp: 105000, tiles: 17, mergeCap: 13, unlockGems: 120, reward: { orbEssence: 300 } },
  { level: 14, xp: 135000, tiles: 19, mergeCap: 14, unlockGems: 120, reward: { orbEssence: 400 } },
  { level: 15, xp: 170000, tiles: 20, mergeCap: 15, unlockGems: 120, reward: { orbEssence: 400 } },
  { level: 16, xp: 220000, tiles: 21, mergeCap: 16, unlockGems: 120, reward: { orbEssence: 500 } },
];

const tiles = [
  [0, 2, 2, 0, false],
  [1, 1, 2, 0, false],
  [2, 2, 3, 0, false],
  [3, 1, 3, 0, false],
  [4, 2, 1, 0, false],
  [5, 1, 1, 0, false],
  [6, 1, 0, 2, true],
  [7, 2, 0, 3, true],
  [8, 0, 1, 4, false],
  [9, 0, 2, 4, false],
  [10, 0, 3, 5, true],
  [11, 1, 4, 8, true],
  [12, 2, 4, 9, true],
  [13, 3, 4, 10, true],
  [14, 4, 3, 11, true],
  [15, 4, 2, 12, true],
  [16, 4, 1, 13, true],
  [17, 3, 0, 14, true],
  [18, 3, 3, 14, true],
  [19, 3, 1, 15, true],
  [20, 3, 2, 16, true],
].map(([id, row, col, unlockLevel, locked]) => ({ id, row, col, unlockLevel, locked }));

// Doubling by merge level keeps a merge income-neutral: 2 x L = L + 1.
const income = Array.from({ length: 16 }, (_, index) => ({
  level: index + 1,
  coinsPerFiveSeconds: 3 * 2 ** index,
}));

const templates = [
  { key: 'orbEssence', label: 'Orb Essence', values: [10, 20, 40, 80, 160, 320, 640] },
  { key: 'starShard', label: 'Star Shard', values: [3, 6, 12, 24, 48, 96, 192] },
  { key: 'potentialShard', label: 'Potential Shard', values: [3, 6, 12, 24, 48, 96, 192] },
  { key: 'heldItemShard', label: 'Held Item Shard', values: [3, 6, 12, 24, 48, 96, 192] },
  { key: 'berryEssence', label: 'Berry Essence', values: [5, 10, 20, 40, 80, 160, 320] },
  { key: 'soulHeartExp', label: 'Soul-heart EXP', values: [10, 20, 40, 80, 160, 320, 640] },
  { key: 'resonationShard', label: 'Resonation Shard', values: [2, 4, 8, 16, 32, 64, 128] },
  { key: 'plateBottle', label: 'Plate Bottle', values: [1, 1, 2, 2, 3, 4, 5] },
  { key: 'plateFragment', label: 'Plate Fragment', values: [5, 10, 20, 40, 80, 160, 320] },
  { key: 'titleTicket', label: 'Title Ticket', values: [1, 1, 1, 2, 2, 3, 4] },
  { key: 'candy', label: 'Candy', values: [300, 600, 1200, 2400, 4800, 9600, 19200] },
  { key: 'gold', label: 'Gold', values: [1000, 2000, 4000, 8000, 16000, 32000, 64000] },
];

const tierNames = ['Satchel', 'Crate', 'Chest', 'Cache', 'Hoard', 'Vault', 'Trove'];
const homePrices = [8000, 45000, 180000, 600000, 1200000, 2400000, 4800000];
const deluxePrices = [300, 900, 2700, 8100];

function offer(shop, band, template, tier) {
  const value = template.values[tier];
  return {
    id: `${shop}-${band}-${template.key}-${tier}`,
    name: `${template.label} ${tierNames[tier]}`,
    description: `A ${tierNames[tier].toLowerCase()} of ${template.label.toLowerCase()} for the Home.`,
    price: shop === 'deluxe' ? deluxePrices[tier - 3] : homePrices[tier],
    grants: { [template.key]: value },
  };
}

const homeBands = [
  { minLevel: 0, offers: templates.map((template) => offer('home', 0, template, 0)) },
  { minLevel: 4, offers: templates.map((template) => offer('home', 4, template, 1)) },
  { minLevel: 6, offers: templates.map((template) => offer('home', 6, template, 2)) },
  {
    minLevel: 7,
    offers: [2, 3, 4].flatMap((tier) => templates.map((template) => offer('home', 7, template, tier))),
  },
  { minLevel: 8, offers: templates.map((template) => offer('home', 8, template, 4)) },
];

const deluxeOffers = [3, 4, 5, 6].flatMap((tier) =>
  templates.map((template) => offer('deluxe', 10, template, tier)),
);

const data = {
  albumNote: 'Every Wild you open is recorded here. The album is a record, not a power source.',
  home: {
    offlineHours: 8,
    tickSeconds: 300,
    freeSummonsPerDay: 50,
    summonCosts: [
      { afterPaid: 0, gems: 10 },
      { afterPaid: 50, gems: 30 },
      { afterPaid: 100, gems: 80 },
      { afterPaid: 200, gems: 250 },
      { afterPaid: 400, gems: 600 },
    ],
  },
  levels,
  tiles,
  income,
  shops: {
    home: {
      id: 'home',
      name: 'Home Exchange',
      currency: 'homeCoin',
      unlockLevel: 0,
      offersPerPage: 9,
      refresh: { maxPerDay: 30, costs: [{ afterRefreshes: 0, gems: 40 }, { afterRefreshes: 10, gems: 80 }] },
      bands: homeBands,
    },
    deluxe: {
      id: 'deluxe',
      name: 'Orb Atelier',
      currency: 'orbEssence',
      unlockLevel: 10,
      offersPerPage: 9,
      refresh: { maxPerDay: 30, costs: [{ afterRefreshes: 0, gems: 40 }, { afterRefreshes: 10, gems: 80 }] },
      bands: [{ minLevel: 10, offers: deluxeOffers }],
    },
  },
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(data, null, 2)}\n`);
console.log(`wrote ${out}`);
