/* eslint-disable no-undef */
/**
 * M13.4: write packages/content/tuning/rift.json (Rift Barriers) from the source's New Rift Arena
 * (`underground_new_*`, modepages-pvp_cfg 2026-10-03).
 *
 * From the source: the season window (`open_time` {2,7,0} → `end_time` {7,22,0}), 250 floors (Easy 1–100,
 * Advanced 101–250), a boss every 5th floor, 5 lives a day (`day_num`), the coin → gold ratio, each difficulty's
 * Easy floor rewards (Gold + XP Candies at floors 20 / 40 / 60 / 80 / 100), the Advanced drops (50 Time Coins,
 * 250 on boss floors) and the challenge-count chests. Stand-ins (docs/design/rift-arena.md): which resonance
 * reaches which difficulty, the synced level, the Easy drop amounts (the source shows only the item kinds),
 * the enemies.
 *
 *   node scripts/import-rift.mjs   (WILDBOUND_SOURCE as for the other importers)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, sourceRoot } from './source/source.mjs';

const pvp = JSON.parse(readFileSync(join(sourceRoot, '2026-10-03', 'modepages-pvp_cfg.json'), 'utf8'));
const basic = pvp.underground_new_basic_json;
const monster = pvp['_underground_new_monster_json (summary: per group/level)'];

const ITEM = { 1: 'gold', 27: 'candy', 10103: 'pokemonShard5', 20601: 'stone', 10006: 'ticketPremium', 93: 'timeCredit', 94: 'timeCoin' };
const leftOut = new Set();
function rewards(pairs) {
  const out = {};
  for (const [id, n] of pairs) {
    const key = ITEM[id];
    if (!key) {
      leftOut.add(id);
      continue;
    }
    out[key] = (out[key] ?? 0) + n;
  }
  return out;
}

const parseTime = (s) => s.replace(/[{}]/g, '').split(',').map(Number);
const [openDay, openHour] = parseTime(basic.open_time);
const [endDay, endHour] = parseTime(basic.end_time);

const sample = monster['101/1'];
const [, easyFloors] = sample.floor_type_1;
const drop = sample.drop_preview_by_floor;
const difficulties = [];
for (let d = 1; d <= 10; d += 1) {
  const row = monster[`101/${d}`];
  difficulties.push({
    difficulty: d,
    minResonance: d === 1 ? 0 : 50 + 50 * (d - 1),
    syncLevel: 100 + 25 * (d - 1),
    floorRewards: Object.entries(row.floor_reward).map(([floor, pairs]) => ({ floor: Number(floor), rewards: rewards(pairs) })),
  });
}

const chests = Object.values(pvp.underground_new_box_reward_json)
  .sort((a, b) => a.challenge_num - b.challenge_num)
  .map((r) => ({ challenges: r.challenge_num, rewards: rewards(r.reward) }))
  // A chest whose goods Wildbound lacks entirely (6 / 15 / 25: Lucky Coins + 4-star Evo Boxes) is left out.
  .filter((c) => Object.keys(c.rewards).length > 0);

const tuning = {
  floors: sample.floors,
  easyFloors,
  livesPerDay: basic.day_num,
  bossEvery: 5,
  season: { openDay, openHour, endDay, endHour },
  coinToGold: basic.ratio,
  difficulties,
  drops: {
    easy: { timeCredit: 1, timeCoin: 10, gold: 5000, candy: 1000 },
    easyBoss: { timeCredit: 3, timeCoin: 30 },
    advanced: rewards(drop.type2_normal),
    advancedBoss: rewards(drop.type2_every_5th),
  },
  chests,
  enemy: { factions: [], tiers: [], count: 6, baseLevel: 5, levelSlope: 1.014, starsEvery: 12, maxStars: 20, stageEvery: 25, maxStage: 3 },
  bossMult: 1.5,
  _leftOut: [...leftOut].sort((a, b) => a - b).map((id) => `item ${id} (4-star Evo Boxes, Lucky Coin: not in Wildbound)`),
};

writeFileSync(join(repoRoot, 'packages/content/tuning/rift.json'), `${JSON.stringify(tuning, null, 2)}\n`);
console.log(`rift.json: ${tuning.floors} floors, ${difficulties.length} difficulties, ${chests.length} chests; left out ${[...leftOut]}`);
