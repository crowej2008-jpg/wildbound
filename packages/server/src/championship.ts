import { ghostRecords, mulberry32, rankDamage, weekKey, weekdayUtc, type AccountState, type Rewards, type StageEnemy } from '@wildbound/engine';
import { buildEnemyTeam, buildWildTeam, fielded, runTeams, type BattleView } from './battle';
import type { GameConfig } from './config';
import { applyGrant } from './economy';
import { fail, ok, type Result } from './index';
import { rankedTuning, rankedUnlocked } from './pvp';
import { rolledRanked } from './pvp/ranked';
import { enemiesFor } from './pve/shared';

/**
 * M18.3 championships, solo against CPU players (squad `championship`).
 *
 * World Championship (source world_tournament_*): a two-week cycle. Week 1: the Poké Ball / Great Ball / Ultra Ball
 * floor ladders open Tuesday / Wednesday / Friday 08:00 UTC in your league (by your squad's highest level); floors
 * cleared rank you against 60 CPU players. At Sunday 14:00 the top 8 enter the Master Ball knockout (14:30, 16:30,
 * 18:30). From Sunday 22:00 the league's rank reward can be claimed until the next cycle starts.
 *
 * League Championship (owner's wiki "pvp-champ"): weekly from server day 14 for Ranked players in the top tier.
 * Thursday: round of 64 (5 battles, 3 losses out); Friday: group stage (7 battles, 5 wins to advance); Saturday: Top 16
 * and quarterfinal; Sunday: semifinal and final. Each day's matches open at 20:00 UTC. Placement pays Arena Tokens
 * (Rank Tokens in the source). Predictions in Tropical Shells are not built. See docs/design/championship.md.
 */

export type ChampionshipState = NonNullable<AccountState['championship']>;
const DAY = 86_400_000;
const HOUR = 3_600_000;
const MIN = 60_000;

function weekdaySrc(now: number): number {
  const d = weekdayUtc(now);
  return d === 0 ? 7 : d;
}

function mondayOf(now: number): number {
  const d = new Date(now);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return midnight - (weekdaySrc(now) - 1) * DAY;
}

/** The cycle key (its first Monday) and whether this is the play week. */
export function worldCycle(config: GameConfig, now: number): { key: string; playWeek: boolean; monday: number } {
  const anchor = Date.parse(config.championship.world.anchorMonday);
  const weeks = Math.floor((mondayOf(now) - anchor) / (7 * DAY));
  const first = anchor + (weeks - (((weeks % 2) + 2) % 2)) * 7 * DAY;
  return { key: new Date(first).toISOString().slice(0, 10), playWeek: (((weeks % 2) + 2) % 2) === 0, monday: first };
}

function at(monday: number, wd: number, h: number, m = 0): number {
  return monday + (wd - 1) * DAY + h * HOUR + m * MIN;
}

function groupFor(config: GameConfig, state: AccountState): number {
  const top = Math.max(1, ...fielded(state, 'championship').map((w) => w.level));
  let g = config.championship.world.leagues[0]!.group;
  for (const l of config.championship.world.leagues) if (top >= l.minLevel) g = l.group;
  return g;
}

function freshLeague(week: string): ChampionshipState['league'] {
  return { week, qualified: null, days: {}, place: null, claimed: false };
}

function totalFloors(c: ChampionshipState): number {
  return Object.values(c.floors).reduce((a, b) => a + b, 0);
}

/** Rank among the CPU field by floors cleared. */
export function worldRank(config: GameConfig, c: ChampionshipState): number {
  const w = config.championship.world;
  const max = w.tiers.reduce((a, t) => a + (w.floors[`${c.group}:${t.stage}`]?.length ?? 0), 0);
  const score = totalFloors(c);
  if (score <= 0) return w.field + 1;
  const seed = c.cycle.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), c.group) >>> 0;
  return Math.min(w.field + 1, rankDamage(score, ghostRecords([Math.round(max * w.cpuShare)], seed, w.field - 1)));
}

function finalPlace(config: GameConfig, c: ChampionshipState): number {
  if (c.ko.place !== null) return c.ko.place;
  return worldRank(config, c);
}

export function prepareChampionship(config: GameConfig, state: AccountState, now: number): AccountState {
  const cyc = worldCycle(config, now);
  let c = state.championship;
  if (!c || c.cycle !== cyc.key) {
    const last = c && totalFloors(c) > 0 ? { cycle: c.cycle, group: c.group, place: finalPlace(config, c), claimed: false } : (c?.last ?? null);
    c = { cycle: cyc.key, group: groupFor(config, state), floors: {}, ko: { step: 0, out: false, place: null }, last: last && last.cycle !== cyc.key ? last : null, league: c?.league ?? freshLeague(weekKey(now)) };
  }
  if (c.league.week !== weekKey(now)) c = { ...c, league: freshLeague(weekKey(now)) };
  return { ...state, championship: c };
}

