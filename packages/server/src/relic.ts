import { mulberry32, weekKey, weekdayUtc, type AccountState, type Rewards, type StageEnemy } from '@wildbound/engine';
import { buildEnemyTeam, buildWildTeam, fielded, runTeams, type BattleView } from './battle';
import type { GameConfig } from './config';
import { applyGrant } from './economy';
import { fail, ok, type Result } from './index';
import { enemiesFor } from './pve/shared';
import { fusionPerk } from './account3';

/**
 * M17 Relic Battlefield (source cross_ancient_battle_*), solo: your guild against three CPU guilds on the source's
 * 91-grid map. Season Tuesday 09:00 → Sunday 22:00 UTC. Attack a grid next to one you hold (10 stamina; 150 max,
 * +1 every 5 min); neutral grids fall after a few wins against their garrison, CPU grids after 3 (their guard teams).
 * Hold up to 12; each scores every 30 minutes. Explore (5 stamina, 2-minute cooldown) rolls the source's events:
 * team damage, healing or stamina. Personal and guild tasks pay Relic Coins; the season places the four guilds by
 * score. See docs/design/guild-war-relic.md.
 */

export type RelicState = NonNullable<AccountState['relic']>;
type Grid = GameConfig['guildWarRelic']['relic']['map'][number];
const HOUR = 3_600_000;
const HALF_HOUR = 1_800_000;
export const PLAYER_BASE = 1;
export const CPU_GUILDS = [
  { name: 'Ember Vanguard', base: 6 },
  { name: 'Tidal Order', base: 86 },
  { name: 'Verdant Pact', base: 91 },
];

function seasonStart(now: number): number {
  const d = new Date(now);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const sinceTue = (weekdayUtc(now) + 5) % 7; // Tue = 0 … Mon = 6
  return midnight - sinceTue * 24 * HOUR + 9 * HOUR;
}

/** The running season's window and day (1–6), or null on Monday / before Tuesday 09:00 / after Sunday 22:00. */
export function relicSeason(now: number): { start: number; end: number; day: number } | null {
  const start = seasonStart(now);
  const end = start + 5 * 24 * HOUR + 13 * HOUR;
  if (now < start || now >= end) return null;
  return { start, end, day: Math.floor((now - start) / (24 * HOUR)) + 1 };
}

function grid(config: GameConfig, index: number): Grid | undefined {
  return config.guildWarRelic.relic.map.find((g) => g.index === index);
}

export function winsNeeded(config: GameConfig, g: Grid, cpu: boolean): number {
  const r = config.guildWarRelic.relic;
  if (cpu) return r.guardTeams;
  const gar = r.garrison[String(g.type)] ?? { monsters: 8, bosses: 2 };
  return Math.max(1, Math.ceil((gar.monsters + gar.bosses) / 3));
}

/** CPU guild holdings: each grows from its base by breadth-first steps (2 a season day), skipping your grids. */
export function cpuHoldings(config: GameConfig, held: readonly number[], day: number): Map<number, number> {
  const owner = new Map<number, number>();
  const mine = new Set(held);
  const cap = config.guildWarRelic.relic.maxHeld;
  const frontier = CPU_GUILDS.map((c, i) => {
    if (!mine.has(c.base)) owner.set(c.base, i);
    return [c.base];
  });
  const counts = CPU_GUILDS.map((c) => (mine.has(c.base) ? 0 : 1));
  for (let step = 0; step < day * 2; step += 1) {
    CPU_GUILDS.forEach((_, i) => {
      if (counts[i]! >= Math.min(cap, 2 + day * 2)) return;
      const next: number[] = [];
      for (const f of frontier[i]!) {
        for (const n of grid(config, f)?.neighbours ?? []) {
          const g = grid(config, n);
          if (!g || g.type === 4 || g.openDay > day || owner.has(n) || mine.has(n) || counts[i]! >= Math.min(cap, 2 + day * 2)) continue;
          owner.set(n, i);
          counts[i]! += 1;
          next.push(n);
        }
      }
      frontier[i] = next.length ? next : frontier[i]!;
    });
  }
  return owner;
}

function fresh(now: number, prev: RelicState | null, config: GameConfig): RelicState {
  const season = relicSeason(now);
  return {
    week: weekKey(now),
    held: [PLAYER_BASE],
    progress: {},
    stamina: config.guildWarRelic.relic.stamina.max,
    staminaAt: now,
    exploreAt: 0,
    condition: 100,
    score: 0,
    scoreAt: season?.start ?? now,
    personal: 0,
    staminaSpent: 0,
    wins: 0,
    explores: 0,
    claimed: [],
    lastWeek: prev ? { week: prev.week, score: prev.score, place: placeOf(config, prev.score, 6), claimed: false } : (prev as null),
  };
}

