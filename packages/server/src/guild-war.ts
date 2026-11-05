import { activityPoints, dayKey, ghostRecords, rankDamage, weekKey, type AccountState, type Rewards, type StageEnemy } from '@wildbound/engine';
import { buildEnemyTeam, buildWildTeam, fielded, runTeams, type BattleView } from './battle';
import type { GameConfig } from './config';
import { applyGrant } from './economy';
import { grantTitleCards } from './titles';
import { fail, ok, type Result } from './index';
import { enemiesFor } from './pve/shared';

/**
 * M17 Guild War (source cross_guild_boss_*), solo with the M16 CPU guild. Each weekly season the guild faces 5 bosses;
 * each has 5 rounds of HP per difficulty, 15 difficulties, then the endless stage (no kills, damage only). Attempts
 * come from daily activity points (30 / 60 / 100 → up to 3 a day). Every battle pays Guild Chests (as Guild Tokens);
 * a kill pays more. CPU members add damage each day. Ranks: daily inside the guild, season personal and guild
 * (CPU ladders). See docs/design/guild-war-relic.md.
 */

export type GuildWarState = NonNullable<AccountState['guildWar']>;
const DAY = 86_400_000;

function roundHp(config: GameConfig, difficulty: number): number {
  const h = config.guildWarRelic.guildWar.roundHp;
  return Math.round(h.base * Math.pow(h.growth, difficulty - 1));
}

function fresh(config: GameConfig, now: number, prev: GuildWarState | null): GuildWarState {
  const t = config.guildWarRelic.guildWar;
  return {
    week: weekKey(now),
    difficulty: 1,
    bosses: Array.from({ length: t.bosses }, () => ({ round: 1, hp: roundHp(config, 1) })),
    damage: 0,
    dayKey: dayKey(now),
    dayDamage: 0,
    used: 0,
    cpuDay: dayKey(now),
    dailyClaimed: prev?.dailyClaimed ?? '',
    seasonClaimed: prev?.seasonClaimed ?? '',
    lastWeek: prev ? { week: prev.week, damage: prev.damage, difficulty: prev.difficulty } : (null as GuildWarState['lastWeek']),
    lastDay: prev && prev.dayDamage > 0 ? { day: prev.dayKey, damage: prev.dayDamage } : (prev?.lastDay ?? null),
  };
}

/** Apply damage to a boss: kills when the round's HP runs out; difficulty rises once every boss clears its rounds. */
function hit(config: GameConfig, gw: GuildWarState, boss: number, damage: number): { gw: GuildWarState; kills: number } {
  const t = config.guildWarRelic.guildWar;
  if (gw.difficulty > t.difficulties) return { gw, kills: 0 };
  const bosses = gw.bosses.map((b) => ({ ...b }));
  let left = damage;
  let kills = 0;
  const b = bosses[boss]!;
  while (left > 0 && b.round <= t.rounds) {
    if (left >= b.hp) {
      left -= b.hp;
      kills += 1;
      b.round += 1;
      b.hp = b.round <= t.rounds ? roundHp(config, gw.difficulty) : 0;
    } else {
      b.hp -= left;
      left = 0;
    }
  }
  let next = { ...gw, bosses };
  if (bosses.every((x) => x.round > t.rounds)) {
    const difficulty = gw.difficulty + 1;
    next = { ...next, difficulty, bosses: bosses.map(() => ({ round: 1, hp: difficulty <= t.difficulties ? roundHp(config, difficulty) : 0 })) };
  }
  return { gw: next, kills };
}

/** Roll the season and the day; CPU members add their damage for each day passed (spread over the bosses). */
export function prepareGuildWar(config: GameConfig, state: AccountState, now: number): AccountState {
  if (!state.guild) return state;
  let gw = state.guildWar;
  if (!gw || gw.week !== weekKey(now)) gw = fresh(config, now, gw);
  const today = dayKey(now);
  if (gw.dayKey !== today) gw = { ...gw, lastDay: { day: gw.dayKey, damage: gw.dayDamage }, dayKey: today, dayDamage: 0, used: 0 };
  if (gw.cpuDay !== today) {
    const days = Math.min(7, Math.max(1, Math.round((Date.parse(today) - Date.parse(gw.cpuDay)) / DAY)));
    const t = config.guildWarRelic.guildWar;
    for (let d = 0; d < days; d += 1) for (let i = 0; i < t.bosses; i += 1) gw = hit(config, gw, i, t.cpuDamagePerDay / t.bosses).gw;
    gw = { ...gw, cpuDay: today };
  }
  return { ...state, guildWar: gw };
}

