import { ghostRecords, mulberry32, rankDamage, weekKey, weekdayUtc, type AccountState, type Rewards, type StageEnemy, type WildInstance } from '@wildbound/engine';
import { buildEnemyTeam, buildWildTeam, fielded, runTeams, type BattleView } from './battle';
import type { GameConfig } from './config';
import { applyGrant } from './economy';
import { fail, ok, type Result } from './index';
import { enemiesFor } from './pve/shared';

/**
 * Pokémon Park (source cross_beast_park_*), solo with the M16 guild against CPU players. Weekly season, open Tuesday to
 * Sunday 09:00–21:00 UTC. 30 stamina a day (resets 09:00): move to a neighbouring grid (1), explore (1) for a wild
 * Pokémon (fight or skip for 1) or an egg (4-egg bag; eggs per refresh at 09 / 12 / 14 / 19 h; hatch in 30 min).
 * Grids collapse at 12 / 16 / 19 h. A lost fight faints the whole team for the day (those species can't return until
 * 09:00). The mythical boss appears at 12:15 and 19:15 for 10 minutes: one shared HP bar that CPU players also hit;
 * the last hit takes the boss egg (your guild wins the egg phase). Season: personal score rank vs CPU players.
 * See docs/design/pokemon-park.md.
 */

export type ParkState = NonNullable<AccountState['park']>;
const HOUR = 3_600_000;
const MIN = 60_000;

/** The park's day key: days roll at 09:00 UTC. */
function parkDay(now: number): string {
  return new Date(now - 9 * HOUR).toISOString().slice(0, 10);
}

export function parkOpen(config: GameConfig, now: number): boolean {
  const wd = weekdayUtc(now);
  const h = new Date(now).getUTCHours();
  return wd !== 1 && h >= config.park.hours[0] && h < config.park.hours[1];
}

/** Collapse phase: 0 before 12:00, then 1 / 2 / 3. */
export function collapsePhase(config: GameConfig, now: number): number {
  const h = new Date(now).getUTCHours() + new Date(now).getUTCMinutes() / 60;
  return config.park.collapseHours.filter((c) => h >= c).length;
}

export function collapsed(config: GameConfig, index: number, now: number): boolean {
  const g = config.park.map.find((x) => x.index === index);
  const phase = collapsePhase(config, now);
  return !!g && phase > 0 && g.collapse.includes(phase);
}

/** The boss window running now, if any (key = day + window start). */
export function bossWindow(config: GameConfig, now: number): { key: string; start: number; end: number } | null {
  if (!parkOpen(config, now)) return null;
  const d = new Date(now);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  for (const [h, m] of config.park.boss.windows) {
    const start = midnight + h * HOUR + m * MIN;
    const end = start + config.park.boss.minutes * MIN;
    if (now >= start && now < end) return { key: `${d.toISOString().slice(0, 10)}@${h}:${m}`, start, end };
  }
  return null;
}

function fresh(config: GameConfig, now: number, prev: ParkState | null): ParkState {
  return {
    week: weekKey(now),
    day: parkDay(now),
    grid: null,
    stamina: config.park.stamina.perDay,
    fainted: [],
    pending: null,
    bag: [],
    eggsTaken: {},
    score: 0,
    wins: 0,
    boss: null,
    lastWeek: prev ? { week: prev.week, score: prev.score, claimed: false } : (prev as null),
  };
}

/** Roll week and day; move the player off a collapsed grid. */
export function preparePark(config: GameConfig, state: AccountState, now: number): AccountState {
  let p = state.park;
  if (!p || p.week !== weekKey(now)) p = fresh(config, now, p);
  if (p.day !== parkDay(now)) p = { ...p, day: parkDay(now), stamina: config.park.stamina.perDay, fainted: [], pending: null, grid: null };
  if (p.grid !== null && collapsed(config, p.grid, now)) {
    const open = config.park.map.filter((g) => !collapsed(config, g.index, now));
    const rng = mulberry32((now / MIN) >>> 0);
    p = { ...p, grid: open[Math.floor(rng() * open.length)]?.index ?? null };
  }
  return { ...state, park: p };
}

