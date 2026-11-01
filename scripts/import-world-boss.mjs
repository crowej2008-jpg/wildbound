#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * R9: import the source's World Boss into the `worldBoss` block of packages/content/tuning/pve.json.
 *
 * Source (modes2_cfg): world_boss_basic_json (two windows a day, 12:00–13:00 and 18:00–19:00 UTC, 3 fights each;
 * one boss per weekday — open_week 1 Monday … 7 Sunday; boss names from the boss screens, kb/world-boss.md),
 * world_boss_score_json (the damage milestones, the same for every boss) and world_boss_rank_rewards_json (rank 1,
 * 2, 3, 4–10, 11–20). The score is the window's damage (kb). Keeps the block's stand-in boss enemy stats.
 *
 *   node scripts/import-world-boss.mjs   (WILDBOUND_SOURCE as for the other importers)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTable, repoRoot } from './source/source.mjs';

const ITEM = { 1: 'gold', 2: 'gems', 10103: 'pokemonShard5' };
const rewards = (list) => Object.fromEntries(list.map(([id, n]) => {
  if (!ITEM[id]) throw new Error(`unknown world-boss item ${id}`);
  return [ITEM[id], n];
}));
// open_week → our weekday (0 = Sunday) and the boss (kb: Mon Mega Zapdos … Sun Mega Mewtwo).
const BOSS = {
  1: [1, 'zapdos', 'Mega Zapdos'],
  2: [2, 'moltres', 'Mega Moltres'],
  3: [3, 'raikou', 'Mega Raikou'],
  4: [4, 'entei', 'Mega Entei'],
  5: [5, 'suicune', 'Mega Suicune'],
  6: [6, 'mew', 'Mega Mew'],
  7: [0, 'mewtwo', 'Mega Mewtwo'],
};

const basic = Object.values(loadTable('world_boss_basic_json'));
const windows = [...new Map(basic.map((r) => [r.open_time[0][0], { startHour: r.open_time[0][0], endHour: r.open_time[1][0] }])).values()].sort(
  (a, b) => a.startHour - b.startHour,
);
const fights = basic[0].fight_times;
if (basic.some((r) => r.fight_times !== fights)) throw new Error('fight_times vary');
const rotation = [...new Set(basic.map((r) => r.open_week))]
  .sort()
  .map((w) => ({ weekday: BOSS[w][0], speciesId: BOSS[w][1], name: BOSS[w][2] }))
  .sort((a, b) => a.weekday - b.weekday);
const score = loadTable('world_boss_score_json');
const milestones = Object.values(Object.values(score)[0])
  .sort((a, b) => a.score - b.score)
  .map((m) => ({ damage: m.score, rewards: rewards(m.reward) }));
const rankRewards = Object.values(loadTable('world_boss_rank_rewards_json'))
  .sort((a, b) => a.rank - b.rank)
  .map((r) => ({ upToRank: r.rank, rewards: rewards(r.reward) }));

const file = join(repoRoot, 'packages/content/tuning/pve.json');
const pve = JSON.parse(readFileSync(file, 'utf8'));
pve.worldBoss = {
  fightsPerWindow: fights,
  windows,
  // The ladder ranks against 19 ghosts so the source's 11–20 bracket can be reached.
  ghostCount: 19,
  historyCap: pve.worldBoss.historyCap,
  milestones,
  rankRewards,
  // Owner's changes (2026-11-01), kept across re-imports.
  dropPerFight: pve.worldBoss.dropPerFight,
  skipVip: 14, // fight_basic_json dtype 12 skip [[4, 14]]
  boss: pve.worldBoss.boss,
  enemy: pve.worldBoss.enemy,
  rotation,
};
writeFileSync(file, JSON.stringify(pve, null, 2) + '\n');
console.log(`world boss: ${windows.length} windows × ${fights}, ${milestones.length} milestones, ${rankRewards.length} rank rows`);