function scoreRate(config: GameConfig, grids: Iterable<number>): number {
  let r = 0;
  for (const i of grids) r += grid(config, i)?.score ?? 0;
  return r;
}

/** CPU guild season scores at a season day (stand-in: their held grids' rate over the elapsed time). */
export function cpuScores(config: GameConfig, held: readonly number[], day: number, hours: number): number[] {
  const own = cpuHoldings(config, held, day);
  return CPU_GUILDS.map((_, i) => Math.round(scoreRate(config, [...own].filter(([, o]) => o === i).map(([g]) => g)) * hours * 2 * 0.8));
}

function placeOf(config: GameConfig, score: number, day: number): number {
  const cpu = cpuScores(config, [PLAYER_BASE], day, 24 * 5 + 13);
  return 1 + cpu.filter((c) => c > score).length;
}

/** Roll the season and settle stamina and score up to now. */
export function prepareRelic(config: GameConfig, state: AccountState, now: number): AccountState {
  const r = config.guildWarRelic.relic;
  let rs = state.relic;
  if (!rs || rs.week !== weekKey(now)) rs = fresh(now, rs, config);
  const step = (r.stamina.regenMinutes * 60_000) / (1 + fusionPerk(config, state, 'Relic Battlefield') / 100);
  const regen = Math.floor((now - rs.staminaAt) / step);
  if (regen > 0) rs = { ...rs, stamina: Math.min(r.stamina.max, rs.stamina + regen), staminaAt: rs.stamina + regen >= r.stamina.max ? now : rs.staminaAt + regen * step };
  const season = relicSeason(now);
  const until = Math.min(now, season?.end ?? now);
  const ticks = Math.floor((until - rs.scoreAt) / HALF_HOUR);
  if (ticks > 0) rs = { ...rs, score: rs.score + ticks * scoreRate(config, rs.held), scoreAt: rs.scoreAt + ticks * HALF_HOUR };
  return { ...state, relic: rs };
}

function spendStamina(rs: RelicState, n: number): RelicState | null {
  return rs.stamina < n ? null : { ...rs, stamina: rs.stamina - n, staminaSpent: rs.staminaSpent + n };
}

export function garrison(config: GameConfig, state: AccountState, g: Grid, cpu: boolean): StageEnemy[] {
  const team = fielded(state, 'relic');
  const level = team.length ? Math.round(team.reduce((a, w) => a + w.level, 0) / team.length) : 1;
  const k = 0.75 + g.type * 0.12 + (cpu ? 0.25 : 0);
  const spec = { ...config.pve.tower.enemy, count: 6, baseLevel: Math.max(1, level), levelSlope: 1 };
  return enemiesFor(config, spec, g.index % 40).map((e) => ({ ...e, level: Math.max(1, level), mult: { hp: k, atk: k, def: k } }));
}

export interface RelicAttack {
  state: AccountState;
  battle: BattleView;
  win: boolean;
  captured: boolean;
}