function guard(config: GameConfig, state: AccountState, now: number): string | null {
  if (!state.guild) return 'join a guild first (Guild)';
  if (!parkOpen(config, now)) return 'the park is open Tuesday to Sunday, 09:00–21:00 UTC';
  return null;
}

/** The park team: the park squad minus species that fainted today. */
export function parkTeam(state: AccountState): WildInstance[] {
  const fainted = new Set(state.park?.fainted ?? []);
  return fielded(state, 'park').filter((w) => !fainted.has(w.speciesId));
}

export function enterPark(config: GameConfig, state: AccountState, now: number, grid: number): Result<AccountState> {
  const g = guard(config, state, now);
  if (g) return fail('resource_locked', g);
  const s = preparePark(config, state, now);
  const p = s.park!;
  if (p.grid !== null) return fail('invalid_input', 'already in the park — move instead');
  if (parkTeam(s).length === 0) return fail('not_found', 'set a Pokémon Park team (fainted species sit out until 09:00)');
  if (!config.park.map.some((x) => x.index === grid) || collapsed(config, grid, now)) return fail('invalid_input', 'pick an open grid');
  return ok({ ...s, park: { ...p, grid } });
}

export function movePark(config: GameConfig, state: AccountState, now: number, grid: number): Result<AccountState> {
  const g = guard(config, state, now);
  if (g) return fail('resource_locked', g);
  const s = preparePark(config, state, now);
  const p = s.park!;
  if (p.grid === null) return fail('invalid_input', 'enter the park first');
  if (p.pending) return fail('invalid_input', 'deal with the wild Pokémon first (fight or skip)');
  const here = config.park.map.find((x) => x.index === p.grid)!;
  if (!here.neighbours.includes(grid) || collapsed(config, grid, now)) return fail('invalid_input', 'move to an open neighbouring grid');
  if (p.stamina < config.park.stamina.move) return fail('insufficient_items', 'no stamina left today');
  return ok({ ...s, park: { ...p, grid, stamina: p.stamina - config.park.stamina.move } });
}

function eggRefreshKey(config: GameConfig, now: number): string {
  const h = new Date(now).getUTCHours();
  const slot = config.park.eggs.refreshHours.filter((x) => h >= x).pop() ?? config.park.eggs.refreshHours[0]!;
  return `${parkDay(now)}@${slot}`;
}

/** Explore the current grid: a wild Pokémon (fight or skip) or an egg. */
export function explorePark(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; found: 'wild' | 'egg' }> {
  const g = guard(config, state, now);
  if (g) return fail('resource_locked', g);
  const t = config.park;
  const s = preparePark(config, state, now);
  let p = s.park!;
  if (p.grid === null) return fail('invalid_input', 'enter the park first');
  if (p.pending) return fail('invalid_input', 'deal with the wild Pokémon first (fight or skip)');
  if (p.stamina < t.stamina.explore) return fail('insufficient_items', 'no stamina left today');
  p = { ...p, stamina: p.stamina - t.stamina.explore };
  const key = eggRefreshKey(config, now);
  const eggsLeft = t.eggs.perRefresh - (p.eggsTaken[key] ?? 0);
  const canEgg = eggsLeft > 0 && p.bag.length < t.eggs.bag;
  const rng = mulberry32(((now / 1000) ^ Math.imul(p.score + p.stamina + 1, 2654435761)) >>> 0);
  const egg = canEgg && rng() * (t.explore.wildWeight + t.explore.eggWeight) >= t.explore.wildWeight;
  if (egg) return ok({ state: { ...s, park: { ...p, bag: [...p.bag, now + t.eggs.hatchMinutes * MIN], eggsTaken: { ...p.eggsTaken, [key]: (p.eggsTaken[key] ?? 0) + 1 } } }, found: 'egg' });
  const quality = config.park.map.find((x) => x.index === p.grid)!.quality;
  return ok({ state: { ...s, park: { ...p, pending: { quality } } }, found: 'wild' });
}