function team(config: GameConfig, state: AccountState, level: number, mult: number, seed: number): StageEnemy[] {
  const spec = { ...config.pve.tower.enemy, count: 6, baseLevel: Math.max(1, level), levelSlope: 1 };
  return enemiesFor(config, spec, seed % 40).map((e) => ({ ...e, level: Math.max(1, level), mult: { hp: mult, atk: mult, def: mult } }));
}

function fight(config: GameConfig, s: AccountState, enemies: StageEnemy[], id: string, seed?: number): BattleView | null {
  const attackers = buildWildTeam(fielded(s, 'championship'), 'attackers', config, s);
  if (attackers.specs.length === 0) return null;
  return runTeams(attackers, buildEnemyTeam(enemies, config), { seed: seed ?? Math.floor(config.rng() * 0xffffffff), mode: 'championship', battleId: id, strategies: { attackers: s.strategies.championship } });
}

// ---------------------------------------------------------------- World Championship

/** Climb the next floor of a tier (stage 1 / 2 / 3) during the play week, until Sunday 14:00. */
export function climbWorldFloor(config: GameConfig, state: AccountState, now: number, stage: number, seed?: number): Result<{ state: AccountState; battle: BattleView; win: boolean; rewards: Rewards }> {
  const w = config.championship.world;
  const cyc = worldCycle(config, now);
  if (!cyc.playWeek) return fail('not_ready', 'this is the reward week — the next championship starts next Monday');
  const tier = w.tiers.find((t) => t.stage === stage);
  if (!tier) return fail('invalid_input', 'no such tier');
  if (now < at(cyc.monday, tier.opens[0], tier.opens[1])) return fail('not_ready', `${tier.name} opens later this week`);
  if (now >= at(cyc.monday, w.lock[0], w.lock[1])) return fail('not_ready', 'the ladders closed for the Master Ball knockout');
  let s = prepareChampionship(config, state, now);
  const c = s.championship!;
  const list = w.floors[`${c.group}:${stage}`] ?? [];
  const done = c.floors[String(stage)] ?? 0;
  const floor = list[done];
  if (!floor) return fail('at_level_cap', 'every floor of this tier is cleared');
  if (fielded(s, 'championship').length === 0) return fail('not_found', 'set a Championship team first');
  const battle = fight(config, s, team(config, s, floor.level, 1, c.group * 31 + stage * 7 + floor.floor), `m18:wc:${c.cycle}:${stage}:${floor.floor}`, seed);
  if (!battle) return fail('not_found', 'set a Championship team first');
  const win = battle.winner === 'attackers';
  const rewards = (win ? floor.rewards : {}) as Rewards;
  if (win) s = applyGrant(config, { ...s, championship: { ...c, floors: { ...c.floors, [String(stage)]: done + 1 } } }, rewards);
  return ok({ state: s, battle, win, rewards });
}

/** Play the next Master Ball knockout round (top 8 only, from its start time on Sunday). */
export function playWorldKnockout(config: GameConfig, state: AccountState, now: number, seed?: number): Result<{ state: AccountState; battle: BattleView; win: boolean; place: number | null }> {
  const w = config.championship.world;
  const cyc = worldCycle(config, now);
  let s = prepareChampionship(config, state, now);
  let c = s.championship!;
  if (!cyc.playWeek || now < at(cyc.monday, w.lock[0], w.lock[1])) return fail('not_ready', 'the Master Ball knockout is on Sunday from 14:30 UTC');
  if (worldRank(config, c) > 8) return fail('resource_locked', 'only the top 8 of the ladders enter the knockout');
  if (c.ko.out || c.ko.place !== null) return fail('invalid_input', 'your knockout is over');
  const round = w.knockout[c.ko.step];
  if (!round) return fail('invalid_input', 'your knockout is over');
  if (now < at(cyc.monday, round[0], round[1], round[2])) return fail('not_ready', `this round starts at ${round[1]}:${String(round[2]).padStart(2, '0')} UTC`);
  if (now >= at(cyc.monday, w.settle[0], w.settle[1])) return fail('not_ready', 'the championship has been settled');
  const top = Math.max(1, ...fielded(s, 'championship').map((x) => x.level));
  const battle = fight(config, s, team(config, s, top, 1.05 + 0.1 * c.ko.step, 97 + c.ko.step), `m18:wc:ko:${c.cycle}:${c.ko.step}`, seed);
  if (!battle) return fail('not_found', 'set a Championship team first');
  const win = battle.winner === 'attackers';
  const placeIfOut = [5, 3, 2][c.ko.step]!;
  const last = c.ko.step === w.knockout.length - 1;
  c = { ...c, ko: win ? { step: c.ko.step + 1, out: false, place: last ? 1 : null } : { step: c.ko.step, out: true, place: placeIfOut } };
  s = { ...s, championship: c };
  return ok({ state: s, battle, win, place: c.ko.place });
}