export function attemptsToday(config: GameConfig, state: AccountState, now: number): { earned: number; used: number } {
  const quests = state.quests.day === dayKey(now) ? state.quests : { ...state.quests, claimed: [] };
  const points = activityPoints(config.quests, quests);
  const earned = config.guildWarRelic.guildWar.activity.filter((a) => points >= a).length;
  const used = state.guildWar && state.guildWar.dayKey === dayKey(now) ? state.guildWar.used : 0;
  return { earned, used };
}

export function bossEnemy(config: GameConfig, state: AccountState, boss: number): StageEnemy[] {
  const team = fielded(state, 'guildWar');
  const level = team.length ? Math.round(team.reduce((a, w) => a + w.level, 0) / team.length) : 1;
  const spec = { ...config.pve.tower.enemy, count: 1, baseLevel: Math.max(1, level), levelSlope: 1 };
  return enemiesFor(config, spec, 7 + boss * 11).map((e) => ({ ...e, level: Math.max(1, level), mult: { hp: 400, atk: 1.5, def: 1.5 } }));
}

export interface GuildWarFight {
  state: AccountState;
  battle: BattleView;
  damage: number;
  kills: number;
  rewards: Rewards;
}

/** Challenge a boss with the Guild War squad (1 attempt). */
export function challengeGuildBoss(config: GameConfig, state: AccountState, now: number, boss: number, seed?: number): Result<GuildWarFight> {
  if (!state.guild) return fail('resource_locked', 'join a guild first (Guild)');
  const t = config.guildWarRelic.guildWar;
  if (!Number.isInteger(boss) || boss < 0 || boss >= t.bosses) return fail('invalid_input', 'no such boss');
  let s = prepareGuildWar(config, state, now);
  const a = attemptsToday(config, s, now);
  if (a.used >= a.earned) return fail('daily_limit', 'no attempts left — earn more from daily activity (30 / 60 / 100)');
  const attackers = buildWildTeam(fielded(s, 'guildWar'), 'attackers', config, s);
  if (attackers.specs.length === 0) return fail('not_found', 'set a Guild War team first');
  const gw0 = s.guildWar!;
  const battle = runTeams(attackers, buildEnemyTeam(bossEnemy(config, s, boss), config), {
    seed: seed ?? Math.floor(config.rng() * 0xffffffff),
    mode: 'guildWar',
    battleId: `m17:guildWar:${gw0.week}:${boss}:${gw0.damage}`,
    strategies: { attackers: s.strategies.guildWar },
  });
  if (!battle) return fail('not_found', 'set a Guild War team first');
  const damage = Object.entries(battle.damageDealt)
    .filter(([k]) => k.startsWith('attackers'))
    .reduce((x, [, v]) => x + v, 0);
  const { gw, kills } = hit(config, gw0, boss, damage);
  let rewards: Rewards = { ...t.battle } as Rewards;
  for (let i = 0; i < kills; i += 1) for (const [k, v] of Object.entries(t.kill)) rewards = { ...rewards, [k]: ((rewards as Record<string, number>)[k] ?? 0) + v };
  s = { ...s, guildWar: { ...gw, damage: gw.damage + damage, dayDamage: gw.dayDamage + damage, used: gw.used + 1 } };
  return ok({ state: applyGrant(config, s, rewards), battle, damage, kills, rewards });
}

function tier<R extends { rank: number }>(rows: R[], rank: number): R | undefined {
  return rank > 0 ? rows.find((r) => rank <= r.rank) : undefined;
}

/** Personal daily rank inside the guild (vs the CPU members' day). */
export function dailyRank(config: GameConfig, day: string, damage: number): number {
  if (damage <= 0) return 0;
  const seed = Date.parse(day) / DAY;
  return rankDamage(damage, ghostRecords([config.guildWarRelic.guildWar.cpuDamagePerDay / 24], seed, 24));
}

export function seasonRank(config: GameConfig, week: string, damage: number): number {
  if (damage <= 0) return 0;
  const seed = week.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  return rankDamage(damage, ghostRecords([config.guildWarRelic.guildWar.cpuDamagePerDay * 1.2], seed, 99));
}