export function skipWild(config: GameConfig, state: AccountState, now: number): Result<AccountState> {
  const s = preparePark(config, state, now);
  const p = s.park!;
  if (!p.pending) return fail('invalid_input', 'nothing to skip');
  if (p.stamina < config.park.stamina.skip) return fail('insufficient_items', 'no stamina left to slip away — fight it');
  return ok({ ...s, park: { ...p, pending: null, stamina: p.stamina - config.park.stamina.skip } });
}

function levelOf(team: WildInstance[]): number {
  return team.length ? Math.round(team.reduce((a, w) => a + w.level, 0) / team.length) : 1;
}

export function wildEnemies(config: GameConfig, state: AccountState, quality: number, seed: number): StageEnemy[] {
  const level = levelOf(parkTeam(state));
  const k = 0.7 + quality * 0.2;
  const spec = { ...config.pve.tower.enemy, count: 2 + quality * 2, baseLevel: Math.max(1, level), levelSlope: 1 };
  return enemiesFor(config, spec, seed % 40).map((e) => ({ ...e, level: Math.max(1, level), mult: { hp: k, atk: k, def: k } }));
}

export interface ParkFight {
  state: AccountState;
  battle: BattleView;
  win: boolean;
  rewards: Rewards;
}

/** Fight the pending wild Pokémon. Win: points and a small reward. Lose: today's team faints and leaves the park. */
export function fightWild(config: GameConfig, state: AccountState, now: number, seed?: number): Result<ParkFight> {
  const s = preparePark(config, state, now);
  const p = s.park!;
  if (!p.pending) return fail('invalid_input', 'explore to find a wild Pokémon first');
  const team = parkTeam(s);
  const attackers = buildWildTeam(team, 'attackers', config, s);
  if (attackers.specs.length === 0) return fail('not_found', 'set a Pokémon Park team');
  const battle = runTeams(attackers, buildEnemyTeam(wildEnemies(config, s, p.pending.quality, (p.grid ?? 1) * 7 + p.wins), config), {
    seed: seed ?? Math.floor(config.rng() * 0xffffffff),
    mode: 'park',
    battleId: `park:${p.week}:${p.day}:${p.grid}:${p.wins}:${p.stamina}`,
    strategies: { attackers: s.strategies.park },
  });
  if (!battle) return fail('not_found', 'set a Pokémon Park team');
  const win = battle.winner === 'attackers';
  const rewards: Rewards = win ? ({ berryEssence: 20 * p.pending.quality, gold: 5000 * p.pending.quality } as Rewards) : {};
  const next: ParkState = win
    ? { ...p, pending: null, score: p.score + config.park.score.wildWin * p.pending.quality, wins: p.wins + 1 }
    : { ...p, pending: null, score: p.score + config.park.score.wildLoss, fainted: [...new Set([...p.fainted, ...team.map((w) => w.speciesId)])], grid: null };
  return ok({ state: applyGrant(config, { ...s, park: next }, rewards), battle, win, rewards });
}

/** Collect hatched eggs. */
export function hatchEggs(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; rewards: Rewards; hatched: number }> {
  const s = preparePark(config, state, now);
  const p = s.park!;
  const ready = p.bag.filter((t) => t <= now).length;
  if (ready === 0) return fail('not_ready', 'no egg has hatched yet');
  const rewards: Rewards = {};
  for (const [k, v] of Object.entries(config.park.eggs.rewards)) (rewards as Record<string, number>)[k] = v * ready;
  return ok({ state: applyGrant(config, { ...s, park: { ...p, bag: p.bag.filter((t) => t > now), score: p.score + ready * config.park.eggs.points } }, rewards), rewards, hatched: ready });
}

// ---------------------------------------------------------------- Boss

export function bossHpLeft(config: GameConfig, p: ParkState, window: { key: string; start: number }, now: number): number {
  const mine = p.boss?.key === window.key ? p.boss.damage : 0;
  const cpu = ((now - window.start) / MIN) * config.park.boss.cpuDamagePerMinute;
  return Math.max(0, Math.round(config.park.boss.hp - cpu - mine));
}

