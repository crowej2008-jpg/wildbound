/* eslint-disable no-undef */
/**
 * M17: write packages/content/tuning/guild-war-relic.json.
 *
 * Guild War (modepages-guild_cfg cross_guild_boss_*): attempts from daily activity (30 / 60 / 100), battle / kill
 * rewards (Guild Chests), daily personal rank in the guild, season personal and guild ranks. 5 bosses × 5 rounds × 15
 * difficulties, then the endless stage (help text). Items: 16 Guild Tokens, 2 Gems, 10006 Premium tickets, 10103
 * 5★ Pokémon Shards, 10055 Golden Egg Vouchers; 10297 Guild Chest → 50 Guild Tokens (stand-in); 81001 / 81002 are
 * the title cards of Ultimate Guild / Power of Unity; 32411 / 32412 (Expert / Monster Hunter) have no data in the dumps.
 *
 * Relic Battlefield (evening_cfg cross_ancient_battle_*): map 1 (91 grids, neighbours, tiers, score per 30 min, open
 * day), grid garrisons, stamina, explore events, personal and guild tasks. Relic items 26001–26004 / 72011 have no
 * Wildbound item: they pay Relic Coins (new currency; 72011 counts 10).
 *
 *   node scripts/import-guild-war-relic.mjs   (WILDBOUND_SOURCE as for the other importers)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, sourceRoot } from './source/source.mjs';

const g = JSON.parse(readFileSync(join(sourceRoot, '2026-10-03', 'modepages-guild_cfg.json'), 'utf8'));
const e = JSON.parse(readFileSync(join(sourceRoot, '2026-10-02', 'evening_cfg.json'), 'utf8'));
const rows = (o) => Object.values(o);

const ITEM = { 1: ['gold', 1], 2: ['gems', 1], 16: ['guildCoin', 1], 10006: ['ticketPremium', 1], 10103: ['pokemonShard5', 1], 10055: ['goldenEggVoucher', 1], 10297: ['guildCoin', 50], 26001: ['relicCoin', 1], 26002: ['relicCoin', 1], 26003: ['relicCoin', 1], 26004: ['relicCoin', 1], 72011: ['relicCoin', 10] };
function rewards(list) {
  const out = {};
  for (const [id, n] of list ?? []) {
    const m = ITEM[id];
    if (m) out[m[0]] = (out[m[0]] ?? 0) + n * m[1];
  }
  return out;
}
// 81001 / 81002 are the cards of titles 16 (Ultimate Guild) and 17 (Power of Unity) in titles.json.
const TITLE_CARD = { 81001: '16', 81002: '17' };
const rankRows = (table) =>
  rows(table[Object.keys(table).sort((a, b) => a - b)[0]])
    .map((r) => {
      const card = (r.reward ?? []).find(([id]) => TITLE_CARD[id]);
      return { rank: r.rank, rewards: rewards(r.reward), ...(card ? { titleCard: TITLE_CARD[card[0]] } : {}) };
    })
    .sort((a, b) => a.rank - b.rank);

const gb = g.cross_guild_boss_basic_json;
const guildWar = {
  activity: gb.daily_score,
  battle: rewards(gb.battle_reward),
  kill: rewards(gb.kill_reward),
  bosses: 5,
  rounds: 5,
  difficulties: 15,
  dailyRank: rankRows(g.cross_guild_boss_per_daily_rank_json),
  seasonRank: rankRows(g.cross_guild_boss_per_season_rank_json),
  guildRank: rankRows(g.cross_guild_boss_guild_season_rank_json),
  // Stand-ins (solo): boss round HP and the CPU members' daily damage.
  roundHp: { base: 2_000_000, growth: 1.6 },
  cpuDamagePerDay: 12_000_000,
  cpuGuilds: 30,
};

const ab = e.cross_ancient_battle_basic_json;
const map = rows(e.cross_ancient_battle_grid_json['1'])
  .map((r) => ({ index: r.index, type: r.type, score: r.grip_score[0][1], neighbours: r.neighbor_grid_list, openDay: r.open_day }))
  .sort((a, b) => a.index - b.index);
const garrison = Object.fromEntries(rows(e.cross_ancient_battle_grid_type_json).map((r) => [r.type, { monsters: r.mon_num, bosses: r.boss_num }]));
const relic = {
  stamina: { max: ab.physical, regenMinutes: ab.recovery_physical[0][0], attack: ab.atk_physical, explore: ab.explore_phy_cost },
  exploreCooldownSec: ab.explore_cd,
  maxHeld: ab.occupy_num,
  guardTeams: ab.guard_num,
  score: { win: ab.battle_win_score, loss: ab.battle_fail_score },
  garrison,
  map,
  events: rows(e.cross_ancient_battle_battle_event_json)
    .filter((r) => (r.new_weight ?? 0) > 0)
    .map((r) => ({ id: r.index, type: r.type, value: r.value, weight: r.new_weight }))
    .sort((a, b) => a.id - b.id),
  tasks: rows(e.cross_ancient_battle_task_json)
    .map((r) => ({ id: r.id, scope: r.type === 1 ? 'personal' : 'guild', event: r.event_type, target: r.event_val, rewards: rewards(r.reward) }))
    .sort((a, b) => a.id - b.id),
  placeRewards: [
    { place: 1, rewards: { relicCoin: 3000, gems: 500 } },
    { place: 2, rewards: { relicCoin: 2000, gems: 300 } },
    { place: 3, rewards: { relicCoin: 1500, gems: 200 } },
    { place: 4, rewards: { relicCoin: 1000, gems: 100 } },
  ],
};

writeFileSync(join(repoRoot, 'packages/content/tuning/guild-war-relic.json'), `${JSON.stringify({ guildWar, relic }, null, 2)}\n`);
console.log('guild-war-relic.json', map.length, 'grids', relic.events.length, 'events', relic.tasks.length, 'tasks');