/** Claim the league's rank reward once the cycle's play week is settled (Sunday 22:00 → end of the reward week). */
export function claimWorldReward(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; rewards: Rewards }> {
  const w = config.championship.world;
  const cyc = worldCycle(config, now);
  const s = prepareChampionship(config, state, now);
  const c = s.championship!;
  const settled = !cyc.playWeek || now >= at(cyc.monday, w.settle[0], w.settle[1]);
  let place: number;
  let group: number;
  let next: ChampionshipState;
  if (settled && totalFloors(c) > 0 && !(c.last?.cycle === c.cycle && c.last.claimed)) {
    place = finalPlace(config, c);
    group = c.group;
    next = { ...c, last: { cycle: c.cycle, group, place, claimed: true } };
  } else if (c.last && !c.last.claimed) {
    place = c.last.place;
    group = c.last.group;
    next = { ...c, last: { ...c.last, claimed: true } };
  } else return fail('not_ready', 'nothing to claim yet — results settle on Sunday at 22:00 UTC');
  const row = (w.rank[String(group)] ?? []).find((r) => place >= r.min && place <= r.max);
  if (!row) return fail('resource_locked', 'no reward at this place');
  const rewards = row.rewards as Rewards;
  return ok({ state: applyGrant(config, { ...s, championship: next }, rewards), rewards });
}

// ---------------------------------------------------------------- League Championship

export function leagueOpen(config: GameConfig, state: AccountState, now: number): boolean {
  const day = Math.floor((now - state.serverEpoch) / DAY) + 1;
  return day >= config.championship.league.serverDay && rankedUnlocked(config, state);
}

function leagueQualifies(config: GameConfig, state: AccountState, now: number): boolean {
  const r = rolledRanked(config, state, now);
  return r.tier >= rankedTuning(config).tiers.length - 1;
}

/** Play today's League Championship matches (from 20:00 UTC on Thursday–Sunday). */
export function playLeagueDay(config: GameConfig, state: AccountState, now: number, seed?: number): Result<{ state: AccountState; battles: BattleView[]; passed: boolean; place: number | null }> {
  if (!leagueOpen(config, state, now)) return fail('resource_locked', 'the League Championship opens on server day 14 with Ranked');
  const L = config.championship.league;
  let s = prepareChampionship(config, state, now);
  let c = s.championship!;
  let lg = c.league;
  const wd = weekdaySrc(now);
  const day = L.days[String(wd)];
  if (!day) return fail('not_ready', 'the League Championship runs Thursday to Sunday');
  if (lg.qualified === null) lg = { ...lg, qualified: wd === 4 && leagueQualifies(config, s, now) };
  if (!lg.qualified) return fail('resource_locked', 'only top-tier Ranked players who entered on Thursday take part this week');
  if (new Date(now).getUTCHours() < L.resolveHour) return fail('not_ready', `today's matches start at ${L.resolveHour}:00 UTC`);
  if (lg.place !== null) return fail('invalid_input', 'your championship is over');
  const prevOk = Object.keys(L.days)
    .map(Number)
    .filter((d) => d < wd)
    .every((d) => lg.days[String(d)]?.passed);
  if (!prevOk) return fail('resource_locked', 'you were knocked out earlier this week');
  const st = lg.days[String(wd)] ?? { played: 0, wins: 0, losses: 0, done: false, passed: false };
  if (st.done) return fail('invalid_input', "today's matches are done");
  const stage = Object.keys(L.days).indexOf(String(wd));
  const top = Math.max(1, ...fielded(s, 'championship').map((x) => x.level));
  const rng = mulberry32(((now / MIN) | 0) >>> 0);
  const battles: BattleView[] = [];
  let { wins, losses } = st;
  let passed = false;
  let place: number | null = null;
  const count = day.kind === 'ko' ? (day.rounds ?? []).length : (day.battles ?? 1);
  for (let i = 0; i < count; i += 1) {
    const mult = L.cpu.base + L.cpu.perStage * stage + rng() * 0.1;
    const b = fight(config, s, team(config, s, top, mult, 53 + stage * 9 + i), `m18:lc:${lg.week}:${wd}:${i}`, seed !== undefined ? seed + i : undefined);
    if (!b) return fail('not_found', 'set a Championship team first');
    battles.push(b);
    if (b.winner === 'attackers') wins += 1;
    else losses += 1;
    if (day.kind === 'r64' && losses >= (day.losses ?? 3)) break;
    if (day.kind === 'ko' && b.winner !== 'attackers') break;
  }
  if (day.kind === 'r64') passed = losses < (day.losses ?? 3);
  else if (day.kind === 'groups') passed = wins >= (day.need ?? 5);
  else passed = losses === 0;
  if (!passed) {
    // Eliminated: the place follows the stage reached.
    place = day.kind === 'ko' ? (wd === 7 ? (wins === 1 ? 2 : 4) : wins === 1 ? 8 : 16) : day.kind === 'groups' ? 32 : 64;
  } else if (wd === 7) place = 1;
  lg = { ...lg, days: { ...lg.days, [String(wd)]: { played: battles.length, wins, losses, done: true, passed } }, place };
  c = { ...c, league: lg };
  s = { ...s, championship: c };
  return ok({ state: s, battles, passed, place });
}

