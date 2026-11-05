/* eslint-disable no-undef */
/**
 * M18.3: write packages/content/tuning/championship.json.
 *
 * World Championship (modepages-pvp_cfg world_tournament_*): 9 leagues (share_lev gates), 3 PvE tiers of floors per
 * league (stage 1 Poké Ball, 2 Great Ball, 3 Ultra Ball; floor enemy level and reward), the Master Ball knockout times,
 * rank rewards per league. Items: 1 Gold, 21300 Treasure Liquid, 21301 refine stones, 21602 treasure accessories,
 * 10055 Golden Egg Vouchers; 10063 Tournament Credits → Arena Tokens (stand-in); frames, bubbles and coupons are cosmetic
 * / paid and left out. The raffle (item 96, bought with Gems) is not built.
 *
 * League Championship (owner's wiki "pvp-champ"): placement rewards in Rank Tokens → Arena Tokens (stand-in).
 *
 *   node scripts/import-championship.mjs   (WILDBOUND_SOURCE as for the other importers)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, sourceRoot } from './source/source.mjs';

const d = JSON.parse(readFileSync(join(sourceRoot, '2026-10-03', 'modepages-pvp_cfg.json'), 'utf8'));
const rows = (o) => Object.values(o);
const ITEM = { 1: 'gold', 21300: 'treasureLiquid', 21301: 'treasureRefine', 21602: 'treasureAccessory', 10055: 'goldenEggVoucher', 10063: 'arenaToken' };
const rewards = (list) => {
  const out = {};
  for (const [id, n] of list ?? []) if (ITEM[id]) out[ITEM[id]] = (out[ITEM[id]] ?? 0) + n;
  return out;
};

const leagues = rows(d.world_tournament_group_json)
  .map((g) => ({ group: g.group_id, minLevel: g.share_lev === 9999 ? 700 : g.share_lev }))
  .sort((a, b) => a.group - b.group);
const floors = {};
for (const r of rows(d.world_tournament_challenge_json)) {
  const key = `${r.difficulty}:${r.stage_id}`;
  (floors[key] ??= []).push({ floor: r.floor, level: r.show_lev, rewards: rewards(r.reward) });
}
for (const k of Object.keys(floors)) floors[k].sort((a, b) => a.floor - b.floor);
const rank = {};
for (const table of rows(d.world_tournament_rank_reward_json)) {
  for (const r of rows(table)) (rank[r.group_id] ??= []).push({ min: r.min_rank, max: r.max_rank, rewards: rewards(r.reward) });
}
for (const k of Object.keys(rank)) rank[k].sort((a, b) => a.min - b.min);

const championship = {
  world: {
    anchorMonday: '2026-11-02',
    tiers: [
      { stage: 1, name: 'Poké Ball', opens: [2, 8] },
      { stage: 2, name: 'Great Ball', opens: [3, 8] },
      { stage: 3, name: 'Ultra Ball', opens: [5, 8] },
    ],
    lock: [7, 14],
    knockout: [
      [7, 14, 30],
      [7, 16, 30],
      [7, 18, 30],
    ],
    settle: [7, 22],
    leagues,
    floors,
    rank,
    cpuShare: 0.8,
    field: 60,
  },
  league: {
    days: { 4: { kind: 'r64', battles: 5, losses: 3 }, 5: { kind: 'groups', battles: 7, need: 5 }, 6: { kind: 'ko', rounds: ['Top 16', 'Quarterfinal'] }, 7: { kind: 'ko', rounds: ['Semifinal', 'Final'] } },
    resolveHour: 20,
    placements: [
      { place: 1, rewards: { arenaToken: 44000 } },
      { place: 2, rewards: { arenaToken: 22000 } },
      { place: 4, rewards: { arenaToken: 15000 } },
      { place: 8, rewards: { arenaToken: 10000 } },
    ],
    serverDay: 14,
    cpu: { base: 1.0, perStage: 0.08 },
  },
};
writeFileSync(join(repoRoot, 'packages/content/tuning/championship.json'), `${JSON.stringify(championship, null, 1)}\n`);
console.log('championship.json', leagues.length, 'leagues', Object.keys(floors).length, 'floor sets');