export function guildRank(config: GameConfig, difficulty: number): number {
  const t = config.guildWarRelic.guildWar;
  return Math.max(1, Math.min(t.cpuGuilds + 1, t.cpuGuilds + 1 - Math.floor(((difficulty - 1) / t.difficulties) * t.cpuGuilds)));
}

/** Claim yesterday's daily-rank reward. */
export function claimGuildWarDaily(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; rewards: Rewards }> {
  const s = prepareGuildWar(config, state, now);
  const gw = s.guildWar;
  if (!gw?.lastDay) return fail('not_ready', 'no finished day to claim');
  if (gw.dailyClaimed === gw.lastDay.day) return fail('invalid_input', 'already claimed');
  const row = tier(config.guildWarRelic.guildWar.dailyRank, dailyRank(config, gw.lastDay.day, gw.lastDay.damage));
  if (!row) return fail('resource_locked', 'no reward at this rank');
  const rewards = row.rewards as Rewards;
  return ok({ state: applyGrant(config, { ...s, guildWar: { ...gw, dailyClaimed: gw.lastDay.day } }, rewards), rewards });
}

/** Claim last season's personal and guild rank rewards. */
export function claimGuildWarSeason(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; rewards: Rewards }> {
  const s = prepareGuildWar(config, state, now);
  const gw = s.guildWar;
  if (!gw?.lastWeek) return fail('not_ready', 'the season has not ended');
  if (gw.seasonClaimed === gw.lastWeek.week) return fail('invalid_input', 'already claimed');
  const t = config.guildWarRelic.guildWar;
  let rewards: Rewards = {};
  const rows = [tier(t.seasonRank, seasonRank(config, gw.lastWeek.week, gw.lastWeek.damage)), tier(t.guildRank, guildRank(config, gw.lastWeek.difficulty))];
  for (const row of rows) if (row) for (const [k, v] of Object.entries(row.rewards)) rewards = { ...rewards, [k]: ((rewards as Record<string, number>)[k] ?? 0) + v };
  if (Object.keys(rewards).length === 0) return fail('resource_locked', 'no reward at this rank');
  let next = applyGrant(config, { ...s, guildWar: { ...gw, seasonClaimed: gw.lastWeek.week } }, rewards);
  for (const row of rows) if (row?.titleCard) next = grantTitleCards(next, row.titleCard, 1);
  return ok({ state: next, rewards });
}

export interface GuildWarView {
  joined: boolean;
  week: string;
  difficulty: number;
  endless: boolean;
  bosses: { index: number; name: string; round: number; hp: number; maxHp: number }[];
  attempts: { earned: number; used: number };
  activityNeeded: number[];
  damage: number;
  dayDamage: number;
  ranks: { daily: number; season: number; guild: number };
  canClaimDaily: boolean;
  canClaimSeason: boolean;
}

export function buildGuildWarView(config: GameConfig, state: AccountState, now: number): GuildWarView {
  const t = config.guildWarRelic.guildWar;
  const s = prepareGuildWar(config, state, now);
  const gw = s.guildWar;
  const name = (i: number) => {
    const e = bossEnemy(config, s, i)[0];
    return e ? (config.species.get(e.speciesId)?.name ?? e.speciesId) : `Boss ${i + 1}`;
  };
  const difficulty = gw?.difficulty ?? 1;
  return {
    joined: !!state.guild,
    week: gw?.week ?? weekKey(now),
    difficulty: Math.min(difficulty, t.difficulties),
    endless: difficulty > t.difficulties,
    bosses: (gw?.bosses ?? []).map((b, i) => ({ index: i, name: name(i), round: Math.min(b.round, t.rounds), hp: b.hp, maxHp: roundHp(config, Math.min(difficulty, t.difficulties)) })),
    attempts: attemptsToday(config, s, now),
    activityNeeded: t.activity,
    damage: gw?.damage ?? 0,
    dayDamage: gw?.dayDamage ?? 0,
    ranks: { daily: dailyRank(config, dayKey(now), gw?.dayDamage ?? 0), season: seasonRank(config, gw?.week ?? '', gw?.damage ?? 0), guild: guildRank(config, difficulty) },
    canClaimDaily: !!gw?.lastDay && gw.dailyClaimed !== gw.lastDay.day && dailyRank(config, gw.lastDay.day, gw.lastDay.damage) > 0,
    canClaimSeason: !!gw?.lastWeek && gw.seasonClaimed !== gw.lastWeek.week,
  };
}
