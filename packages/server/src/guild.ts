import { dayKey, type AccountState, type Rewards, type StatLine } from '@wildbound/engine';
import type { GameConfig } from './config';
import { applyGrant } from './economy';
import { fail, ok, type Result } from './index';

/**
 * M16 Guild (source guild_* tables), played solo: the player's guild is filled with CPU members who donate every day.
 * Donations (5 a day; Gold or Gems) pay Guild Tokens and raise guild EXP and funds; red packets pay out when the
 * trainer reaches their levels; the guild beast is fed Flat Candy and adds account-wide stats.
 * Guild War / guild boss and Pokémon Park are M17. See docs/design/guild-events.md.
 */

export type GuildState = NonNullable<AccountState['guild']>;
const DAY = 86_400_000;

export const CPU_GUILD_NAME = 'Wildbound Rangers';

function spend(state: AccountState, currency: string, n: number): AccountState | null {
  const have = (state.currencies as Record<string, number>)[currency] ?? 0;
  if (have < n) return null;
  return { ...state, currencies: { ...state.currencies, [currency]: have - n } };
}

function addGuildExp(config: GameConfig, g: GuildState, exp: number): GuildState {
  const levels = config.guildEvents.guild.levels;
  let { level } = g;
  let total = g.exp + exp;
  for (;;) {
    const row = levels.find((l) => l.level === level);
    if (!row || level >= levels[levels.length - 1]!.level || total < row.exp) break;
    total -= row.exp;
    level += 1;
  }
  return { ...g, level, exp: total };
}

/** CPU members donate once a day: add their EXP for each missed day (up to 30). */
export function rollGuild(config: GameConfig, state: AccountState, now: number): AccountState {
  const g = state.guild;
  if (!g) return state;
  const today = dayKey(now);
  if (g.cpuDay === today) return state;
  const days = g.cpuDay ? Math.min(30, Math.max(1, Math.round((Date.parse(today) - Date.parse(g.cpuDay)) / DAY))) : 1;
  const t = config.guildEvents.guild;
  const next = addGuildExp(config, { ...g, cpuDay: today, fund: g.fund + days * t.cpuMembers * t.donations.normal.fund }, days * t.cpuMembers * t.cpuExpPerMemberDay);
  return { ...state, guild: next };
}

export function joinGuild(config: GameConfig, state: AccountState, now: number): Result<AccountState> {
  if (state.guild) return fail('invalid_input', 'already in a guild');
  const g: GuildState = { name: CPU_GUILD_NAME, level: 1, exp: 0, fund: 0, day: dayKey(now), donations: 0, cpuDay: dayKey(now), packets: [], beast: { level: 1, exp: 0 } };
  return ok({ ...state, guild: g });
}

export function donationsLeft(config: GameConfig, state: AccountState, now: number): number {
  const g = state.guild;
  if (!g) return 0;
  return config.guildEvents.guild.donateTimes - (g.day === dayKey(now) ? g.donations : 0);
}

/** Donate Gold or Gems (5 a day). */
export function donateGuild(config: GameConfig, state: AccountState, now: number, kind: 'normal' | 'gems'): Result<{ state: AccountState; rewards: Rewards }> {
  if (!state.guild) return fail('resource_locked', 'join a guild first');
  if (donationsLeft(config, state, now) < 1) return fail('daily_limit', 'no donations left today');
  const d = config.guildEvents.guild.donations;
  const paid = kind === 'normal' ? spend(state, 'gold', d.normal.costGold) : spend(state, 'gems', d.gems.costGems);
  if (!paid) return fail('insufficient_items', kind === 'normal' ? `needs ${d.normal.costGold} Gold` : `needs ${d.gems.costGems} Gems`);
  const row = kind === 'normal' ? d.normal : d.gems;
  const today = dayKey(now);
  const g = paid.guild!;
  const donated = { ...g, day: today, donations: (g.day === today ? g.donations : 0) + 1, fund: g.fund + row.fund };
  const rewards: Rewards = { guildCoin: row.guildCoin };
  return ok({ state: applyGrant(config, { ...paid, guild: addGuildExp(config, donated, row.exp) }, rewards), rewards });
}

/** Red packets: one per trainer-level milestone; solo, the player keeps one share (stand-in). */
export function packetShare(config: GameConfig, id: number): number {
  const p = config.guildEvents.guild.redPackets.find((r) => r.id === id);
  return p ? Math.round(p.gems / p.shares) : 0;
}