/** Attack a grid next to one you hold. */
export function attackGrid(config: GameConfig, state: AccountState, now: number, index: number, seed?: number): Result<RelicAttack> {
  const season = relicSeason(now);
  if (!state.guild) return fail('resource_locked', 'join a guild first (Guild)');
  if (!season) return fail('not_ready', 'the battlefield is open Tuesday 09:00 to Sunday 22:00 UTC');
  const r = config.guildWarRelic.relic;
  let s = prepareRelic(config, state, now);
  let rs = s.relic!;
  const g = grid(config, index);
  if (!g || g.type === 4) return fail('invalid_input', 'that grid cannot be taken');
  if (g.openDay > season.day) return fail('not_ready', `this grid opens on season day ${g.openDay}`);
  if (rs.held.includes(index)) return fail('invalid_input', 'you already hold it');
  if (!rs.held.some((h) => grid(config, h)?.neighbours.includes(index))) return fail('invalid_input', 'attack a grid next to one you hold');
  if (rs.held.length >= r.maxHeld) return fail('at_level_cap', `you can hold ${r.maxHeld} grids`);
  const paid = spendStamina(rs, r.stamina.attack);
  if (!paid) return fail('insufficient_items', `needs ${r.stamina.attack} stamina`);
  rs = paid;
  const cpu = cpuHoldings(config, rs.held, season.day).has(index);
  const attackers = buildWildTeam(fielded(s, 'relic'), 'attackers', config, s);
  if (attackers.specs.length === 0) return fail('not_found', 'set a Relic Battlefield team first');
  const k = rs.condition / 100;
  for (const sp of attackers.specs) sp.sheet = { ...sp.sheet, hp: Math.max(1, Math.round(sp.sheet.hp * k)) };
  const battle = runTeams(attackers, buildEnemyTeam(garrison(config, s, g, cpu), config), {
    seed: seed ?? Math.floor(config.rng() * 0xffffffff),
    mode: 'relic',
    battleId: `m17:relic:${rs.week}:${index}:${rs.wins}:${rs.personal}`,
    strategies: { attackers: s.strategies.relic },
  });
  if (!battle) return fail('not_found', 'set a Relic Battlefield team first');
  const win = battle.winner === 'attackers';
  let captured = false;
  rs = { ...rs, personal: rs.personal + (win ? r.score.win : r.score.loss), wins: rs.wins + (win ? 1 : 0) };
  if (win) {
    const p = (rs.progress[String(index)] ?? 0) + 1;
    rs = { ...rs, progress: { ...rs.progress, [String(index)]: p } };
    if (p >= winsNeeded(config, g, cpu)) {
      rs = { ...rs, held: [...rs.held, index], progress: { ...rs.progress, [`ever:${index}`]: 1 } };
      captured = true;
    }
  }
  s = { ...s, relic: rs };
  return ok({ state: s, battle, win, captured });
}

/** Give up a held grid (not your base) to free a slot. */
export function releaseGrid(config: GameConfig, state: AccountState, now: number, index: number): Result<AccountState> {
  const s = prepareRelic(config, state, now);
  const rs = s.relic!;
  if (index === PLAYER_BASE || !rs.held.includes(index)) return fail('invalid_input', 'not a grid you can release');
  return ok({ ...s, relic: { ...rs, held: rs.held.filter((h) => h !== index), progress: { ...rs.progress, [String(index)]: 0 } } });
}

/** Explore (5 stamina, 2-minute cooldown): a weighted source event. */
export function exploreRelic(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; event: { id: number; type: number; value: number } }> {
  if (!relicSeason(now)) return fail('not_ready', 'the battlefield is closed');
  if (!state.guild) return fail('resource_locked', 'join a guild first (Guild)');
  const r = config.guildWarRelic.relic;
  const s = prepareRelic(config, state, now);
  let rs = s.relic!;
  if (now - rs.exploreAt < r.exploreCooldownSec * 1000) return fail('not_ready', 'still exploring — wait a moment');
  const paid = spendStamina(rs, r.stamina.explore);
  if (!paid) return fail('insufficient_items', `needs ${r.stamina.explore} stamina`);
  rs = paid;
  const rng = mulberry32((now ^ Math.imul(rs.explores + 1, 2654435761)) >>> 0);
  const total = r.events.reduce((a, e) => a + e.weight, 0);
  let x = rng() * total;
  const ev = r.events.find((e) => (x -= e.weight) < 0) ?? r.events[r.events.length - 1]!;
  if (ev.type === 3) rs = { ...rs, condition: Math.max(10, Math.round(rs.condition * (1 - ev.value / 100))) };
  else if (ev.type === 4) rs = { ...rs, condition: Math.min(100, Math.round(rs.condition + ((100 - rs.condition) * ev.value) / 100 + ev.value / 5)) };
  else if (ev.type === 5) rs = { ...rs, stamina: Math.min(r.stamina.max, rs.stamina + ev.value) };
  rs = { ...rs, explores: rs.explores + 1, exploreAt: now };
  return ok({ state: { ...s, relic: rs }, event: { id: ev.id, type: ev.type, value: ev.value } });
}

/** Task progress by source event type. */
export function taskProgress(config: GameConfig, rs: RelicState, event: number): number {
  const ever = Object.keys(rs.progress)
    .filter((k) => k.startsWith('ever:'))
    .map((k) => grid(config, Number(k.slice(5))))
    .filter((g): g is Grid => !!g);
  const core = Math.max(...config.guildWarRelic.relic.map.map((g) => g.score));
  switch (event) {
    case 1:
      return rs.staminaSpent;
    case 2:
      return rs.explores;
    case 3:
      return rs.wins;
    case 4:
      return ever.length;
    case 5:
      return ever.filter((g) => g.type === 2 || g.type === 3 || g.type === 5).length;
    case 6:
      return ever.filter((g) => g.type === 3).length;
    case 7:
      return ever.filter((g) => g.type === 5).length;
    case 8:
      return ever.filter((g) => g.score === core).length;
    default:
      return 0;
  }
}