export function claimLeagueReward(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; rewards: Rewards }> {
  const s = prepareChampionship(config, state, now);
  const c = s.championship!;
  const lg = c.league;
  if (lg.place === null) return fail('not_ready', 'your placement is not decided yet');
  if (lg.claimed) return fail('invalid_input', 'already claimed');
  const row = config.championship.league.placements.find((p) => lg.place! <= p.place);
  if (!row) return fail('resource_locked', 'no reward at this placement');
  return ok({ state: applyGrant(config, { ...s, championship: { ...c, league: { ...lg, claimed: true } } }, row.rewards as Rewards), rewards: row.rewards as Rewards });
}

// ---------------------------------------------------------------- View

export interface ChampionshipView {
  world: {
    cycle: string;
    playWeek: boolean;
    group: number;
    tiers: { stage: number; name: string; open: boolean; cleared: number; total: number; next: { floor: number; level: number; rewards: Record<string, number> } | null }[];
    rank: number;
    field: number;
    knockout: { eligible: boolean; step: number; out: boolean; place: number | null; nextAt: string | null };
    claimable: boolean;
  };
  league: { open: boolean; qualified: boolean | null; today: number; days: { weekday: number; kind: string; played: number; wins: number; losses: number; done: boolean; passed: boolean }[]; place: number | null; claimable: boolean };
}

export function buildChampionshipView(config: GameConfig, state: AccountState, now: number): ChampionshipView {
  const w = config.championship.world;
  const cyc = worldCycle(config, now);
  const s = prepareChampionship(config, state, now);
  const c = s.championship!;
  const lock = at(cyc.monday, w.lock[0], w.lock[1]);
  const settledNow = !cyc.playWeek || now >= at(cyc.monday, w.settle[0], w.settle[1]);
  const round = w.knockout[c.ko.step];
  return {
    world: {
      cycle: c.cycle,
      playWeek: cyc.playWeek,
      group: c.group,
      tiers: w.tiers.map((t) => {
        const list = w.floors[`${c.group}:${t.stage}`] ?? [];
        const cleared = c.floors[String(t.stage)] ?? 0;
        const next = list[cleared];
        return { stage: t.stage, name: t.name, open: cyc.playWeek && now >= at(cyc.monday, t.opens[0], t.opens[1]) && now < lock, cleared, total: list.length, next: next ? { floor: next.floor, level: next.level, rewards: next.rewards } : null };
      }),
      rank: worldRank(config, c),
      field: w.field,
      knockout: { eligible: worldRank(config, c) <= 8, step: c.ko.step, out: c.ko.out, place: c.ko.place, nextAt: round ? `${round[1]}:${String(round[2]).padStart(2, '0')}` : null },
      claimable: (settledNow && totalFloors(c) > 0 && !(c.last?.cycle === c.cycle && c.last.claimed)) || (!!c.last && !c.last.claimed && c.last.cycle !== c.cycle),
    },
    league: {
      open: leagueOpen(config, s, now),
      qualified: c.league.qualified,
      today: weekdaySrc(now),
      days: Object.entries(config.championship.league.days).map(([wd, d]) => ({ weekday: Number(wd), kind: d.kind, ...(c.league.days[wd] ?? { played: 0, wins: 0, losses: 0, done: false, passed: false }) })),
      place: c.league.place,
      claimable: c.league.place !== null && !c.league.claimed,
    },
  };
}
