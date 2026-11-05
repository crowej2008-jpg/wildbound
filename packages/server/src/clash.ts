import { dayKey, mulberry32, weekKey, weekdayUtc, type AccountState, type Rewards, type StageEnemy } from '@wildbound/engine';
import { fusionPerk } from './account3';
import { buildEnemyTeam, buildWildTeam, fielded, runTeams, type BattleView } from './battle';
import type { GameConfig } from './config';
import { applyGrant } from './economy';
import { fail, ok, type Result } from './index';
import { arenaGhostName } from './pvp/shared';
import { enemiesFor } from './pve/shared';
import { templePlace } from './temple';

/**
 * M18.2 Cross-Server Clash (source cross_trainer_match_json + the owner's wiki), solo against CPU players. A weekly cup:
 * tryouts on Tuesday, Thursday and Saturday (a 3-battle score contest — win 5, loss 2 — then knockouts Top 16 → final),
 * and a Sunday final for players who reached the Top 16 on a tryout day (Top 8, Top 4, semifinal, third place, final).
 * Rounds open at their source battle time (UTC) and stay playable until the day ends. Winning a round pays its source
 * reward; a tryout-day title pays the champion bonus. Arena top 64 qualify. Predictions: claim 3,000 Prediction Coins
 * each cup day, bet 100–4,000 on a featured CPU match per knockout round (right = ×2, wrong = ×0.5); left-over coins
 * turn into Arena Tokens 1:1 when the week ends. See docs/design/clash.md.
 */

export type ClashState = NonNullable<AccountState['clash']>;
type Round = GameConfig['clash']['days'][string][number];
const HOUR = 3_600_000;
const MIN = 60_000;

/** Monday = 1 … Sunday = 7 (the source's week_day). */
function sourceWeekday(now: number): number {
  const d = weekdayUtc(now);
  return d === 0 ? 7 : d;
}

export function clashOpen(config: GameConfig, state: AccountState, now: number): boolean {
  const u = config.clash.unlock;
  const day = Math.floor((now - state.serverEpoch) / 86_400_000) + 1;
  return day >= u.serverDay && (state.campaign.stars[u.stage] ?? 0) > 0 && state.profile.level >= u.level;
}

function fresh(week: string): ClashState {
  return { week, qualified: null, days: {}, coinsDays: [], bets: {} };
}

/** Roll the week: unspent Prediction Coins become Arena Tokens 1:1. */
export function prepareClash(config: GameConfig, state: AccountState, now: number): AccountState {
  const week = weekKey(now);
  const cur = state.clash;
  if (cur && cur.week === week) return state;
  let s = state;
  const coins = s.currencies.predictionCoin ?? 0;
  if (cur && coins > 0) s = applyGrant(config, { ...s, currencies: { ...s.currencies, predictionCoin: 0 } }, { arenaToken: coins });
  return { ...s, clash: fresh(week) };
}

function roundStart(now: number, r: Round): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + r.battle[0]! * HOUR + r.battle[1]! * MIN;
}

function dayState(c: ClashState, wd: number) {
  return c.days[String(wd)] ?? { step: 1, score: 0, contest: 0, out: false, won: [] as number[], champion: false };
}

/** Sunday entry: a tryout day where the Top 16 round (step 2) was won. */
export function sundayQualified(c: ClashState): boolean {
  return Object.entries(c.days).some(([wd, d]) => wd !== '7' && d.won.includes(2));
}

function opponents(config: GameConfig, state: AccountState, wd: number, step: number, k: number): StageEnemy[] {
  const team = fielded(state, 'clash');
  const level = team.length ? Math.round(team.reduce((a, w) => a + w.level, 0) / team.length) : 1;
  const spec = { ...config.pve.tower.enemy, count: 6, baseLevel: Math.max(1, level), levelSlope: 1 };
  return enemiesFor(config, spec, (wd * 7 + step * 3 + k) % 40).map((e) => ({ ...e, level: Math.max(1, level), mult: (() => { const m = config.clash.cpu.base + config.clash.cpu.perRound * (step - 1) + (wd === 7 ? config.clash.cpu.sunday : 0); return { hp: m, atk: m, def: m }; })() }));
}

export interface ClashFight {
  state: AccountState;
  battle: BattleView;
  win: boolean;
  rewards: Rewards;
  advanced: boolean;
  out: boolean;
}

