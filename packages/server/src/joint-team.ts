import {
  addRewards,
  dayKey,
  ghostRecords,
  mulberry32,
  rankDamage,
  weekKey,
  weekdayUtc,
  type AccountState,
  type CurrencyId,
  type JointTeamState,
  type Rewards,
  type StageEnemy,
  type StatLine,
  type WildAreaState,
} from '@wildbound/engine';
import { buildEnemyTeam, buildWildTeam, fielded, runTeams, type BattleView } from './battle';
import type { GameConfig } from './config';
import { applyGrant } from './economy';
import { fail, ok, type Result } from './index';
import { enemiesFor } from './pve/shared';

/**
 * Joint Team (M14.4): Joint Team Battles and the Wild Area (Joint Team Dynamax), from the source tables and the
 * owner's wiki, played solo — the squad's two teammates, rival squads and duel players are CPUs. Both open on server
 * day 15 at trainer level 45 (source). See docs/design/joint-team.md.
 */


const DAY = 86_400_000;
export const JOINT_GATE = { serverDay: 15, level: 45 };

export function jointOpen(state: AccountState, now: number): boolean {
  const day = Math.floor((now - state.serverEpoch) / DAY) + 1;
  return day >= JOINT_GATE.serverDay && state.profile.level >= JOINT_GATE.level;
}

const LOCKED = 'Joint Team opens on server day 15 at trainer level 45';

/** The team's level: the average of the fielded squad (enemies are built around it). */
function teamLevel(state: AccountState): number {
  const team = fielded(state, 'jointTeam');
  return team.length ? Math.round(team.reduce((s, w) => s + w.level, 0) / team.length) : 1;
}

function scaled(enemies: StageEnemy[], k: number): StageEnemy[] {
  return enemies.map((e) => ({ ...e, mult: { hp: k * (e.mult?.hp ?? 1), atk: k * (e.mult?.atk ?? 1), def: k * (e.mult?.def ?? 1) } }));
}

function fight(config: GameConfig, state: AccountState, enemies: StageEnemy[], id: string, seed: number, boost = 0): BattleView | null {
  const team = fielded(state, 'jointTeam');
  const attackers = buildWildTeam(team, 'attackers', config, state);
  if (boost > 0) {
    for (const s of attackers.specs) s.sheet = { ...s.sheet, hp: Math.round(s.sheet.hp * (1 + boost)), pAtk: Math.round(s.sheet.pAtk * (1 + boost)), sAtk: Math.round(s.sheet.sAtk * (1 + boost)) };
  }
  return runTeams(attackers, buildEnemyTeam(enemies, config), { seed, mode: 'jointTeam', battleId: id, strategies: { attackers: state.strategies.jointTeam } });
}

function enemiesAt(config: GameConfig, level: number, salt: number, count = 6): StageEnemy[] {
  const spec = { ...config.pve.tower.enemy, count, baseLevel: Math.max(1, level), levelSlope: 1 };
  return enemiesFor(config, spec, salt % 40).map((e) => ({ ...e, level: Math.max(1, level) }));
}

// ---------------------------------------------------------------- Joint Team Battles

function initialBattles(now: number): JointTeamState {
  return { week: weekKey(now), day: dayKey(now), battlesToday: 0, refreshesToday: 0, points: 0, battles: 0, opponents: [], claimed: [], bought: {}, skills: {}, lastRank: null };
}

/** The squad's CPU teammates and rival squads score deterministically through the week. */
function rivalPoints(points: number, week: string): number[] {
  let seed = 0;
  for (const ch of week) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return ghostRecords([Math.max(600, points)], seed, 49);
}

export function squadRank(points: number, week: string): number {
  return rankDamage(points, rivalPoints(points, week));
}

function teammatePoints(battles: number): number {
  return battles * 2 * 75;
}

function rollOpponents(seed: number): number[] {
  const rng = mulberry32(seed >>> 0);
  return [0.85, 1, 1.2].map((base) => Math.round((base + (rng() - 0.5) * 0.1) * 100) / 100);
}

export function prepareJointTeam(config: GameConfig, state: AccountState, now: number): { state: AccountState; changed: boolean } {
  let jt = state.jointTeam ?? initialBattles(now);
  const week = weekKey(now);
  if (jt.week !== week) {
    const total = jt.points + teammatePoints(jt.battles);
    jt = { ...initialBattles(now), skills: jt.skills, lastRank: jt.battles > 0 ? squadRank(total, jt.week) : jt.lastRank };
  }
  if (jt.day !== dayKey(now)) jt = { ...jt, day: dayKey(now), battlesToday: 0, refreshesToday: 0 };
  if (jt.opponents.length === 0) jt = { ...jt, opponents: rollOpponents(now) };
  if (jt === state.jointTeam) return { state, changed: false };
  return { state: { ...state, jointTeam: jt }, changed: true };
}

