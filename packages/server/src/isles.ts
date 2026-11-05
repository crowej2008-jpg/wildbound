import {
  dayKey,
  ghostRecords,
  rankDamage,
  weekKey,
  weekdayUtc,
  type AccountState,
  type IslesState,
  type Rewards,
  type StageEnemy,
} from '@wildbound/engine';
import { buildEnemyTeam, buildWildTeam, fielded, runTeams, type BattleView } from './battle';
import type { GameConfig } from './config';
import { applyGrant } from './economy';
import { fail, ok, type Result } from './index';
import { enemiesFor } from './pve/shared';
import { fusionPerk } from './account3';

/**
 * Clash of Isles (M14.5): the source's island contest (island_new_*), solo against CPU guilds. 50 islands in 10 sea
 * areas (Lesser / Medium / Greater / Premium, 30–60 Isle Tokens per 5 minutes held). Attacks cost attempts (6, +1 every
 * 4 h; Isle Challenge Vouchers when out); 2 / 3 / 4 attempts at once boost stats 20 / 50 / 80 %. A CPU garrison has 3
 * shields, one lost per win; at 0 the island is yours. Holding burns development power (180 a day, 1 a minute) and
 * pays tokens when collected. Wins add fatigue (−5 % each, max −50 %); a loss clears it. Every battle scores season
 * points; season rank among CPU players; daily challenge tasks. See docs/design/clash-of-isles.md.
 */

/** Fusion-skin perk: "Clash of Isles hanging increased X%". */
function skinBoost(config: GameConfig, state: AccountState, tokens: number): number {
  return Math.round(tokens * (1 + fusionPerk(config, state, 'Clash of Isles') / 100));
}

const DAY = 86_400_000;
const MIN = 60_000;
type Isles = GameConfig['isles'];

export function islesOpen(config: GameConfig, state: AccountState, now: number): boolean {
  const g = config.isles.gate;
  const day = Math.floor((now - state.serverEpoch) / DAY) + 1;
  return day >= g.serverDay && (state.campaign.stars[g.stage] ?? 0) > 0;
}

export function islesSeasonDay(now: number): boolean {
  return weekdayUtc(now) !== 1;
}

const LOCKED = 'Clash of Isles opens on server day 2 after story 3-10';

function initial(t: Isles, now: number): IslesState {
  return { week: weekKey(now), day: dayKey(now), attempts: t.attemptsMax, attemptsAt: now, held: 0, heldAt: now, power: t.powerPerDay, shields: {}, fatigue: 0, points: 0, challengesToday: 0, claimed: [], lastRank: null };
}

function settle(t: Isles, s: IslesState, now: number): { state: IslesState; tokens: number } {
  if (!s.held) return { state: { ...s, heldAt: now }, tokens: 0 };
  const island = t.islands.find((i) => i.id === s.held)!;
  const minutes = Math.min(Math.floor((now - s.heldAt) / MIN), s.power);
  const tokens = Math.floor(minutes / t.tokenEveryMin) * island.tokens;
  return { state: { ...s, power: s.power - minutes, heldAt: s.heldAt + minutes * MIN }, tokens };
}

export function prepareIsles(config: GameConfig, state: AccountState, now: number): { state: AccountState; changed: boolean } {
  const t = config.isles;
  let s = state.isles ?? initial(t, now);
  let paid = 0;
  if (s.week !== weekKey(now)) {
    const settled = settle(t, s, now);
    paid += settled.tokens;
    s = { ...initial(t, now), lastRank: s.points > 0 ? islesRank(s.points, s.week) : s.lastRank };
  }
  if (s.day !== dayKey(now)) {
    const settled = settle(t, s, now);
    paid += settled.tokens;
    s = { ...settled.state, day: dayKey(now), power: t.powerPerDay, challengesToday: 0, claimed: s.claimed.filter((k) => !k.startsWith('task:')), heldAt: now };
  }
  const regen = Math.floor((now - s.attemptsAt) / (t.attemptRegenMin * MIN));
  if (regen > 0) s = { ...s, attempts: Math.min(t.attemptsMax, s.attempts + regen), attemptsAt: s.attempts + regen >= t.attemptsMax ? now : s.attemptsAt + regen * t.attemptRegenMin * MIN };
  if (s === state.isles && paid === 0) return { state, changed: false };
  const next = { ...state, isles: s };
  return { state: paid > 0 ? applyGrant(config, next, { islandCoin: skinBoost(config, next, paid) }) : next, changed: true };
}

export function islesRank(points: number, week: string): number {
  let seed = 7;
  for (const ch of week) seed = (seed * 33 + ch.charCodeAt(0)) >>> 0;
  return rankDamage(points, ghostRecords([Math.max(500, points)], seed, 999));
}

/** A CPU-held island's garrison (stronger in the earlier, richer sea areas). */
export function islandDefenders(config: GameConfig, state: AccountState, id: number): StageEnemy[] {
  const island = config.isles.islands.find((i) => i.id === id)!;
  const team = fielded(state, 'isles');
  const level = team.length ? Math.round(team.reduce((a, w) => a + w.level, 0) / team.length) : 1;
  const k = 0.8 + island.tier * 0.15 + (10 - island.area) * 0.03;
  const spec = { ...config.pve.tower.enemy, count: 6, baseLevel: Math.max(1, level), levelSlope: 1 };
  return enemiesFor(config, spec, id % 40).map((e) => ({ ...e, level: Math.max(1, level), mult: { hp: k, atk: k, def: k } }));
}