export function claimRelicTask(config: GameConfig, state: AccountState, now: number, id: number): Result<{ state: AccountState; rewards: Rewards }> {
  const s = prepareRelic(config, state, now);
  const rs = s.relic!;
  const task = config.guildWarRelic.relic.tasks.find((t) => t.id === id);
  if (!task) return fail('not_found', 'no such task');
  if (rs.claimed.includes(id)) return fail('invalid_input', 'already claimed');
  if (taskProgress(config, rs, task.event) < task.target) return fail('resource_locked', 'not done yet');
  const rewards = task.rewards as Rewards;
  return ok({ state: applyGrant(config, { ...s, relic: { ...rs, claimed: [...rs.claimed, id] } }, rewards), rewards });
}

export function claimRelicSeason(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; rewards: Rewards }> {
  const s = prepareRelic(config, state, now);
  const rs = s.relic!;
  if (!rs.lastWeek) return fail('not_ready', 'no finished season yet');
  if (rs.lastWeek.claimed) return fail('invalid_input', 'already claimed');
  const row = config.guildWarRelic.relic.placeRewards.find((p) => p.place === rs.lastWeek!.place);
  if (!row) return fail('resource_locked', 'no reward at this place');
  const rewards = row.rewards as Rewards;
  return ok({ state: applyGrant(config, { ...s, relic: { ...rs, lastWeek: { ...rs.lastWeek, claimed: true } } }, rewards), rewards });
}

export interface RelicBattlefieldView {
  joined: boolean;
  open: boolean;
  day: number;
  stamina: number;
  staminaMax: number;
  condition: number;
  exploreReadyIn: number;
  score: number;
  personal: number;
  grids: { index: number; type: number; score: number; openDay: number; owner: 'you' | 'neutral' | 'blocked' | string; attackable: boolean; progress: number; needed: number }[];
  standings: { name: string; score: number; you: boolean }[];
  tasks: { id: number; scope: string; event: number; target: number; progress: number; rewards: Record<string, number>; claimed: boolean }[];
  lastWeek: { place: number; score: number; claimed: boolean } | null;
}

export function buildRelicView(config: GameConfig, state: AccountState, now: number): RelicBattlefieldView {
  const r = config.guildWarRelic.relic;
  const s = prepareRelic(config, state, now);
  const rs = s.relic!;
  const season = relicSeason(now);
  const day = season?.day ?? 6;
  const cpu = cpuHoldings(config, rs.held, day);
  const hours = season ? (now - season.start) / HOUR : 24 * 5 + 13;
  const cpuScore = cpuScores(config, rs.held, day, hours);
  const standings = [{ name: state.guild?.name ?? 'Your guild', score: rs.score, you: true }, ...CPU_GUILDS.map((c, i) => ({ name: c.name, score: cpuScore[i]!, you: false }))].sort((a, b) => b.score - a.score);
  return {
    joined: !!state.guild,
    open: !!season,
    day,
    stamina: rs.stamina,
    staminaMax: r.stamina.max,
    condition: rs.condition,
    exploreReadyIn: Math.max(0, Math.ceil((rs.exploreAt + r.exploreCooldownSec * 1000 - now) / 1000)),
    score: rs.score,
    personal: rs.personal,
    grids: r.map.map((g) => {
      const mine = rs.held.includes(g.index);
      const o = cpu.get(g.index);
      const owner = mine ? 'you' : g.type === 4 ? 'blocked' : o !== undefined ? CPU_GUILDS[o]!.name : 'neutral';
      const attackable = !!season && !mine && g.type !== 4 && g.openDay <= day && rs.held.some((h) => grid(config, h)?.neighbours.includes(g.index));
      return { index: g.index, type: g.type, score: g.score, openDay: g.openDay, owner, attackable, progress: rs.progress[String(g.index)] ?? 0, needed: winsNeeded(config, g, o !== undefined) };
    }),
    standings,
    tasks: r.tasks.map((t) => ({ id: t.id, scope: t.scope, event: t.event, target: t.target, progress: taskProgress(config, rs, t.event), rewards: t.rewards, claimed: rs.claimed.includes(t.id) })),
    lastWeek: rs.lastWeek ? { place: rs.lastWeek.place, score: rs.lastWeek.score, claimed: rs.lastWeek.claimed } : null,
  };
}
