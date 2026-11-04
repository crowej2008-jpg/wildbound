#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * R9: copy the source's Arena tables into the `arena` block of packages/content/tuning/pvp.json.
 *
 * Source (evening_cfg): arena_basic_json (5 free fights a day), arena_price_json (Diamonds for each bought fight, 1st
 * to 25th), arena_session_reward_json (the day's chests by fights fought, 1–10) and arena_ach_reward_json (best-rank
 * achievements, 13 brackets from 1–10 to 2,001–5,000; paid once on reaching the bracket's worst rank). Kept as they
 * are: the credit ladder, the weekly bands and the opponents (the source's score / rank tables for those are not in
 * the dumps). Not copied: arena_score_reward_json (its item 16001 is unnamed in the dumps) and the lucky-rank raffle.
 *
 *   node scripts/import-arena.mjs   (WILDBOUND_SOURCE as for the other importers)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTable, repoRoot } from './source/source.mjs';

const ITEM = { 1: 'gold', 2: 'gems', 10102: 'pokemonShard3', 10103: 'pokemonShard5' };
const rewards = (list) =>
  Object.fromEntries(
    list.map(([id, n]) => {
      if (!ITEM[id]) throw new Error(`unknown arena item ${id}`);
      return [ITEM[id], n];
    }),
  );

const basic = loadTable('arena_basic_json');
const prices = Object.values(loadTable('arena_price_json')).sort((a, b) => a.times - b.times).map((r) => r.money);
const chests = Object.values(loadTable('arena_session_reward_json'))
  .sort((a, b) => a.sessions - b.sessions)
  .map((r) => ({ battles: r.sessions, reward: rewards(r.rewards) }));
const ach = Object.values(loadTable('arena_ach_reward_json'))
  .sort((a, b) => a.index - b.index)
  .map((r) => ({ place: r.max, reward: rewards(r.rewards) }));

const file = join(repoRoot, 'packages/content/tuning/pvp.json');
const pvp = JSON.parse(readFileSync(file, 'utf8'));
pvp.arena.freeAttemptsPerDay = basic.arena_free_num.value;
pvp.arena.attemptPrices = prices;
pvp.arena.chestTiers = chests;
pvp.arena.bestRankTiers = ach;
writeFileSync(file, JSON.stringify(pvp, null, 2) + '\n');
console.log(`arena: ${prices.length} prices, ${chests.length} chests, ${ach.length} achievements`);