/** Battles run Tuesday to Sunday (Monday is matchmaking in the source). */
export function battleDayOpen(now: number): boolean {
  return weekdayUtc(now) !== 1;
}

export function challengeSquad(config: GameConfig, state: AccountState, now: number, index: number, seed?: number): Result<{ state: AccountState; battle: BattleView; win: boolean; points: number; rewards: Rewards }> {
  if (!jointOpen(state, now)) return fail('resource_locked', LOCKED);
  if (!battleDayOpen(now)) return fail('not_ready', 'squads are being matched — battles open on Tuesday');
  const t = config.jointTeam.battles;
  let s = prepareJointTeam(config, state, now).state;
  let jt = s.jointTeam!;
  const factor = jt.opponents[index];
  if (factor === undefined) return fail('invalid_input', 'no such opponent');
  const free = jt.battlesToday < t.freePerDay;
  if (!free && (s.currencies.jointTicket ?? 0) < 1) return fail('daily_limit', 'no challenges left today (Joint Challenge Tickets add more)');
  if (!free) s = { ...s, currencies: { ...s.currencies, jointTicket: (s.currencies.jointTicket ?? 0) - 1 } };
  const level = Math.round(teamLevel(s) * factor);
  const battle = fight(config, s, scaled(enemiesAt(config, level, Math.floor(now / 1000) + index), factor), `m14:joint:${jt.week}:${jt.battles}`, seed ?? Math.floor(config.rng() * 0xffffffff));
  if (!battle) return fail('not_found', 'set a Joint Team squad first');
  const win = battle.winner === 'attackers';
  const points = win ? t.winPoints + Math.round(t.winBonus * Math.max(0, factor - 0.85) * 5) : t.lossPoints;
  jt = { ...jt, battlesToday: jt.battlesToday + 1, battles: jt.battles + 1, points: jt.points + points, opponents: rollOpponents(now + jt.battles + 1) };
  const rewards = t.perBattle as Rewards;
  return ok({ state: applyGrant(config, { ...s, jointTeam: jt }, rewards), battle, win, points, rewards });
}

export function refreshOpponents(config: GameConfig, state: AccountState, now: number): Result<AccountState> {
  if (!jointOpen(state, now)) return fail('resource_locked', LOCKED);
  const s = prepareJointTeam(config, state, now).state;
  const jt = s.jointTeam!;
  if (jt.refreshesToday >= config.jointTeam.battles.freeRefreshes) return fail('daily_limit', 'no refreshes left today');
  return ok({ ...s, jointTeam: { ...jt, refreshesToday: jt.refreshesToday + 1, opponents: rollOpponents(now ^ 0x5151) } });
}

/** Claim a personal (battles) or squad (points) milestone. */
export function claimJointMilestone(config: GameConfig, state: AccountState, now: number, kind: 'p' | 's', at: number): Result<{ state: AccountState; rewards: Rewards }> {
  const s = prepareJointTeam(config, state, now).state;
  const jt = s.jointTeam!;
  const t = config.jointTeam.battles;
  const row = kind === 'p' ? t.personal.find((r) => r.battles === at) : t.squad.find((r) => r.points === at);
  if (!row) return fail('not_found', 'no such milestone');
  const key = `${kind}:${at}`;
  if (jt.claimed.includes(key)) return fail('invalid_input', 'already claimed');
  const have = kind === 'p' ? jt.battles : jt.points + teammatePoints(jt.battles);
  if (have < at) return fail('not_ready', 'not reached yet');
  return ok({ state: applyGrant(config, { ...s, jointTeam: { ...jt, claimed: [...jt.claimed, key] } }, row.rewards as Rewards), rewards: row.rewards as Rewards });
}

export function claimJointSeason(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; rewards: Rewards }> {
  const s = prepareJointTeam(config, state, now).state;
  const jt = s.jointTeam!;
  if (jt.lastRank === null) return fail('not_ready', 'no finished season to claim');
  const row = config.jointTeam.battles.ranks.find((r) => jt.lastRank! <= r.upTo);
  const rewards = (row?.rewards ?? {}) as Rewards;
  return ok({ state: applyGrant(config, { ...s, jointTeam: { ...jt, lastRank: null } }, rewards), rewards });
}

