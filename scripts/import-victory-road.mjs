/* eslint-disable no-undef */
/**
 * M14.1: write packages/content/tuning/victory-road.json (Victory Road) from the source.
 *   - champion_road_area_json / _chapter_json / _chapter_progress_json (modepages-pvp_cfg 2026-10-03): 8 areas, 60
 *     gyms with their badges (daily Diamonds, privilege id + value, text) and three progress chests (30 / 60 / 100).
 *   - dun_champion_task_json (retired_cfg 2026-10-03): one task per gym (task_id = gym) — the only gym tasks in the
 *     dumps (reading: the live game's task lists are not in the config).
 *
 *   node scripts/import-victory-road.mjs   (WILDBOUND_SOURCE as for the other importers)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, sourceRoot } from './source/source.mjs';

const pvp = JSON.parse(readFileSync(join(sourceRoot, '2026-10-03', 'modepages-pvp_cfg.json'), 'utf8'));
const retired = JSON.parse(readFileSync(join(sourceRoot, '2026-10-03', 'retired_cfg.json'), 'utf8'));
const text = (s) => pvp._text?.[s] ?? s;
const rtext = (s) => retired._text?.[s] ?? s;
const itemName = (id) => pvp._items?.[String(id)] ?? retired._items?.[String(id)] ?? String(id);

const CURRENCY = { 2: 'gems', 1: 'gold', 10006: 'ticketPremium', 10103: 'pokemonShard5', 10059: 'resonationShard' };
const TITLE_BY_CARD = new Map(JSON.parse(readFileSync(join(repoRoot, 'packages/content/titles/titles.json'), 'utf8')).map((t) => [t.card, t.id]));
function rewards(list) {
  const out = {};
  const left = [];
  let titleCard;
  for (const [id, n] of list) {
    if (CURRENCY[id]) out[CURRENCY[id]] = (out[CURRENCY[id]] ?? 0) + n;
    else if (TITLE_BY_CARD.has(id)) titleCard = TITLE_BY_CARD.get(id);
    else left.push(`${itemName(id)} ×${n}`);
  }
  return { rewards: out, ...(titleCard ? { titleCard } : {}), ...(left.length ? { notCopied: left } : {}) };
}

// Privileges (badge_desc readings): 101 AFK %, 201–224 class / faction battle stats, the rest mode perks.
const CLASS = ['striker', 'guardian', 'adept'];
const FACTION5 = ['grass', 'fire', 'water', 'light', 'dark'];
function perk(id, value) {
  if (id === undefined || id === null) return null;
  if (id === 101) return { kind: 'afk', value: value / 100 };
  const pct = value / 100;
  if (id >= 201 && id <= 203) return { kind: 'stat', field: 'hpPct', className: CLASS[id - 201], value: pct };
  if (id >= 204 && id <= 208) return { kind: 'stat', field: 'hpPct', faction: FACTION5[id - 204], value: pct };
  if (id >= 209 && id <= 211) return { kind: 'stat', field: 'pAtkPct', className: CLASS[id - 209], value: pct };
  if (id >= 212 && id <= 214) return { kind: 'stat', field: 'sAtkPct', className: CLASS[id - 212], value: pct };
  if (id >= 215 && id <= 219) return { kind: 'stat', field: 'pAtkPct', faction: FACTION5[id - 215], value: pct };
  if (id >= 220 && id <= 224) return { kind: 'stat', field: 'sAtkPct', faction: FACTION5[id - 220], value: pct };
  const MODE = { 1: 'arenaTokens', 5: 'rankedTokens', 7: 'mistyCoins', 8: 'factionCoins', 9: 'skyPillarChallenge', 10: 'skyPillarSweep', 11: 'ladderCoins' };
  if (MODE[id]) return { kind: MODE[id], value: pct };
  return { kind: 'shop', value: id };
}

const areas = Object.values(pvp.champion_road_area_json)
  .sort((a, b) => a.area_id - b.area_id)
  .map((a) => ({ id: a.area_id, name: text(a.name) }));

function task(t) {
  const target = String(t.task_target);
  const desc = rtext(t.task_desc);
  const value = t.task_value;
  let m;
  if (target === 'lev') return { kind: 'trainerLevel', value, desc };
  if (target === 'dun') {
    const d = value;
    if (d >= 100000 && d < 200000) return { kind: 'story', stage: `c${Math.floor((d % 100000) / 100)}-${d % 100}`, desc };
    if (d >= 600000 && d < 700000) return { kind: 'tower', floor: d - 600000, desc };
    if (d >= 700000 && d < 800000) return { kind: 'gym', gym: Math.floor((d - 700000) / 100), desc };
    return { kind: 'untracked', desc };
  }
  if ((m = /^\{hero_lev,(\d+)\}$/.exec(target))) return { kind: 'pokemonLevel', level: Number(m[1]), count: value, desc };
  if ((m = /^\{card_star_(?:num|a),(\d+)\}$/.exec(target))) return { kind: 'pokemonStars', stars: Number(m[1]), count: value, desc };
  if ((m = /^\{stone_stage,(\d+)\}$/.exec(target))) return { kind: 'plates', plateStage: Number(m[1]), count: value, desc };
  if ((m = /^\{hero_weapon_a,(\d+)\}$/.exec(target))) return { kind: 'trinkets', level: Number(m[1]), count: value, desc };
  if ((m = /^\{hero_eqm_berry_a,(\d+)\}$/.exec(target))) return { kind: 'berries', star: Number(m[1]), count: value, desc };
  if ((m = /^\{orb_a,(\d+)\}$/.exec(target))) return { kind: 'orbs', level: Number(m[1]), count: value, desc };
  if (target === 'race_tower_a') return { kind: 'factionTower', floor: value, desc };
  if (/^\{maze,/.test(target)) return { kind: 'misty', desc };
  return { kind: 'untracked', desc };
}
const tasks = new Map(Object.values(retired.dun_champion_task_json).map((t) => [t.task_id, t]));

const gyms = Object.values(pvp.champion_road_chapter_json)
  .sort((a, b) => a.chapter_id - b.chapter_id)
  .map((c) => {
    const chests = Object.values(pvp.champion_road_chapter_progress_json[String(c.chapter_id)])
      .sort((a, b) => a.target_progress - b.target_progress)
      .map((p) => ({ progress: p.target_progress, ...rewards(p.reward_items) }));
    const t = tasks.get(c.chapter_id);
    return {
      index: c.chapter_id,
      area: c.area_id,
      badge: text(c.badge_name),
      text: text(c.badge_desc),
      dailyGems: c.badge_day_reward.find(([id]) => id === 2)?.[1] ?? 0,
      perk: perk(c.privlege_id, c.privlege_value),
      chests,
      task: t ? { ...task(t), ...rewards(t.reward) } : null,
    };
  });
if (gyms.length !== 60) throw new Error(`${gyms.length} gyms`);
writeFileSync(join(repoRoot, 'packages/content/tuning/victory-road.json'), `${JSON.stringify({ _note: 'Generated by scripts/import-victory-road.mjs from the source. Do not edit.', areas, gyms }, null, 1)}\n`);
const notCopied = gyms.flatMap((g) => [...g.chests.flatMap((c) => c.notCopied ?? []), ...(g.task?.notCopied ?? [])]);
console.log(`victory-road.json: ${areas.length} areas, ${gyms.length} gyms; not copied: ${[...new Set(notCopied)].join('; ') || 'none'}; untracked tasks ${gyms.filter((g) => g.task?.kind === 'untracked').length}`);
