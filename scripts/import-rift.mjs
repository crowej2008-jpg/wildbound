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
const solo = JSON.parse(readFileSync(join(sourceRoot, '2026-10-03', 'modepages-solo_cfg.json'), 'utf8'));
const items = JSON.parse(readFileSync(join(sourceRoot, '2026-10-03', 'items_cfg.json'), 'utf8'));
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

// The source's six Mystic Merchant orb-box rows (Diamonds, from floor 41). The boxes hold Lv.3 orbs of quality
// 3 / 4 / 5 — Wildbound's blue / purple / orange (the source labels them P / O / Red; see ASSUMPTIONS #98).
const QUALITY = { 2: 'green', 3: 'blue', 4: 'purple', 5: 'orange', 6: 'red' };
const sourceRows = Object.values(solo['underground_new_shop_json (the orb boxes, rows 249–254)']).map((r) => {
  const box = items.item_eqm_compound_json[r.item[0][0]];
  const [orbItem, [lo]] = box.item_list[0];
  const colour = QUALITY[orbItem % 10];
  const [lowest] = r.floor_section.replace(/[{}]/g, '').split(',').map(Number);
  return {
    id: `orb-box-${r.good_index}`,
    name: `Lv.${lo} ${colour[0].toUpperCase()}${colour.slice(1)} Orb Box`,
    unlockFloor: lowest,
    price: { currency: 'gems', amount: r.price[0][1] },
    grants: {},
    orbs: { colour, level: lo, count: 1 },
    limit: r.buy_times,
  };
});

// Owner 2026-11-04 (wiki/decisions/rift-purpose.md): scarce goods for Time Coins and milestones up the
// Advanced track. Agent's numbers; a full Advanced season pays about 13,500 Time Coins.
const coinRows = [
  { id: 'resetter-20', name: 'Resetter Shards ×20', unlockFloor: 20, price: { currency: 'timeCoin', amount: 600 }, grants: { resetterShard: 20 }, limit: 5 },
  { id: 'potential-500', name: 'Potential Shards ×500', unlockFloor: 40, price: { currency: 'timeCoin', amount: 400 }, grants: { potentialShard: 500 }, limit: 10 },
  { id: 'held-200', name: 'Held Item Shards ×200', unlockFloor: 60, price: { currency: 'timeCoin', amount: 300 }, grants: { heldItemShard: 200 }, limit: 10 },
  { id: 'premium-1', name: 'Premium Ticket', unlockFloor: 100, price: { currency: 'timeCoin', amount: 500 }, grants: { ticketPremium: 1 }, limit: 10 },
  { id: 'mythic-held', name: 'Random Mythic Held Item', unlockFloor: 150, price: { currency: 'timeCoin', amount: 6000 }, grants: {}, mythicHeld: 1, limit: 1 },
];
const milestones = [
  { floor: 125, rewards: { ticketPremium: 5 } },
  { floor: 150, rewards: { resetterShard: 40 } },
  { floor: 175, rewards: { gems: 300 } },
  { floor: 200, rewards: {}, orbs: { colour: 'red', level: 3, count: 1 } },
  { floor: 225, rewards: { resetterShard: 80 } },
  { floor: 250, rewards: {}, mythicHeld: 1 },
];

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
  milestones,
  merchant: [...coinRows, ...sourceRows],
  _leftOut: [...leftOut].sort((a, b) => a - b).map((id) => `item ${id} (4-star Evo Boxes, Lucky Coin: not in Wildbound)`),
};

writeFileSync(join(repoRoot, 'packages/content/tuning/rift.json'), `${JSON.stringify(tuning, null, 2)}\n`);
console.log(`rift.json: ${tuning.floors} floors, ${difficulties.length} difficulties, ${chests.length} chests; left out ${[...leftOut]}`);