export interface IslesAttack {
  state: AccountState;
  battle: BattleView;
  win: boolean;
  captured: boolean;
  points: number;
}

/** Attack an island with 1–4 attempts (2 / 3 / 4 add 20 / 50 / 80 % stats). */
export function attackIsland(config: GameConfig, state: AccountState, now: number, id: number, attempts = 1, seed?: number): Result<IslesAttack> {
  if (!islesOpen(config, state, now)) return fail('resource_locked', LOCKED);
  if (!islesSeasonDay(now)) return fail('not_ready', 'Monday is off-season — the islands open on Tuesday');
  const t = config.isles;
  let s = prepareIsles(config, state, now).state;
  let isl = s.isles!;
  if (!t.islands.some((i) => i.id === id)) return fail('not_found', 'no such island');
  if (isl.held === id) return fail('invalid_input', 'you already hold this island');
  if (attempts < 1 || attempts > 4) return fail('invalid_input', 'use 1 to 4 attempts');
  if (isl.attempts < attempts) {
    const short = attempts - isl.attempts;
    if ((s.currencies.islandVoucher ?? 0) < short) return fail('daily_limit', 'not enough attempts (Isle Challenge Vouchers cover the rest)');
    s = { ...s, currencies: { ...s.currencies, islandVoucher: (s.currencies.islandVoucher ?? 0) - short } };
    isl = { ...isl, attempts: 0 };
  } else isl = { ...isl, attempts: isl.attempts - attempts };
  const boost = t.boosts.find((b) => b.attempts === attempts)?.pct ?? 0;
  const k = (1 + boost) * (1 - isl.fatigue);
  const attackers = buildWildTeam(fielded(s, 'isles'), 'attackers', config, s);
  if (attackers.specs.length === 0) return fail('not_found', 'set a Clash of Isles team first');
  for (const sp of attackers.specs) sp.sheet = { ...sp.sheet, hp: Math.round(sp.sheet.hp * k), pAtk: Math.round(sp.sheet.pAtk * k), sAtk: Math.round(sp.sheet.sAtk * k) };
  const battle = runTeams(attackers, buildEnemyTeam(islandDefenders(config, s, id), config), {
    seed: seed ?? Math.floor(config.rng() * 0xffffffff),
    mode: 'isles',
    battleId: `m14:isles:${isl.week}:${id}:${isl.points}`,
    strategies: { attackers: s.strategies.isles },
  });
  if (!battle) return fail('not_found', 'set a Clash of Isles team first');
  const win = battle.winner === 'attackers';
  const points = t.pointsPerBattle + (win ? t.winBonus : 0);
  let captured = false;
  isl = { ...isl, points: isl.points + points, challengesToday: isl.challengesToday + 1, fatigue: win ? Math.min(t.fatigueMax, isl.fatigue + t.fatiguePerWin) : 0 };
  if (win) {
    const left = (isl.shields[String(id)] ?? t.cpuShields) - 1;
    if (left <= 0) {
      const settled = settle(t, isl, now);
      s = settled.tokens > 0 ? applyGrant(config, s, { islandCoin: skinBoost(config, s, settled.tokens) }) : s;
      isl = { ...settled.state, held: id, heldAt: now, shields: { ...isl.shields, [String(id)]: t.cpuShields } };
      captured = true;
    } else isl = { ...isl, shields: { ...isl.shields, [String(id)]: left } };
  }
  return ok({ state: { ...s, isles: isl }, battle, win, captured, points });
}

/** Collect the held island's tokens so far. */
export function collectIsland(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; rewards: Rewards }> {
  const s = prepareIsles(config, state, now).state;
  const settled = settle(config.isles, s.isles!, now);
  if (settled.tokens === 0) return fail('not_ready', 'nothing to collect yet');
  const tokens = skinBoost(config, s, settled.tokens);
  return ok({ state: applyGrant(config, { ...s, isles: settled.state }, { islandCoin: tokens }), rewards: { islandCoin: tokens } });
}

export function claimIslesTask(config: GameConfig, state: AccountState, now: number, challenges: number): Result<{ state: AccountState; rewards: Rewards }> {
  const s = prepareIsles(config, state, now).state;
  const isl = s.isles!;
  const task = config.isles.tasks.find((x) => x.challenges === challenges);
  if (!task) return fail('not_found', 'no such task');
  const key = `task:${challenges}`;
  if (isl.claimed.includes(key)) return fail('invalid_input', 'already claimed today');
  if (isl.challengesToday < challenges) return fail('not_ready', `challenge ${challenges} times today first`);
  return ok({ state: applyGrant(config, { ...s, isles: { ...isl, claimed: [...isl.claimed, key] } }, task.rewards as Rewards), rewards: task.rewards as Rewards });
}

export function claimIslesSeason(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; rewards: Rewards }> {
  const s = prepareIsles(config, state, now).state;
  const isl = s.isles!;
  if (isl.lastRank === null) return fail('not_ready', 'no finished season to claim');
  const row = config.isles.ranks.find((r) => isl.lastRank! <= r.upTo);
  const rewards = (row?.rewards ?? {}) as Rewards;
  return ok({ state: applyGrant(config, { ...s, isles: { ...isl, lastRank: null } }, rewards), rewards });
}