/** Play your next round today (score-contest battles one at a time). */
export function playClashRound(config: GameConfig, state: AccountState, now: number, seed?: number): Result<ClashFight> {
  if (!clashOpen(config, state, now)) return fail('resource_locked', 'Cross-Server Clash opens on server day 3 after story 3-10 and trainer level 10');
  let s = prepareClash(config, state, now);
  let c = s.clash!;
  const wd = sourceWeekday(now);
  const rounds = config.clash.days[String(wd)];
  if (!rounds) return fail('not_ready', 'the Clash runs Tuesday, Thursday, Saturday and Sunday');
  if (c.qualified === null) c = { ...c, qualified: templePlace(config, s, now) <= config.clash.arenaTop };
  if (!c.qualified) return fail('resource_locked', `only the Arena top ${config.clash.arenaTop} entered this week — you can still predict`);
  if (wd === 7 && !sundayQualified(c)) return fail('resource_locked', 'reach the Top 16 on a tryout day to play on Sunday');
  const d = dayState(c, wd);
  if (d.out) return fail('invalid_input', "you're out for today");
  const round = rounds.find((r) => r.step === d.step);
  if (!round) return fail('invalid_input', 'today is finished');
  if (now < roundStart(now, round)) return fail('not_ready', `this round opens at ${String(round.battle[0]).padStart(2, '0')}:${String(round.battle[1]).padStart(2, '0')} UTC`);
  const attackers = buildWildTeam(fielded(s, 'clash'), 'attackers', config, s);
  if (attackers.specs.length === 0) return fail('not_found', 'set a Clash team first');
  const battle = runTeams(attackers, buildEnemyTeam(opponents(config, s, wd, d.step, d.contest), config), {
    seed: seed ?? Math.floor(config.rng() * 0xffffffff),
    mode: 'clash',
    battleId: `m18:clash:${c.week}:${wd}:${d.step}:${d.contest}`,
    strategies: { attackers: s.strategies.clash },
  });
  if (!battle) return fail('not_found', 'set a Clash team first');
  const win = battle.winner === 'attackers';
  let next = { ...d };
  let rewards: Rewards = {};
  let advanced = false;
  if (round.kind === 'score') {
    next = { ...next, score: next.score + (win ? round.winScore : round.lossScore), contest: next.contest + 1 };
    if (next.contest >= 3) {
      if (next.score >= config.clash.scoreCut) {
        rewards = round.rewards as Rewards;
        next = { ...next, step: next.step + 1, won: [...next.won, round.step] };
        advanced = true;
      } else next = { ...next, out: true };
    }
  } else if (win) {
    rewards = round.rewards as Rewards;
    advanced = true;
    const last = rounds[rounds.length - 1]!;
    // Sunday: a semifinal win skips the third-place match.
    const skip = wd === 7 && rounds.find((r) => r.step === round.step + 1)?.thirdPlace;
    next = { ...next, won: [...next.won, round.step], step: round.step + (skip ? 2 : 1) };
    if (round.step === last.step) {
      next = { ...next, champion: true, step: last.step + 1 };
      if (wd !== 7) rewards = { ...rewards, ...Object.fromEntries(Object.entries(config.clash.championBonus).map(([k, v]) => [k, v + ((rewards as Record<string, number>)[k] ?? 0)])) } as Rewards;
    }
  } else {
    // Sunday: a semifinal loss drops to the third-place match.
    const third = wd === 7 ? rounds.find((r) => r.step === round.step + 1 && r.thirdPlace) : undefined;
    next = third ? { ...next, step: third.step } : { ...next, out: true };
    if (round.thirdPlace) next = { ...next, out: true };
  }
  const outNow = next.out;
  c = { ...c, days: { ...c.days, [String(wd)]: next } };
  s = applyGrant(config, { ...s, clash: c }, rewards);
  return ok({ state: s, battle, win, rewards, advanced, out: outNow });
}

// ---------------------------------------------------------------- Predictions

export function claimGuessCoins(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; rewards: Rewards }> {
  if (!clashOpen(config, state, now)) return fail('resource_locked', 'Cross-Server Clash is not open yet');
  const s = prepareClash(config, state, now);
  const c = s.clash!;
  if (!config.clash.days[String(sourceWeekday(now))]) return fail('not_ready', 'Guess Coins are handed out on Clash days');
  const today = dayKey(now);
  if (c.coinsDays.includes(today)) return fail('daily_limit', "today's Guess Coins are claimed");
  const n = Math.round(config.clash.guessCoins * (1 + fusionPerk(config, s, 'prediction coins') / 100));
  const rewards: Rewards = { predictionCoin: n };
  return ok({ state: applyGrant(config, { ...s, clash: { ...c, coinsDays: [...c.coinsDays, today] } }, rewards), rewards });
}

/** The featured CPU match of a knockout round: two names, their power and the (seeded) winner. */
export function featuredMatch(config: GameConfig, week: string, wd: number, step: number) {
  const seed = (week.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) + wd * 101 + step * 13) >>> 0;
  const rng = mulberry32(seed);
  const a = 1 + Math.floor(rng() * 64);
  const b = 1 + Math.floor(rng() * 64);
  const pa = Math.round(4_000_000 + rng() * 2_000_000);
  const pb = Math.round(4_000_000 + rng() * 2_000_000);
  const winner = rng() < pa / (pa + pb) ? 0 : 1;
  return { players: [{ name: arenaGhostName(a), power: pa }, { name: arenaGhostName(b === a ? a + 1 : b), power: pb }], winner };
}

