/* eslint-disable no-undef */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTable, repoRoot } from './source/source.mjs';

/**
 * R9 (source retrofit): summoning copied from the source — the Common and Premium gachas
 * (chest_basic_json 1 / 2), their pools (chest_reward_json 1 / 2: card rows with the odds the game
 * shows), credit boxes (chest_score_json), the VIP credit box (Supreme Gift 10502: item_hero_json;
 * opens from vip_priv_json chest_score, VIP 14) and the Premium Wishing Well. Rules the tables do
 * not hold come from reference/game-rebuild/kb/gacha.md (journal-checked 2026-10-04): free draws
 * 5 / 1 a day on 5-minute / 24-hour timers, +20 / +1 VIP credit a Premium / Common draw, 1,000 VIP
 * credits a Supreme Gift, the Well's 200 Premium draws and +80 % for the chosen faction's
 * Legendaries (Water / Fire / Grass; the Light and Dark Legendaries are not affected), and the
 * Premium "plus" multi-draw of up to 5 × 10 on tickets only.
 *
 * Writes packages/content/tuning/gacha.json.   node scripts/import-gacha.mjs
 */

const contentDir = join(repoRoot, 'packages/content');
const FACTIONS = ['water', 'fire', 'grass', 'light', 'dark'];
const speciesBySource = new Map();
for (const file of [...FACTIONS, 'summon-pool']) {
  for (const s of JSON.parse(readFileSync(join(contentDir, 'species', `${file}.json`), 'utf8'))) {
    speciesBySource.set(s.sourceId, s);
  }
}

/** Source item → our currency. */
const ITEM = { 2: 'gems', 10006: 'ticketPremium', 10007: 'ticketCommon', 10103: 'pokemonShard5', 10501: 'preciousShard' };
/** The pool's display groups (chest_reward group_name). */
const GROUP = { 其他宠物: 'other', 史诗宠物: 'epic', 传说宠物: 'legendary', 至尊宠物: 'supreme', 神话宠物: 'mythic' };

const basics = Object.values(loadTable('chest_basic_json'));
const rewards = loadTable('chest_reward_json');
const scores = loadTable('chest_score_json');
const heroItems = Object.values(loadTable('item_hero_json'));
const vipPriv = loadTable('vip_priv_json');

function card(cardId) {
  const heroId = Math.floor(cardId / 10_000);
  const star = cardId % 100;
  const species = speciesBySource.get(heroId);
  if (!species) throw new Error(`card ${cardId}: no species for hero ${heroId}`);
  if (!species.stars.some((c) => c.star === star)) throw new Error(`card ${cardId}: ${species.id} has no ${star}★`);
  return { species: species.id, star };
}

function price(list) {
  if (!list) return null;
  const [[item, qty]] = list;
  if (item !== 2) throw new Error(`unexpected price item ${item}`);
  return qty;
}

function box(chestType) {
  const rows = Object.values(scores[String(chestType)]);
  if (rows.length !== 1) throw new Error(`chest ${chestType}: expected one credit box`);
  const [{ reward_score: needed, reward }] = rows;
  const out = {};
  for (const [item, qty] of reward) {
    if (!ITEM[item]) throw new Error(`chest ${chestType}: unmapped box item ${item}`);
    out[ITEM[item]] = qty;
  }
  return { needed, rewards: out };
}

function pool(chestType) {
  return Object.values(rewards[String(chestType)])
    .sort((a, b) => a.index - b.index)
    .map((row) => {
      if (!row.cardId) throw new Error(`pool ${chestType} row ${row.index} is not a Pokémon`);
      const group = GROUP[row.group_name];
      if (!group) throw new Error(`pool ${chestType}: unknown group ${row.group_name}`);
      return { ...card(row.cardId), weight: row.fake_weight, group };
    });
}

/** kb/gacha.md — the rules the tables leave out, per machine. */
const RULES = {
  1: { id: 'common', freePerDay: 5, freeCooldownMinutes: 5, vipCreditPerDraw: 1, maxTenBatches: 1 },
  2: { id: 'premium', freePerDay: 1, freeCooldownMinutes: 1440, vipCreditPerDraw: 20, maxTenBatches: 5 },
};

const machines = [1, 2].map((chestType) => {
  const basic = basics.find((b) => b.chest_type === chestType);
  const ticket = ITEM[basic.single_item_cost[0][0]];
  const credits = box(chestType);
  return {
    id: RULES[chestType].id,
    ticket,
    gemPerDraw: price(basic.single_cost),
    gemPerTen: price(basic.tenTimes_cost),
    freePerDay: RULES[chestType].freePerDay,
    freeCooldownMinutes: RULES[chestType].freeCooldownMinutes,
    creditPerDraw: basic.score,
    vipCreditPerDraw: RULES[chestType].vipCreditPerDraw,
    boxCreditsNeeded: credits.needed,
    boxRewards: credits.rewards,
    maxTenBatches: RULES[chestType].maxTenBatches,
    pool: pool(chestType),
  };
});

const gift = heroItems.find((h) => h.item_id === 10502);
const giftLevel = Object.values(vipPriv).find((v) => v.chest_score === 1)?.lev;
if (giftLevel === undefined) throw new Error('no VIP level opens the Supreme Gift');

const out = {
  _note:
    'R9: copied from the source by scripts/import-gacha.mjs (chest_basic / chest_reward / chest_score, item_hero 10502, vip_priv chest_score; kb/gacha.md for free draws, VIP credits and the Wishing Well). Pool weights are the odds the game shows (fake_weight, parts per million).',
  machines,
  wishingWell: { machine: 'premium', unlockDraws: 200, factions: ['water', 'fire', 'grass'], tier: 'legendary', boost: 1.8 },
  supremeGift: {
    credits: 1000,
    vipLevel: giftLevel,
    species: gift.hero_id_list.map(([kind, heroId]) => {
      if (kind !== 1) throw new Error('Supreme Gift row is not a hero');
      const species = speciesBySource.get(heroId);
      if (!species) throw new Error(`Supreme Gift: no species for hero ${heroId}`);
      return species.id;
    }),
  },
};

writeFileSync(join(contentDir, 'tuning/gacha.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(machines.map((m) => `${m.id}: ${m.pool.length} rows`).join(', '), `· Supreme Gift ${out.supremeGift.species.length} (VIP ${giftLevel})`);
