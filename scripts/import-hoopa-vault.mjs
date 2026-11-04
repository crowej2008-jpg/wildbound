/* eslint-disable no-undef */
/**
 * M13.3: write packages/content/tuning/hoopa-vault.json.
 *
 * From the source: the 40 floor bands of `hupa_treasury_difficulty_json` (each band's drop pool and the English
 * text of what starts dropping there). From the agreed plan (wiki/systems/hoopa-vault.md) and the owner's wiki:
 * 300 floors, 5 free keys a day, ×3 past floor 31 and ×5 past 71, escape 10 → 40, two route cards, a 15-round
 * Exit Guardian. Stand-ins (labelled in docs/design/hoopa-vault.md): enemies, card numbers and the pay.
 *
 *   node scripts/import-hoopa-vault.mjs   (WILDBOUND_SOURCE as for the other importers)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, sourceRoot } from './source/source.mjs';

const solo = JSON.parse(readFileSync(join(sourceRoot, '2026-10-03', 'modepages-solo_cfg.json'), 'utf8'));
const text = solo._text ?? {};
const rows = Object.values(solo.hupa_treasury_difficulty_json).sort((a, b) => a.dun_id - b.dun_id);

// Each note either starts a quality / an orb tier or raises a quality's odds (the source's own wording).
// The weights are stand-ins: a newly started quality begins at 30 % of the draw and gains 10 points with each
// later band that names it, up to 70 %; the quality before it takes the rest; older ones stop dropping.
const QUALITIES = ['rare', 'epic', 'legendary', 'supreme', 'mythic'];
const WORD = { Rare: 'rare', Epic: 'epic', Legendary: 'legendary', Supreme: 'supreme', Mythical: 'mythic' };
const ORB = { Purple: 'purple', Orange: 'orange', Red: 'red' };
let started = [];
const share = {};
let orb = null;
const bands = rows.map((r) => {
  const note = text[r.drop_desc] ?? r.drop_desc;
  const start = note.match(/^Start dropping (\w+) quality held items/);
  const orbStart = note.match(/^Start dropping Level (\d) (\w+) Orb/);
  if (start) {
    const q = WORD[start[1]];
    started.push(q);
    share[q] = started.length === 1 ? 100 : 30;
  } else if (orbStart) {
    orb = { colour: ORB[orbStart[2]], level: Number(orbStart[1]) };
  }
  for (const [word, q] of Object.entries(WORD)) {
    if (!start && note.includes(word) && /increased/.test(note) && q === started.at(-1)) share[q] = Math.min(70, share[q] + 10);
  }
  const newest = started.at(-1);
  const prev = started.at(-2);
  const qualities = prev ? { [prev]: 100 - share[newest], [newest]: share[newest] } : { [newest]: 100 };
  return { floor: r.dun_id, dropPool: r.drop_pool, note, qualities, orb: orb ? { ...orb } : null };
});
void QUALITIES;

const tuning = {
  floors: 300,
  freeKeysPerDay: 5,
  multipliers: [
    { afterFloor: 0, max: 1 },
    { afterFloor: 31, max: 3 },
    { afterFloor: 71, max: 5 },
  ],
  run: {
    startEscape: 10,
    target: 40,
    offerSize: 2,
    cards: {
      strong: { escape: 10, enemyMult: 1.5, attackBoost: 0, dropBoost: 0, weight: 3 },
      normal: { escape: 5, enemyMult: 1, attackBoost: 0, dropBoost: 0, weight: 4 },
      buff: { escape: 5, enemyMult: 1, attackBoost: 0.1, dropBoost: 0, weight: 2 },
      blessing: { escape: 5, enemyMult: 1, attackBoost: 0, dropBoost: 0.25, weight: 2 },
    },
  },
  guardian: { rounds: 15, mult: { hp: 3, atk: 1.5, def: 1.5 } },
  enemy: {
    factions: [],
    tiers: [],
    count: 6,
    baseLevel: 3,
    levelSlope: 1.016,
    starsEvery: 15,
    maxStars: 20,
    stageEvery: 30,
    maxStage: 3,
  },
  stagePay: {
    heldItemShard: { base: 2, perFloor: 0.1 },
    resetterShard: { chance: 0.35, min: 1, max: 3 },
  },
  guardianPay: { resetterShard: { min: 1, max: 4 }, heldItemShard: 10, items: 3 },
  routeDrops: { itemChance: 0.3, orbChance: 0.2 },
  resetterFactor: [
    { floor: 1, factor: 1 },
    { floor: 101, factor: 1.5 },
    { floor: 151, factor: 2 },
    { floor: 201, factor: 2.5 },
    { floor: 251, factor: 3.5 },
  ],
  bands,
};

writeFileSync(join(repoRoot, 'packages/content/tuning/hoopa-vault.json'), `${JSON.stringify(tuning, null, 2)}\n`);
console.log(`hoopa-vault.json: ${tuning.floors} floors, ${bands.length} source bands`);