function betKey(wd: number, step: number): string {
  return `${wd}:${step}`;
}

/** Back one side of today's featured match for a knockout round before it starts (stake can be raised to the cap). */
export function placeBet(config: GameConfig, state: AccountState, now: number, step: number, pick: 0 | 1, stake: number): Result<AccountState> {
  if (!clashOpen(config, state, now)) return fail('resource_locked', 'Cross-Server Clash is not open yet');
  const s = prepareClash(config, state, now);
  const c = s.clash!;
  const wd = sourceWeekday(now);
  const round = config.clash.days[String(wd)]?.find((r) => r.step === step);
  if (!round?.bet) return fail('invalid_input', 'no prediction on this round');
  if (now >= roundStart(now, round)) return fail('not_ready', 'predictions close when the round starts');
  const key = betKey(wd, step);
  const prev = c.bets[key];
  if (prev && prev.pick !== pick) return fail('invalid_input', 'you already backed the other player');
  const total = (prev?.stake ?? 0) + stake;
  if (!Number.isInteger(stake) || stake < 1 || total < round.bet.min || total > round.bet.max) return fail('invalid_input', `stake ${round.bet.min}–${round.bet.max} in total`);
  if ((s.currencies.predictionCoin ?? 0) < stake) return fail('insufficient_items', `needs ${stake} Prediction Coins`);
  return ok({ ...s, currencies: { ...s.currencies, predictionCoin: (s.currencies.predictionCoin ?? 0) - stake }, clash: { ...c, bets: { ...c.bets, [key]: { pick, stake: total, settled: false } } } });
}

/** Claim every finished bet: right = stake × 2, wrong = stake × 0.5. */
export function claimBets(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; rewards: Rewards }> {
  const s = prepareClash(config, state, now);
  const c = s.clash!;
  let paid = 0;
  const bets = { ...c.bets };
  for (const [key, b] of Object.entries(c.bets)) {
    if (b.settled) continue;
    const [wd, step] = key.split(':').map(Number) as [number, number];
    const round = config.clash.days[String(wd)]?.find((r) => r.step === step);
    if (!round?.bet) continue;
    const todayWd = sourceWeekday(now);
    const finished = wd < todayWd || (wd === todayWd && now >= roundStart(now, round));
    if (!finished) continue;
    const m = featuredMatch(config, c.week, wd, step);
    paid += Math.floor(b.stake * (m.winner === b.pick ? round.bet.right : round.bet.wrong));
    bets[key] = { ...b, settled: true };
  }
  if (paid === 0) return fail('not_ready', 'no finished predictions to claim');
  const rewards: Rewards = { predictionCoin: paid };
  return ok({ state: applyGrant(config, { ...s, clash: { ...c, bets } }, rewards), rewards });
}

// ---------------------------------------------------------------- View

export interface ClashView {
  open: boolean;
  weekday: number;
  qualified: boolean | null;
  arenaPlace: number;
  sundayQualified: boolean;
  format: string;
  today: { step: number; score: number; contest: number; out: boolean; won: number[]; champion: boolean } | null;
  rounds: { step: number; kind: string; time: string; started: boolean; rewards: Record<string, number>; thirdPlace: boolean; featured: { players: { name: string; power: number }[]; bet: { pick: number; stake: number; settled: boolean } | null; winner: number | null; min: number; max: number } | null }[];
  week: { weekday: number; reached: number; champion: boolean }[];
  coins: number;
  coinsClaimable: boolean;
}

export function buildClashView(config: GameConfig, state: AccountState, now: number): ClashView {
  const s = prepareClash(config, state, now);
  const c = s.clash!;
  const wd = sourceWeekday(now);
  const rounds = config.clash.days[String(wd)] ?? [];
  const today = rounds.length ? dayState(c, wd) : null;
  return {
    open: clashOpen(config, s, now),
    weekday: wd,
    qualified: c.qualified,
    arenaPlace: templePlace(config, s, now),
    sundayQualified: sundayQualified(c),
    format: '1 team · 6v6',
    today,
    rounds: rounds.map((r) => {
      const started = now >= roundStart(now, r);
      const m = r.bet ? featuredMatch(config, c.week, wd, r.step) : null;
      return {
        step: r.step,
        kind: r.kind,
        time: `${String(r.battle[0]).padStart(2, '0')}:${String(r.battle[1]).padStart(2, '0')}`,
        started,
        rewards: r.rewards,
        thirdPlace: r.thirdPlace,
        featured: m && r.bet ? { players: m.players, bet: c.bets[betKey(wd, r.step)] ?? null, winner: started ? m.winner : null, min: r.bet.min, max: r.bet.max } : null,
      };
    }),
    week: Object.entries(c.days).map(([w, d]) => ({ weekday: Number(w), reached: d.won.length, champion: d.champion })),
    coins: s.currencies.predictionCoin ?? 0,
    coinsClaimable: rounds.length > 0 && !c.coinsDays.includes(dayKey(now)),
  };
}
