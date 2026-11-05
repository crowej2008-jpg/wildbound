/* eslint-disable no-undef */
/**
 * Pokémon Park (source cross_beast_park_*; help text beast_park / beast_park_boss) → packages/content/tuning/park.json.
 * Map: modes3_cfg cross_beast_park_map_grid_json (19 grids, quality 1–3, neighbours, collapse phases).
 * Items: 10012 Berry Essence, 10017 Reforge Potion, 10006 Premium tickets, 10103 5★ shards. Berry boxes have no
 * Wildbound item: 10127 Greater Berry Box and 10165 Opt Greater Berry → Greater seeds, 10153 Berry Mulch Box → purple
 * mulch, 10703 fruit gift box → Intermediate seeds (stand-ins).
 *
 *   node scripts/import-park.mjs   (WILDBOUND_SOURCE as for the other importers)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, sourceRoot } from './source/source.mjs';

const g = JSON.parse(readFileSync(join(sourceRoot, '2026-10-03', 'modepages-guild_cfg.json'), 'utf8'));
const m3 = JSON.parse(readFileSync(join(sourceRoot, '2026-10-02', 'modes3_cfg.json'), 'utf8'));
const rows = (o) => Object.values(o);
const ITEM = { 10012: ['berryEssence', 1], 10017: ['reforgePotion', 1], 10006: ['ticketPremium', 1], 10103: ['pokemonShard5', 1], 10127: ['seedGreater', 1], 10165: ['seedGreater', 2], 10153: ['berryMulchPurple', 1], 10703: ['seedIntermediate', 1] };
function rewards(list) {
  const out = {};
  for (const [id, n] of list ?? []) {
    const m = ITEM[id];
    if (m) out[m[0]] = (out[m[0]] ?? 0) + n * m[1];
  }
  return out;
}
const b = g.cross_beast_park_basic_json;
const park = {
  hours: b.day_time,
  stamina: { perDay: b.day_power, move: b.move_power, explore: b.explore_power, skip: b.skip_power },
  explore: { wildWeight: b.wild_elf_weight, eggWeight: b.elf_egg_weight },
  eggs: { bag: b.elf_egg_bag_size, perRefresh: b.elf_egg_num, refreshHours: b.elf_egg_time.map(([h]) => h), hatchMinutes: 30, rewards: { pokemonShard5: 2, berryEssence: 50 }, points: 20 },
  collapseHours: b.collapse_time.map(([h]) => h),
  boss: { windows: b.beast_appear_time, minutes: b.beast_persist_time / 60, rounds: 10, battleScore: b.beast_battle_score, joinReward: rewards(b.beast_join_reward), hp: 60_000_000, cpuDamagePerMinute: 4_000_000 },
  score: { wildWin: 30, wildLoss: 5 },
  map: rows(m3.cross_beast_park_map_grid_json)
    .map((r) => ({ index: r.index, name: r.name, quality: r.qua, neighbours: r.neighbor_grid_list, collapse: r.fall_idx ?? [] }))
    .sort((x, y) => x.index - y.index),
  attackRewards: rows(g.cross_beast_park_beast_attack_reward_json)
    .map((r) => ({ count: r.count, score: r.score, rewards: rewards(r.reward) }))
    .sort((x, y) => x.count - y.count),
  bossRank: rows(g.cross_beast_park_beast_fight_score_reward_json)
    .map((r) => ({ rank: r.rank, rewards: rewards(r.reward) }))
    .sort((x, y) => x.rank - y.rank),
  guildRank: rows(g.cross_beast_park_beast_guild_rank_reward_json)
    .map((r) => ({ rank: r.rank, rewards: rewards(r.reward) }))
    .sort((x, y) => x.rank - y.rank),
  scoreRewards: rows(g.cross_beast_park_beast_rank_reward_json)
    .map((r) => ({ rank: r.rank, score: r.score, rewards: rewards(r.reward) }))
    .sort((x, y) => x.rank - y.rank),
  personalRank: rows(g.cross_beast_park_personal_score_reward_json)
    .map((r) => ({ rank: r.rank, rewards: rewards(r.reward) }))
    .sort((x, y) => x.rank - y.rank),
  cpuTopScore: 2400,
};
writeFileSync(join(repoRoot, 'packages/content/tuning/park.json'), `${JSON.stringify(park, null, 2)}\n`);
console.log('park.json', park.map.length, 'grids');
