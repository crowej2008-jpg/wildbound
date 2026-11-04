#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * R9: copy the source's Ranked (League) tables into the `ranked` block of packages/content/tuning/pvp.json.
 *
 * Source (modes3_cfg): level_ladder_basic_json (6 free matches, +35 / −20 score), level_ladder_buy_time_json (the
 * Diamond price of each bought match), level_ladder_duan_json (each phase's 12 tiers: score and Ladder Coins) and
 * level_ladder_duan_box_json (each phase's match-count gifts: Plate Bottles, Plate Fragments, Berry Essence and, at 25
 * and 40, a Greater Berry Box — left out, Wildbound has no berry boxes). Kept as they are: the phase names, team
 * formats and weather factions (the source's lineup types and weather ids are not readable in the dumps).
 *
 *   node scripts/import-ranked.mjs   (WILDBOUND_SOURCE as for the other importers)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTable, repoRoot } from './source/source.mjs';

const ITEM = { 20901: 'plateBottle', 21001: 'plateFragment', 10012: 'berryEssence' };
const LEFT_OUT = new Set([10127]);
const rewards = (list) => {
  const out = {};
  for (const [id, n] of list) {
    if (LEFT_OUT.has(id)) continue;
    if (!ITEM[id]) throw new Error(`unknown ranked item ${id}`);
    out[ITEM[id]] = n;
  }
  return out;
};

const basic = loadTable('level_ladder_basic_json');
const prices = Object.values(loadTable('level_ladder_buy_time_json'))
  .sort((a, b) => a.challenge_num - b.challenge_num)
  .map((r) => r.cost[0][1]);
const duan = loadTable('level_ladder_duan_json');
const boxes = loadTable('level_ladder_duan_box_json');

const file = join(repoRoot, 'packages/content/tuning/pvp.json');
const pvp = JSON.parse(readFileSync(file, 'utf8'));
const r = pvp.ranked;
r.freeAttemptsPerDay = basic.free_num;
r.winScore = basic.win_score;
r.lossScore = basic.fail_score;
r.attemptPrices = prices;
r.phases = r.phases.map((phase, i) => {
  const rows = Object.values(duan[String(i + 1)]).sort((a, b) => a.dan - b.dan);
  if (rows.map((x) => x.score).join() !== r.tiers.map((t) => t.score).join()) throw new Error(`phase ${i + 1} tier scores differ`);
  const gifts = Object.values(boxes[String(i + 1)]).sort((a, b) => a.challenge_num - b.challenge_num);
  if (gifts.map((g) => g.challenge_num).join() !== r.giftTrack.map((g) => g.matches).join()) throw new Error('gift steps differ');
  return { ...phase, coins: rows.map((x) => x.reward?.[0]?.[1] ?? 0), gifts: gifts.map((g) => rewards(g.reward)) };
});
r.giftTrack = r.giftTrack.map((g, i) => ({ matches: g.matches, reward: r.phases[0].gifts[i] }));
writeFileSync(file, JSON.stringify(pvp, null, 2) + '\n');
console.log(`ranked: ${prices.length} prices, ${r.phases.length} phases with coins and gifts`);
