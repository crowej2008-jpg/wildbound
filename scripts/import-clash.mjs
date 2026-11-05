/* eslint-disable no-undef */
/**
 * M18.2: write packages/content/tuning/clash.json — Cross-Server Clash from modepages-pvp_cfg cross_trainer_match_json
 * (tryout days Tue / Thu / Sat: score contest + 5 knockout rounds; Sunday: 5 final rounds) and cross_trainer_lineup_json.
 * Items: 17 Arena Tokens, 10103 5★ shards, 1 Gold. From the owner's wiki: open on server day 3 after story 3-10 and
 * trainer level 10; top 64 of the Arena qualify; daily Guess Coins = 3,000 Prediction Coins; Prediction Coins turn into
 * Arena Tokens 1:1 at the week's end; tryout-day champion bonus. Stand-ins: CPU strengths and the score-contest cut.
 *
 *   node scripts/import-clash.mjs   (WILDBOUND_SOURCE as for the other importers)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, sourceRoot } from './source/source.mjs';

const d = JSON.parse(readFileSync(join(sourceRoot, '2026-10-03', 'modepages-pvp_cfg.json'), 'utf8'));
const ITEM = { 17: 'arenaToken', 10103: 'pokemonShard5', 1: 'gold' };
const rewards = (list) => Object.fromEntries((list ?? []).filter(([id]) => ITEM[id]).map(([id, n]) => [ITEM[id], n]));
const hm = (s) => s.replace(/[{}]/g, '').split(',').map(Number);

const days = {};
for (const rounds of Object.values(d.cross_trainer_match_json)) {
  const list = Object.values(rounds).sort((a, b) => a.round_step - b.round_step);
  const weekday = list[0].week_day;
  days[weekday] = list.map((r) => ({
    step: r.round_step,
    kind: r.match_type === 0 ? 'score' : 'knockout',
    battle: hm(r.battle_time),
    winScore: r.win_score,
    lossScore: r.fail_score,
    rewards: rewards(r.score_stage_reward),
    bet: r.guess_max ? { min: r.guess_min, max: r.guess_max, right: r.guess_right_rate / 100, wrong: r.guess_fail_rate / 100 } : null,
    thirdPlace: r.round_step === 4 && weekday === 7,
  }));
}
const clash = {
  unlock: { serverDay: 3, stage: 'c3-10', level: 10 },
  arenaTop: 64,
  tryoutDays: [2, 4, 6],
  finalDay: 7,
  days,
  lineups: Object.values(d.cross_trainer_lineup_json)
    .map((r) => ({ teams: Number(r.lineup_desc[0]), size: Number(r.lineup_desc.slice(-1)), from: r.world_lv_left, to: r.world_lv_right }))
    .sort((a, b) => a.from - b.from),
  guessCoins: 3000,
  championBonus: { arenaToken: 20000, pokemonShard5: 60, gold: 600000 },
  scoreCut: 12,
  cpu: { base: 0.85, perRound: 0.07, sunday: 0.15 },
};
writeFileSync(join(repoRoot, 'packages/content/tuning/clash.json'), `${JSON.stringify(clash, null, 2)}\n`);
console.log('clash.json', Object.keys(days).join(','));
