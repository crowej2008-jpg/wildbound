/* eslint-disable no-undef */
/**
 * M14.3: write packages/content/tuning/paradise.json (Pokémon Paradise) from the source's poke_catching tables
 * (modes_cfg 2026-10-02) and the gate (sys_open 105, story 2-5). Three rotating 14-day seasons (Parks), each with 4
 * scenes, 16 Dex entries (Trace / Footprint / Drop item / Pokémon steps, each step's stars), the explore pools, the
 * three gear pieces (Lv 0–20), Dex star and category rewards, the season shop. From the owner's wiki
 * (game-modes/pokemon-paradise): stamina refills daily, Poké Balls are unlimited, gear and Dex reset each Park.
 * Item mapping: Ascension Stone → stone, 5S shards → pokemonShard5, Premium GV → ticketPremium, Diamonds → gems,
 * Advanced Ball → ballAdvanced; Golden Egg Vouchers and cosmetics are left out (no such systems).
 *
 *   node scripts/import-paradise.mjs   (WILDBOUND_SOURCE as for the other importers)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, sourceRoot } from './source/source.mjs';

const m = JSON.parse(readFileSync(join(sourceRoot, '2026-10-02', 'modes_cfg.json'), 'utf8'));
const text = (s) => m._text?.[s] ?? s;
const ITEM = { 2: 'gems', 10006: 'ticketPremium', 10103: 'pokemonShard5', 20601: 'stone', 50002: 'ballAdvanced' };
const BOX = { 10251: 'water', 10252: 'fire', 10253: 'grass' };
const speciesBySource = new Map();
for (const file of ['water', 'fire', 'grass', 'light', 'dark', 'summon-pool']) {
  for (const s of JSON.parse(readFileSync(join(repoRoot, 'packages/content/species', `${file}.json`), 'utf8'))) speciesBySource.set(s.sourceId, s);
}
const evolveBoxes = JSON.parse(readFileSync(join(repoRoot, 'packages/content/tuning/faction-tower.json'), 'utf8')).evolveBoxes;

function pay(list) {
  const rewards = {};
  const notCopied = [];
  const boxes = [];
  for (const [id, n] of list ?? []) {
    if (ITEM[id]) rewards[ITEM[id]] = (rewards[ITEM[id]] ?? 0) + n;
    else if (BOX[id]) for (let i = 0; i < n; i += 1) boxes.push(BOX[id]);
    else notCopied.push(`${m._items?.[String(id)] ?? id} ×${n}`);
  }
  return { rewards, ...(boxes.length ? { evolveBoxes: boxes } : {}), ...(notCopied.length ? { notCopied } : {}) };
}
const rows = (o) => Object.values(o);
// Scene names have no English in language_en; plain translations.
const SCENE = { 公园草径: 'Park Trail', 郊外道路: 'Suburban Road', 冬雪小路: 'Snowy Path', 冰晶湖畔: 'Crystal Lakeside', 湖边小路: 'Lakeside Path', 落叶林道: 'Leaf-Fall Woods', 黄金牧场: 'Golden Pasture' };
const sceneName = (zh) => {
  const [base, time] = zh.split('·');
  return `${SCENE[base] ?? text(base)}${time === '夜' ? ' at Night' : time === '黄昏' ? ' at Dusk' : ''}`;
};

const seasons = Object.keys(m.poke_catching_handbook_json).map(Number).sort().map((season) => {
  const s = String(season);
  const dex = rows(m.poke_catching_handbook_json[s])
    .sort((a, b) => a.poke_index - b.poke_index)
    .map((h) => {
      const sp = speciesBySource.get(Math.floor(h.catch_cardId / 10_000));
      if (!sp) throw new Error(`no species for card ${h.catch_cardId}`);
      const shardSp = speciesBySource.get((h.not_catch_item?.[0]?.[0] ?? 0) - 40000 + 100);
      const explore = [1, 2, 3, 4].map((g) => m.poke_catching_explore_json[s][String(g)][String(h.poke_index)]);
      const e = explore[0];
      return {
        id: h.poke_index,
        species: sp.id,
        star: h.catch_cardId % 100,
        catchRate: h.basic_rate / 10000,
        stars: [h.star_1, h.star_2, h.star_3, h.hero_star],
        points: [h.score_1, h.score_2, h.score_3, h.hero_score],
        stepWeights: explore.map((x) => x.weight),
        pool: e.pool,
        poolWeight: e.pool_weight,
        scene: e.need_scene ?? 1,
        fleeShards: shardSp ? { [shardSp.id]: h.not_catch_item[0][1] } : {},
      };
    });
  const scenes = rows(m.poke_catching_scene_json[s])
    .sort((a, b) => a.scene - b.scene)
    .map((x) => ({ scene: x.scene, name: sceneName(x.scene_name), gearLevel: x.need_eqm_lev }));
  const starRewards = rows(m.poke_catching_handbook_star_json[s])
    .sort((a, b) => a.collect_star - b.collect_star)
    .map((x) => ({ stars: x.collect_star, ...pay(x.award) }));
  const categoryRewards = [1, 2, 3, 4].map((g) => {
    const r = rows(m.poke_catching_handbook_reward_json[s][String(g)])[0];
    return { step: g, ...pay(r.award) };
  });
  const shop = rows(m.poke_catching_shop_json[s])
    .sort((a, b) => a.index - b.index)
    .map((x) => ({
      id: x.index,
      ...pay(x.good_item),
      ...(x.score_cost ? { points: x.score_cost } : {}),
      ...(x.exp_cost ? { exp: x.exp_cost } : {}),
      limit: x.buy_times,
      gearLevel: (x.condition ?? x.condition_2 ?? [[1, 0]])[0][1],
    }));
  return { season, scenes, dex, starRewards, categoryRewards, shop };
});

const gear = Object.entries(m.poke_catching_eqm_json).map(([type, levs]) => ({
  type: Number(type),
  name: { 1: 'Energy Drink', 2: 'Small Radar', 3: 'Sports Gloves' }[type] ?? text(rows(levs)[0].name),
  levels: rows(levs)
    .sort((a, b) => a.lev - b.lev)
    .map((l) => ({
      level: l.lev,
      exp: l.need_exp,
      ...(l.max_energy ? { maxStamina: l.max_energy } : {}),
      ...(l.free_explore_rate ? { freeExplore: l.free_explore_rate / 10000 } : {}),
      ...(l.instead_follow_rate ? { track: l.instead_follow_rate / 10000 } : {}),
      ...(l.new_rate ? { findNew: l.new_rate / 10000 } : {}),
      ...(l.extra_ball_rate ? { ballBoost: l.extra_ball_rate[0][1] / 10000 } : {}),
      ...(l.free_ball_rate ? { freeBall: l.free_ball_rate / 10000 } : {}),
    })),
}));

const b = m.poke_catching_basic_json;
const tuning = {
  _note: 'Generated by scripts/import-paradise.mjs (poke_catching tables + the owner\'s wiki). Do not edit.',
  seasonDays: 14,
  baseStamina: 10,
  baseTrack: b.follow_basic_rate / 10000,
  exploreExp: b.eqm_exp,
  repeatCatchPoints: b.catch_score,
  advancedBallBoost: rows(m.poke_catching_ball_json).find((x) => x.ball_id === 2).extra_rate / 10000,
  gear,
  seasons,
  evolveBoxes,
};
writeFileSync(join(repoRoot, 'packages/content/tuning/paradise.json'), `${JSON.stringify(tuning, null, 1)}\n`);
console.log(`paradise.json: ${seasons.length} seasons × ${seasons[0].dex.length} Dex entries, ${gear.length} gear`);