export function claimGuildPacket(config: GameConfig, state: AccountState, id: number): Result<{ state: AccountState; rewards: Rewards }> {
  const g = state.guild;
  if (!g) return fail('resource_locked', 'join a guild first');
  const p = config.guildEvents.guild.redPackets.find((r) => r.id === id);
  if (!p) return fail('not_found', 'no such red packet');
  if (g.packets.includes(id)) return fail('invalid_input', 'already opened');
  if (state.profile.level < p.trainerLevel) return fail('resource_locked', `reach trainer level ${p.trainerLevel}`);
  const rewards: Rewards = { gems: packetShare(config, id) };
  return ok({ state: applyGrant(config, { ...state, guild: { ...g, packets: [...g.packets, id] } }, rewards), rewards });
}

/** Feed the guild beast Flat Candy: beast EXP, plus Guild Tokens per candy. */
export function feedGuildBeast(config: GameConfig, state: AccountState, currency: string, count: number): Result<{ state: AccountState; rewards: Rewards }> {
  const g = state.guild;
  if (!g) return fail('resource_locked', 'join a guild first');
  const food = config.guildEvents.guild.beast.foods.find((f) => f.currency === currency);
  if (!food || count < 1 || !Number.isInteger(count)) return fail('invalid_input', 'pick a candy and a count');
  const levels = config.guildEvents.guild.beast.levels;
  const max = levels[levels.length - 1]!.level;
  if (g.beast.level >= max) return fail('at_level_cap', 'the guild beast is at its top level');
  const paid = spend(state, currency, count);
  if (!paid) return fail('insufficient_items', `needs ${count}`);
  let { level, exp } = g.beast;
  exp += food.exp * count;
  for (;;) {
    const next = levels.find((l) => l.level === level + 1);
    if (!next || exp < next.exp) break;
    exp -= next.exp;
    level += 1;
  }
  if (level >= max) exp = 0;
  const rewards: Rewards = { guildCoin: food.guildCoin * count };
  return ok({ state: applyGrant(config, { ...paid, guild: { ...g, beast: { level, exp } } }, rewards), rewards });
}

/** The guild beast's stats (account-wide). */
export function guildLines(config: GameConfig, state: AccountState): StatLine[] {
  const g = state.guild;
  if (!g) return [];
  const row = config.guildEvents.guild.beast.levels.find((l) => l.level === g.beast.level);
  return (row?.lines ?? []).map((l) => ({ kind: l.kind as StatLine['kind'], field: l.field, base: l.value, perLevel: 0 }));
}

export interface GuildView {
  joined: boolean;
  name: string;
  level: number;
  exp: number;
  nextExp: number | null;
  members: number;
  fund: number;
  donationsLeft: number;
  donations: GameConfig['guildEvents']['guild']['donations'];
  packets: { id: number; trainerLevel: number; gems: number; opened: boolean; ready: boolean }[];
  beast: { level: number; star: number; exp: number; nextExp: number | null; lines: { field: string; value: number; kind: string }[] };
  foods: { currency: string; exp: number; guildCoin: number; have: number }[];
  guildCoin: number;
}

export function buildGuildView(config: GameConfig, state: AccountState, now: number): GuildView {
  const t = config.guildEvents.guild;
  const s = rollGuild(config, state, now);
  const g = s.guild;
  const c = state.currencies as Record<string, number>;
  const level = g?.level ?? 1;
  const beastLevel = g?.beast.level ?? 1;
  const beastRow = t.beast.levels.find((l) => l.level === beastLevel);
  return {
    joined: !!g,
    name: g?.name ?? CPU_GUILD_NAME,
    level,
    exp: g?.exp ?? 0,
    nextExp: level >= t.levels[t.levels.length - 1]!.level ? null : (t.levels.find((l) => l.level === level)?.exp ?? null),
    members: t.levels.find((l) => l.level === level)?.members ?? 30,
    fund: g?.fund ?? 0,
    donationsLeft: donationsLeft(config, s, now),
    donations: t.donations,
    packets: t.redPackets.map((p) => ({ id: p.id, trainerLevel: p.trainerLevel, gems: packetShare(config, p.id), opened: !!g?.packets.includes(p.id), ready: state.profile.level >= p.trainerLevel })),
    beast: { level: beastLevel, star: beastRow?.star ?? 5, exp: g?.beast.exp ?? 0, nextExp: t.beast.levels.find((l) => l.level === beastLevel + 1)?.exp ?? null, lines: beastRow?.lines ?? [] },
    foods: t.beast.foods.map((f) => ({ currency: f.currency, exp: f.exp, guildCoin: f.guildCoin, have: c[f.currency] ?? 0 })),
    guildCoin: c.guildCoin ?? 0,
  };
}