export function buyJointShop(config: GameConfig, state: AccountState, now: number, id: number): Result<{ state: AccountState; rewards: Rewards }> {
  const s = prepareJointTeam(config, state, now).state;
  const jt = s.jointTeam!;
  const row = config.jointTeam.battles.shop.find((r) => r.id === id);
  if (!row) return fail('not_found', 'no such offer');
  const tier = jointShopTier(s);
  if (row.tier > tier) return fail('resource_locked', 'raise your squad skills to open this shelf');
  const bought = jt.bought[String(id)] ?? 0;
  if (bought >= row.limit) return fail('daily_limit', 'sold out this season');
  if ((s.currencies.squadCoin ?? 0) < row.price) return fail('insufficient_items', `needs ${row.price} Squad Exchange Coins`);
  const paid = { ...s, currencies: { ...s.currencies, squadCoin: (s.currencies.squadCoin ?? 0) - row.price }, jointTeam: { ...jt, bought: { ...jt.bought, [String(id)]: bought + 1 } } };
  return ok({ state: applyGrant(config, paid, row.rewards as Rewards), rewards: row.rewards as Rewards });
}

/** The shop shelf open: the source gates shelves by team level (6 / 8); solo, by total squad-skill levels (60 / 80). */
export function jointShopTier(state: AccountState): number {
  const total = Object.values(state.jointTeam?.skills ?? {}).reduce((a, b) => a + b, 0);
  return total >= 80 ? 2 : total >= 60 ? 1 : 0;
}

export function skillCost(config: GameConfig, level: number): number {
  const c = config.jointTeam.battles.skillCost;
  return c.base + c.perLevel * level;
}

export function levelSquadSkill(config: GameConfig, state: AccountState, now: number, field: string): Result<AccountState> {
  const s = prepareJointTeam(config, state, now).state;
  const jt = s.jointTeam!;
  const skill = config.jointTeam.battles.skills.find((k) => k.field === field);
  if (!skill) return fail('not_found', 'no such skill');
  const level = jt.skills[field] ?? 0;
  if (level >= skill.maxLevel) return fail('at_level_cap', 'max level');
  const cost = skillCost(config, level);
  if ((s.currencies.coreSkillStone ?? 0) < cost) return fail('insufficient_items', `needs ${cost} Core Skill Stones`);
  return ok({ ...s, currencies: { ...s.currencies, coreSkillStone: (s.currencies.coreSkillStone ?? 0) - cost }, jointTeam: { ...jt, skills: { ...jt.skills, [field]: level + 1 } } });
}

/** Squad skills are permanent account-wide lines. */
export function squadSkillLines(config: GameConfig, state: AccountState): StatLine[] {
  const skills = state.jointTeam?.skills ?? {};
  const out: StatLine[] = [];
  for (const k of config.jointTeam.battles.skills) {
    const lv = skills[k.field] ?? 0;
    if (lv <= 0) continue;
    const pct = !['hp', 'pAtk', 'sAtk'].includes(k.field);
    out.push({ kind: pct ? 'percent' : 'core', field: k.field, base: k.perLevel * lv, perLevel: 0 });
  }
  return out;
}

// ---------------------------------------------------------------- Wild Area (Joint Team Dynamax)

function initialWild(config: GameConfig, now: number): WildAreaState {
  const w = config.jointTeam.wild;
  return { week: weekKey(now), day: dayKey(now), energy: w.energyMax, energyAt: now, zone: 1, bossWins: {}, explores: 0, spent: 0, points: 0, badges: 0, fragments: {}, guess: null, lastRank: null };
}

export function wildOpenNow(config: GameConfig, now: number): boolean {
  const w = config.jointTeam.wild;
  const wd = weekdayUtc(now) === 0 ? 7 : weekdayUtc(now);
  const hour = new Date(now).getUTCHours();
  return wd >= w.openDays[0]! && wd <= w.openDays[1]! && hour >= w.openHours[0]! && hour < w.openHours[1]!;
}

export function prepareWild(config: GameConfig, state: AccountState, now: number): { state: AccountState; changed: boolean } {
  const w = config.jointTeam.wild;
  let wa = state.wildArea ?? initialWild(config, now);
  if (wa.week !== weekKey(now)) wa = { ...initialWild(config, now), lastRank: wa.points > 0 ? rankDamage(wa.points, ghostRecords([wa.points], 0x61a7, 49)) : wa.lastRank };
  if (wa.day !== dayKey(now)) wa = { ...wa, day: dayKey(now), energy: w.energyMax, energyAt: now, zone: 1, bossWins: {}, explores: 0, guess: null };
  const ticks = Math.floor((now - wa.energyAt) / (w.energyRegenSec * 1000));
  if (ticks > 0 && wa.energy < w.energyMax) wa = { ...wa, energy: Math.min(w.energyMax, wa.energy + ticks), energyAt: wa.energyAt + ticks * w.energyRegenSec * 1000 };
  else if (ticks > 0) wa = { ...wa, energyAt: now };
  if (wa === state.wildArea) return { state, changed: false };
  return { state: { ...state, wildArea: wa }, changed: true };
}