export function parkBossEnemy(config: GameConfig, state: AccountState): StageEnemy[] {
  const level = levelOf(fielded(state, 'park'));
  const spec = { ...config.pve.tower.enemy, count: 1, baseLevel: Math.max(1, level), levelSlope: 1 };
  return enemiesFor(config, spec, 29).map((e) => ({ ...e, level: Math.max(1, level), mult: { hp: 500, atk: 2, def: 2 } }));
}

/** Attack the mythical boss while it is out (10 rounds; your whole park squad, fainted or not — the boss team resets). */
export function attackParkBoss(config: GameConfig, state: AccountState, now: number, seed?: number): Result<{ state: AccountState; battle: BattleView; damage: number; lastHit: boolean; rewards: Rewards }> {
  const g = guard(config, state, now);
  if (g) return fail('resource_locked', g);
  const w = bossWindow(config, now);
  if (!w) return fail('not_ready', 'the boss appears at 12:15 and 19:15 UTC for 10 minutes');
  const s = preparePark(config, state, now);
  let p = s.park!;
  const left = bossHpLeft(config, p, w, now);
  if (left <= 0) return fail('not_ready', 'the boss has been defeated');
  const attackers = buildWildTeam(fielded(s, 'park'), 'attackers', config, s);
  if (attackers.specs.length === 0) return fail('not_found', 'set a Pokémon Park team');
  const battle = runTeams(attackers, buildEnemyTeam(parkBossEnemy(config, s), config), {
    seed: seed ?? Math.floor(config.rng() * 0xffffffff),
    mode: 'park',
    battleId: `park:boss:${w.key}:${p.boss?.attacks ?? 0}`,
    strategies: { attackers: s.strategies.park },
    rules: { roundLimit: config.park.boss.rounds },
  });
  if (!battle) return fail('not_found', 'set a Pokémon Park team');
  const damage = Object.entries(battle.damageDealt)
    .filter(([k]) => k.startsWith('attackers'))
    .reduce((x, [, v]) => x + v, 0);
  const prev = p.boss?.key === w.key ? p.boss : { key: w.key, damage: 0, attacks: 0, score: 0, lastHit: false, claimed: false };
  const lastHit = damage >= left;
  const first = prev.attacks === 0;
  p = { ...p, score: p.score + config.park.boss.battleScore, boss: { ...prev, damage: prev.damage + damage, attacks: prev.attacks + 1, score: prev.score + config.park.boss.battleScore, lastHit: prev.lastHit || lastHit } };
  const rewards = (first ? config.park.boss.joinReward : {}) as Rewards;
  return ok({ state: applyGrant(config, { ...s, park: p }, rewards), battle, damage, lastHit, rewards });
}

function add(a: Rewards, b: Record<string, number>): Rewards {
  const out = { ...a } as Record<string, number>;
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out as Rewards;
}

/** After a boss window: attack-count rewards, the fight rank and the guild's egg-phase rank. */
export function claimParkBoss(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; rewards: Rewards }> {
  const s = preparePark(config, state, now);
  const p = s.park!;
  const b = p.boss;
  if (!b || b.claimed) return fail('not_ready', 'no boss fight to claim');
  const w = bossWindow(config, now);
  if (w && w.key === b.key) return fail('not_ready', 'the boss is still out');
  const t = config.park;
  let rewards: Rewards = {};
  for (const row of t.attackRewards) if (b.attacks >= row.count) rewards = add(rewards, row.rewards);
  const fightRank = rankDamage(b.damage, ghostRecords([t.boss.hp / 12], b.key.length * 131 + b.attacks, 99));
  const fr = t.bossRank.find((r) => fightRank <= r.rank);
  if (fr) rewards = add(rewards, fr.rewards);
  const sr = [...t.scoreRewards].reverse().find((r) => b.score >= r.score && fightRank <= r.rank);
  if (sr) rewards = add(rewards, sr.rewards);
  const guildRank = b.lastHit ? 1 : 10;
  const gr = t.guildRank.find((r) => guildRank <= r.rank);
  if (gr) rewards = add(rewards, gr.rewards);
  return ok({ state: applyGrant(config, { ...s, park: { ...p, boss: { ...b, claimed: true } } }, rewards), rewards });
}

