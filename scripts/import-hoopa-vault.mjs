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
const bands = Object.values(solo.hupa_treasury_difficulty_json)
  .sort((a, b) => a.dun_id - b.dun_id)
  .map((r) => ({ floor: r.dun_id, dropPool: r.drop_pool, note: text[r.drop_desc] ?? r.drop_desc }));

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
  guardianPay: { resetterShard: { min: 1, max: 4 }, heldItemShard: 10 },
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