export function unlockedRates(config: GameConfig, wa: WildAreaState): number[] {
  return config.jointTeam.wild.multipliers.filter((m) => wa.spent >= m.unlockEnergy).map((m) => m.rate);
}

function fragmentBoost(config: GameConfig, wa: WildAreaState): number {
  let k = 0;
  for (const [id, n] of Object.entries(wa.fragments)) {
    const f = config.jointTeam.wild.fragments.find((x) => String(x.id) === id);
    if (f) k += Math.max(f.hp, f.pAtk, f.sAtk) * n;
  }
  return Math.min(k, 3);
}

export interface WildResult {
  state: AccountState;
  event: string;
  battle?: BattleView;
  win?: boolean;
  points: number;
  rewards: Rewards;
  fragment?: string;
}

/** Explore the current zone at a multiplier: spend energy, meet an event; fights pay points × multiplier and drops. */
export function exploreWild(config: GameConfig, state: AccountState, now: number, rate: number, seed?: number): Result<WildResult> {
  if (!jointOpen(state, now)) return fail('resource_locked', LOCKED);
  if (!wildOpenNow(config, now)) return fail('not_ready', 'the Wild Area is open Tuesday to Sunday, 10:00–22:00 UTC');
  const w = config.jointTeam.wild;
  let s = prepareWild(config, state, now).state;
  let wa = s.wildArea!;
  if (wa.guess) return fail('invalid_input', 'place your capture guess first');
  if (!unlockedRates(config, wa).includes(rate)) return fail('resource_locked', `×${rate} is not unlocked yet`);
  const zone = w.zones.find((z) => z.zone === wa.zone)!;
  const cost = zone.cost * rate;
  if (wa.energy < cost) return fail('insufficient_items', `needs ${cost} energy`);
  const rng = mulberry32(((seed ?? Math.floor(config.rng() * 0xffffffff)) ^ (wa.explores * 2654435761)) >>> 0);
  wa = { ...wa, energy: wa.energy - cost, spent: wa.spent + cost, explores: wa.explores + 1 };
  const boss = w.bosses.find((b) => b.zone === wa.zone);
  const forceBoss = boss && (wa.bossWins[String(wa.zone)] ?? 0) < boss.wins && wa.explores >= boss.guaranteeBy;
  const total = zone.events.reduce((a, e) => a + e.weight, 0);
  let x = rng() * total;
  const ev = forceBoss ? zone.events.find((e) => e.kind === 'dynamax')! : (zone.events.find((e) => (x -= e.weight) < 0) ?? zone.events[0]!);
  let rewards: Rewards = {};
  let points = 0;
  let fragment: string | undefined;
  const drop = () => {
    const pool = w.drops[String(wa.zone) as '1' | '2' | '3'] as { fragment?: number; [k: string]: number | undefined }[];
    const d = pool[Math.floor(rng() * pool.length)]!;
    if (d.fragment) {
      wa = { ...wa, fragments: { ...wa.fragments, [String(d.fragment)]: (wa.fragments[String(d.fragment)] ?? 0) + 1 } };
      fragment = w.fragments.find((f) => f.id === d.fragment)?.name;
    } else rewards = addRewards(rewards, d as Rewards);
  };
  if (ev.kind === 'chest') {
    points = ev.points * rate;
    drop();
  } else if (ev.kind === 'guess') {
    const balls = ['poke', 'advanced', 'master'] as const;
    wa = { ...wa, guess: { ball: balls[Math.floor(rng() * 3)]! } };
    s = { ...s, wildArea: wa };
    return ok({ state: s, event: 'guess', points: 0, rewards: {} });
  } else {
    const level = teamLevel(s);
    const isBoss = ev.kind === 'dynamax' && boss && (wa.bossWins[String(wa.zone)] ?? 0) < boss.wins;
    const k = ev.kind === 'normal' ? 1 : ev.kind === 'duel' ? 1.3 : ev.kind === 'ultra' ? 2.2 : 1.6;
    let enemies = scaled(enemiesAt(config, level + wa.zone * 2, wa.explores + wa.zone * 97), k * (1 + 0.15 * (wa.zone - 1)));
    if (isBoss) enemies = [{ speciesId: boss!.species, level: level + 5, stars: 10, stage: 3, mult: { hp: 6 * k, atk: 1.5 * k, def: 1.5 * k } }];
    const battle = fight(config, s, enemies, `m14:wild:${wa.week}:${wa.explores}`, Math.floor(rng() * 0xffffffff), fragmentBoost(config, wa));
    if (!battle) return fail('not_found', 'set a Joint Team squad first');
    const win = battle.winner === 'attackers';
    if (win) {
      points = ev.points * rate;
      drop();
      if (isBoss) wa = { ...wa, bossWins: { ...wa.bossWins, [String(wa.zone)]: (wa.bossWins[String(wa.zone)] ?? 0) + 1 } };
      if (ev.kind === 'duel') wa = { ...wa, badges: wa.badges + Math.min(16, Math.ceil(Math.max(10, wa.badges) * 0.1)) };
      if (isBoss && (wa.bossWins[String(wa.zone)] ?? 0) >= boss!.wins && wa.zone < 3) {
        wa = { ...wa, zone: wa.zone + 1, explores: 0, ...(wa.zone + 1 === 3 ? { badges: wa.badges + w.badgesOnInner } : {}) };
      }
    } else {
      wa = { ...wa, energy: wa.energy + (cost - zone.cost) };
    }
    wa = { ...wa, points: wa.points + points };
    return ok({ state: applyGrant(config, { ...s, wildArea: wa }, rewards), event: ev.kind, battle, win, points, rewards, ...(fragment ? { fragment } : {}) });
  }
  wa = { ...wa, points: wa.points + points };
  return ok({ state: applyGrant(config, { ...s, wildArea: wa }, rewards), event: ev.kind, points, rewards, ...(fragment ? { fragment } : {}) });
}

