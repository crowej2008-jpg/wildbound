#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * R9: import the source's 12 daily quests into packages/content/quests/daily.json.
 *
 * Source: daily_task_basic_json (target, count, activity score, the trainer level it appears at — award_lev — and
 * the reward: Gold ×5,000 + Trainer XP ×200 each); English text from the dumps' language notes. Each source target
 * maps to a Wildbound counter; Adventure missions and guild donations have no Wildbound mode yet (`comingIn`).
 *
 *   WILDBOUND_SOURCE=…/h5-client node scripts/import-dailies.mjs
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTable, loadTextMap, repoRoot } from './source/source.mjs';

const METRIC = {
  exp_draw: ['claimIdle'],
  tower_pk: ['towerChallenge'],
  quick_afk: ['quickCombat'],
  arena: ['arenaChallenge'],
  '{daily_dun_a,8}': ['dailyDungeon'],
  mission_task: ['adventureMission', 'M13'],
  hero_lev: ['levelUp'],
  '{chest,2}': ['premiumSummon'],
  '{item_cost,2}': ['gemsSpent'],
  shop_buy: ['shopBuy'],
  guild_donate: ['guildDonate', 'M15'],
  pet_home_num: ['petHomeMerge'],
};
// Source item ids in the award rows.
const ITEM = { 1: 'gold', 5: 'xp' };

const text = loadTextMap();
const quests = Object.values(loadTable('daily_task_basic_json'))
  .sort((a, b) => a.id - b.id)
  .map((r) => {
    const m = METRIC[r.target];
    if (!m) throw new Error(`no metric for daily target ${r.target}`);
    const rewards = {};
    for (const [item, n] of r.award) {
      if (!ITEM[item]) throw new Error(`unknown award item ${item}`);
      rewards[ITEM[item]] = n;
    }
    return {
      id: `d${r.id}`,
      name: text[r.desc] ?? r.desc,
      metric: m[0],
      target: r.value,
      activity: r.score,
      unlockLevel: r.award_lev,
      ...(m[1] ? { comingIn: m[1] } : {}),
      rewards,
    };
  });
if (quests.length !== 12) throw new Error(`${quests.length} dailies`);
writeFileSync(join(repoRoot, 'packages/content/quests/daily.json'), JSON.stringify(quests, null, 2) + '\n');
console.log(`wrote ${quests.length} dailies, ${quests.reduce((s, q) => s + q.activity, 0)} activity in all`);