export function parkRank(config: GameConfig, week: string, score: number): number {
  if (score <= 0) return 0;
  const seed = week.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 3) >>> 0;
  return rankDamage(score, ghostRecords([config.park.cpuTopScore], seed, 99));
}

export function claimParkSeason(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; rewards: Rewards }> {
  const s = preparePark(config, state, now);
  const p = s.park!;
  if (!p.lastWeek) return fail('not_ready', 'no finished season yet');
  if (p.lastWeek.claimed) return fail('invalid_input', 'already claimed');
  const rank = parkRank(config, p.lastWeek.week, p.lastWeek.score);
  const row = rank > 0 ? config.park.personalRank.find((r) => rank <= r.rank) : undefined;
  if (!row) return fail('resource_locked', 'no reward at this rank');
  const rewards = row.rewards as Rewards;
  return ok({ state: applyGrant(config, { ...s, park: { ...p, lastWeek: { ...p.lastWeek, claimed: true } } }, rewards), rewards });
}

export interface ParkView {
  joined: boolean;
  open: boolean;
  grid: number | null;
  stamina: number;
  staminaMax: number;
  score: number;
  rank: number;
  pending: { quality: number } | null;
  team: number;
  fainted: string[];
  grids: { index: number; name: string; quality: number; collapsed: boolean; here: boolean; reachable: boolean }[];
  bag: { hatchIn: number }[];
  bagSize: number;
  boss: { out: boolean; hp: number; maxHp: number; endsIn: number; attacks: number; damage: number; claimable: boolean; next: string };
  lastWeek: { rank: number; score: number; claimed: boolean } | null;
}

export function buildParkView(config: GameConfig, state: AccountState, now: number): ParkView {
  const t = config.park;
  const s = preparePark(config, state, now);
  const p = s.park!;
  const here = p.grid !== null ? t.map.find((g) => g.index === p.grid) : undefined;
  const w = bossWindow(config, now);
  const b = p.boss;
  const nextWindow = t.boss.windows.map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`).join(' / ');
  return {
    joined: !!state.guild,
    open: parkOpen(config, now),
    grid: p.grid,
    stamina: p.stamina,
    staminaMax: t.stamina.perDay,
    score: p.score,
    rank: parkRank(config, p.week, p.score),
    pending: p.pending,
    team: parkTeam(s).length,
    fainted: p.fainted.map((id) => config.species.get(id)?.name ?? id),
    grids: t.map.map((g) => {
      const c = collapsed(config, g.index, now);
      return { index: g.index, name: g.name, quality: g.quality, collapsed: c, here: g.index === p.grid, reachable: !c && (p.grid === null || !!here?.neighbours.includes(g.index)) };
    }),
    bag: p.bag.map((at) => ({ hatchIn: Math.max(0, Math.ceil((at - now) / MIN)) })),
    bagSize: t.eggs.bag,
    boss: {
      out: !!w && bossHpLeft(config, p, w, now) > 0,
      hp: w ? bossHpLeft(config, p, w, now) : 0,
      maxHp: t.boss.hp,
      endsIn: w ? Math.ceil((w.end - now) / MIN) : 0,
      attacks: b && w && b.key === w.key ? b.attacks : 0,
      damage: b && w && b.key === w.key ? b.damage : 0,
      claimable: !!b && !b.claimed && !(w && w.key === b.key),
      next: nextWindow,
    },
    lastWeek: p.lastWeek ? { rank: parkRank(config, p.lastWeek.week, p.lastWeek.score), score: p.lastWeek.score, claimed: p.lastWeek.claimed } : null,
  };
}