/** Bet whether the shown ball catches: 5 points × the multiplier you explored at (×1 here), more if right. */
export function guessWild(config: GameConfig, state: AccountState, now: number, success: boolean, seed?: number): Result<{ state: AccountState; caught: boolean; right: boolean; points: number }> {
  const s = prepareWild(config, state, now).state;
  const wa = s.wildArea!;
  if (!wa.guess) return fail('invalid_input', 'no capture to guess');
  const rng = mulberry32((seed ?? Math.floor(config.rng() * 0xffffffff)) >>> 0);
  const caught = rng() < config.jointTeam.wild.guessChance[wa.guess.ball];
  const right = caught === success;
  const points = right ? 10 : 5;
  return ok({ state: { ...s, wildArea: { ...wa, guess: null, points: wa.points + points } }, caught, right, points });
}

/** Spend Teleporters to jump zones (1 → Middle, 2 → Inner). */
export function teleportWild(config: GameConfig, state: AccountState, now: number): Result<AccountState> {
  const s = prepareWild(config, state, now).state;
  const wa = s.wildArea!;
  if (wa.zone >= 3) return fail('invalid_input', 'already in the Inner Wilds');
  const cost = config.jointTeam.wild.teleporters[wa.zone - 1]!;
  if ((s.currencies.teleporter ?? 0) < cost) return fail('insufficient_items', `needs ${cost} Teleporter(s)`);
  const zone = wa.zone + 1;
  return ok({
    ...s,
    currencies: { ...s.currencies, teleporter: (s.currencies.teleporter ?? 0) - cost },
    wildArea: { ...wa, zone, explores: 0, badges: wa.badges + (zone === 3 ? config.jointTeam.wild.badgesOnInner : 0) },
  });
}

export function useEnergyCan(config: GameConfig, state: AccountState, now: number): Result<AccountState> {
  const s = prepareWild(config, state, now).state;
  if ((s.currencies.wildEnergyCan ?? 0) < 1) return fail('insufficient_items', 'no Energy Canisters');
  const wa = s.wildArea!;
  return ok({ ...s, currencies: { ...s.currencies, wildEnergyCan: (s.currencies.wildEnergyCan ?? 0) - 1 }, wildArea: { ...wa, energy: wa.energy + config.jointTeam.wild.canisterEnergy } });
}

export function claimWildSeason(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; rewards: Rewards }> {
  const s = prepareWild(config, state, now).state;
  const wa = s.wildArea!;
  if (wa.lastRank === null) return fail('not_ready', 'no finished season to claim');
  const row = config.jointTeam.wild.personalRanks.find((r) => wa.lastRank! <= r.upTo);
  const rewards = (row?.rewards ?? {}) as Rewards;
  return ok({ state: applyGrant(config, { ...s, wildArea: { ...wa, lastRank: null } }, rewards), rewards });
}

export const JOINT_CURRENCIES: CurrencyId[] = ['squadCoin', 'coreSkillStone', 'awakeningStone', 'jointTicket', 'wildEnergyCan', 'teleporter'];
