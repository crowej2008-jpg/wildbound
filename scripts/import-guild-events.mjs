/* eslint-disable no-undef */
/**
 * M16: write packages/content/tuning/guild-events.json.
 *
 * Guild (modepages-guild_cfg guild_*): donations, guild levels, red packets, the guild beast and its foods.
 * Guild beast attribute ids: 1501 / 1502 / 1504 flat HP / P.ATK / S.ATK, 1506 / 1507 / 1509 HP / P.ATK / S.ATK %
 * (hundredths of a percent). Item 16 = Guild Token (guildCoin), 21801 / 21802 = beast foods.
 *
 * Events: no event tables are in the dumps. The Shovel Carnival numbers come from the owner's wiki
 * (pokemon-wiki-sandy.vercel.app/events/shovel-carnival, read 2026-11-05). Prizes are mapped onto Wildbound
 * currencies; where no currency exists a stand-in is named in `note`. The Merge Event is a stand-in schedule with the
 * wiki's four phases (Berry, Orb, Soul Heart, Treasure).
 *
 *   node scripts/import-guild-events.mjs   (WILDBOUND_SOURCE as for the other importers)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, sourceRoot } from './source/source.mjs';

const g = JSON.parse(readFileSync(join(sourceRoot, '2026-10-03', 'modepages-guild_cfg.json'), 'utf8'));
const rows = (o) => Object.values(o);
const b = g.guild_basic_json;
const FLAT = { 1501: 'hp', 1502: 'pAtk', 1504: 'sAtk' };
const PCT = { 1506: 'hpPct', 1507: 'pAtkPct', 1509: 'sAtkPct' };
const lines = (attr) =>
  (attr ?? []).flatMap(([id, v]) => (FLAT[id] ? [{ kind: 'core', field: FLAT[id], value: v }] : PCT[id] ? [{ kind: 'percent', field: PCT[id], value: v / 10000 }] : [])).filter((l) => l.value);

const guild = {
  donateTimes: b.donate_times,
  donations: {
    normal: { costGold: b.normal_cost[0][1], guildCoin: b.normal_reward[0][1], exp: b.normal_guild_exp, fund: b.normal_guild_capital },
    gems: { costGems: b.gold_cost[0][1], guildCoin: b.gold_reward[0][1], exp: b.gold_guild_exp, fund: b.gold_guild_capital },
  },
  levels: rows(g.guild_level_json)
    .map((r) => ({ level: r.lev, exp: r.exp, members: r.mem_num }))
    .sort((x, y) => x.level - y.level),
  redPackets: rows(g.guild_red_packet_json)
    .map((r) => ({ id: r.index, trainerLevel: r.value, gems: r.red_bag_gold, shares: r.red_bag_num }))
    .sort((x, y) => x.id - y.id),
  beast: {
    levels: rows(g.guild_beast_level_json)
      .map((r) => ({ level: r.lev, star: r.star, exp: r.exp ?? 0, lines: lines(r.attr) }))
      .sort((x, y) => x.level - y.level),
    foods: rows(g.guild_beast_item_json).map((r) => ({ itemId: r.item_id, currency: r.item_id === 21801 ? 'beastFood' : 'beastFoodPlus', exp: r.exp, guildCoin: r.reward[0][1] })),
  },
  // Stand-ins (solo): CPU members and their daily guild exp.
  cpuMembers: 24,
  cpuExpPerMemberDay: 10,
};

const shovel = {
  cycleDays: 14,
  lengthDays: 4,
  firstServerDay: 8,
  creditsPerShovel: 10,
  pool: { start: 16000, perDraw: 20 },
  // Odds of the four pool segments (percent). The other twelve share the rest equally (stand-in: the wiki lists no split).
  wheel: [
    { id: 'pool20', poolPct: 20, odds: 0.05 },
    { id: 'pool10', poolPct: 10, odds: 0.1 },
    { id: 'pool8', poolPct: 8, odds: 1 },
    { id: 'pool5', poolPct: 5, odds: 2 },
    { id: 'gold20k', rewards: { gold: 20000 } },
    { id: 'gold30k', rewards: { gold: 30000 } },
    { id: 'gold50k', rewards: { gold: 50000 } },
    { id: 'shard5', rewards: { pokemonShard5: 15 } },
    { id: 'pieces', rewards: { treasurePiece: 100 } },
    { id: 'stone', rewards: { stone: 50 } },
    { id: 'reforge', rewards: { reforgePotion: 45 } },
    { id: 'cosmetic', rewards: { cosmeticBox: 25 } },
    { id: 'soulHeart', rewards: { soulHeartExp: 800 }, note: 'Red Soul Heart Chest ×1 → Soul Heart EXP stand-in' },
    { id: 'berry', rewards: { berryEssence: 220 } },
    { id: 'tickets', rewards: { ticketCommon: 2 }, note: 'C.Gacha Voucher ×2 → Common tickets' },
    { id: 'supreme', odds: 0.5, rewards: { boxSupreme: 1 }, note: 'Supreme Gift (0.5 % in the odds, not on the wheel)' },
  ],
  milestones: [
    [200, 200, 0, null],
    [500, 400, 0, null],
    [800, 500, 0, null],
    [1500, 0, 0, 'boxSupreme'],
    [3000, 0, 50, 'orb'],
    [4500, 0, 50, 'orb'],
    [6000, 0, 100, 'orb'],
    [7500, 0, 100, 'orb'],
    [9000, 800, 100, 'orb'],
    [10500, 1000, 100, 'orb'],
    [12000, 1200, 150, 'boxLD'],
    [13500, 1200, 150, 'orb'],
    [15000, 0, 300, 'boxLD'],
    [16500, 0, 300, 'orb'],
    [18250, 0, 300, 'boxLD'],
    [20000, 0, 300, 'boxShinySupreme'],
    [21750, 0, 300, 'boxShinySupreme'],
    [23500, 0, 300, 'boxShinySupreme'],
  ].map(([credits, pieces, fashion, box]) => {
    const rewards = {};
    if (pieces) rewards.treasurePiece = pieces;
    if (fashion) rewards.fashionShard = fashion;
    if (box === 'orb') rewards.orbEssence = 2000;
    else if (box) rewards[box] = 1;
    return { credits, rewards };
  }),
  shop: [
    { price: 40, perDay: 5 },
    { price: 80, perDay: 10 },
    { price: 120, perDay: 35 },
    { price: 160, perDay: 50 },
    { price: 200, perDay: 50 },
  ],
  exchange: [
    { id: 1, name: 'Treasure Liquid ×100', price: 10, limit: 0, rewards: { treasureLiquid: 100 } },
    { id: 2, name: 'Gold ×50,000', price: 15, limit: 200, rewards: { gold: 50000 } },
    { id: 3, name: 'Treasure Refine Stone ×3', price: 25, limit: 0, rewards: { treasureRefine: 3 } },
    { id: 4, name: 'Ascension Stone ×50', price: 30, limit: 125, rewards: { stone: 50 } },
    { id: 5, name: 'Premium ticket ×1', price: 135, limit: 0, rewards: { ticketPremium: 1 } },
    { id: 6, name: 'Treasure Accessory ×1', price: 220, limit: 8, rewards: { treasureAccessory: 1 } },
    { id: 7, name: 'Golden Egg Voucher ×1', price: 400, limit: 0, rewards: { goldenEggVoucher: 1 } },
    { id: 8, name: 'Awakening Stone ×1', price: 550, limit: 10, rewards: { treasureAwakenStone: 1 } },
    { id: 9, name: 'Soul Heart EXP ×5000', price: 840, limit: 0, rewards: { soulHeartExp: 5000 } },
    { id: 10, name: 'Selectable Legendary box', price: 1700, limit: 8, rewards: { boxLD: 1 } },
  ],
};

// Merge Event (stand-in schedule; phases from the wiki).
const merge = {
  firstServerDay: 30,
  cycleDays: 60,
  phases: [
    { id: 'berry', currency: 'berryEssence', perPoint: 10 },
    { id: 'orb', currency: 'orbEssence', perPoint: 10 },
    { id: 'soulHeart', currency: 'soulHeartExp', perPoint: 10 },
    { id: 'treasure', currency: 'treasureLiquid', perPoint: 1 },
  ],
  rankRewards: [
    { rank: 1, rewards: { gems: 1000, wristbandEssence: 2000, crystalEssence: 1000 } },
    { rank: 3, rewards: { gems: 600, wristbandEssence: 1200, crystalEssence: 600 } },
    { rank: 10, rewards: { gems: 400, wristbandEssence: 800, crystalEssence: 400 } },
    { rank: 50, rewards: { gems: 200, wristbandEssence: 400, crystalEssence: 200 } },
    { rank: 100, rewards: { gems: 100, wristbandEssence: 200, crystalEssence: 100 } },
  ],
  cpuTop: 6000,
};

writeFileSync(join(repoRoot, 'packages/content/tuning/guild-events.json'), `${JSON.stringify({ guild, shovel, merge }, null, 2)}\n`);
console.log('guild-events.json', guild.levels.length, 'levels', guild.beast.levels.length, 'beast levels');
