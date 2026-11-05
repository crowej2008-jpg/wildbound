import { arenaRank, dayKey, rollArenaDay, type AccountState, type StageEnemy } from '@wildbound/engine';
import { buildEnemyTeam, buildWildTeam, fielded, runTeams, type BattleView } from './battle';
import type { GameConfig } from './config';
import { fail, ok, type Result } from './index';
import { arenaTuning, arenaUnlocked } from './pvp';
import { enemiesFor } from './pve/shared';

/**
 * M18.1 SPT Temple (owner's wiki + titles 2001–2003), solo against CPU holders. Six thrones: King of Eternity (1,
 * Arena top 10, +3% HP / P.ATK / S.ATK), Ever Victorious (2, top 20, +2%), Dark Vanguard (3, top 50, +1%). To take a
 * seat, pick how far its guardian evolves (1 / 5 / 10 / 100 / 500 on top of the holder's count) and beat that fixed
 * guardian team; it becomes your guardian. Train it (beat it again at a higher step) to raise its count. One seat at a
 * time; a failed challenge costs 20 minutes. Each day a CPU challenger tries your seat: it grows stronger the longer
 * you hold, and wins when it outgrows your guardian. Holding the seat gives its title. See docs/design/temple.md.
 */

export type TempleState = NonNullable<AccountState['temple']>;
type Seat = GameConfig['temple']['seats'][number];
const DAY = 86_400_000;
const MIN = 60_000;

function initial(): TempleState {
  return { seat: null, evolution: 0, since: 0, checkedDay: '', cooldownUntil: 0, lost: null };
}

export function templePlace(config: GameConfig, state: AccountState, now: number): number {
  const arena = rollArenaDay(state.pvp.arena, dayKey(now));
  return arenaRank(arena.credits, arenaTuning(config).bands);
}

/** Guardian strength multiplier at an evolution count. */
export function guardianMult(config: GameConfig, seat: Seat, evolution: number): number {
  return seat.base * (1 + evolution * config.temple.multPerEvolution);
}

/** The CPU challenger's evolution on a day held (stand-in growth). */
export function cpuChallenge(config: GameConfig, seat: Seat, daysHeld: number): number {
  return Math.round(seat.cpuEvolution * 0.5 + daysHeld * config.temple.cpuChallengePerDay);
}

function giveTitle(state: AccountState, title: string): AccountState {
  const owned = { ...state.titles.owned, [title]: { stage: 1, expiresAt: null } };
  const equipped = state.titles.equipped.premium ? state.titles.equipped : { ...state.titles.equipped, premium: title };
  return { ...state, titles: { ...state.titles, owned, equipped } };
}

function takeTitle(state: AccountState, title: string): AccountState {
  const owned = { ...state.titles.owned };
  delete owned[title];
  const equipped = state.titles.equipped.premium === title ? { ...state.titles.equipped, premium: null } : state.titles.equipped;
  return { ...state, titles: { ...state.titles, owned, equipped } };
}

/** Run the daily CPU challenges since the last check; the seat falls when a challenger outgrows the guardian. */
export function prepareTemple(config: GameConfig, state: AccountState, now: number): AccountState {
  let t = state.temple ?? initial();
  let s = state;
  const today = dayKey(now);
  if (t.seat && t.checkedDay !== today) {
    const seat = config.temple.seats.find((x) => x.id === t.seat)!;
    const days = Math.floor((now - t.since) / DAY);
    if (days >= 1 && cpuChallenge(config, seat, days) > t.evolution) {
      s = takeTitle(s, seat.title);
      t = { ...t, seat: null, evolution: 0, since: 0, lost: seat.id };
    }
    t = { ...t, checkedDay: today };
  }
  return { ...s, temple: t };
}

/** Who sits on each seat: you or a CPU holder with its guardian count. */
export function seatHolder(config: GameConfig, state: AccountState, seat: Seat): { you: boolean; evolution: number } {
  const t = state.temple;
  if (t?.seat === seat.id) return { you: true, evolution: t.evolution };
  return { you: false, evolution: seat.cpuEvolution };
}

export function guardianTeam(config: GameConfig, state: AccountState, seat: Seat, evolution: number): StageEnemy[] {
  const team = fielded(state, 'temple');
  const level = team.length ? Math.round(team.reduce((a, w) => a + w.level, 0) / team.length) : 1;
  const k = guardianMult(config, seat, evolution);
  const spec = { ...config.pve.tower.enemy, count: 6, baseLevel: Math.max(1, level), levelSlope: 1 };
  const index = config.temple.seats.findIndex((x) => x.id === seat.id);
  return enemiesFor(config, spec, 11 + index * 5).map((e) => ({ ...e, level: Math.max(1, level), mult: { hp: k, atk: k, def: k } }));
}

export interface TempleFight {
  state: AccountState;
  battle: BattleView;
  win: boolean;
  took: boolean;
}

/** Challenge a seat (or train your own) at `step` evolutions above its current guardian. */
export function challengeSeat(config: GameConfig, state: AccountState, now: number, seatId: string, step: number, seed?: number): Result<TempleFight> {
  if (!arenaUnlocked(config, state)) return fail('resource_locked', 'the SPT Temple opens with the Arena');
  const seat = config.temple.seats.find((x) => x.id === seatId);
  if (!seat) return fail('not_found', 'no such throne');
  if (!config.temple.steps.includes(step)) return fail('invalid_input', `pick ${config.temple.steps.join(' / ')} evolutions`);
  let s = prepareTemple(config, state, now);
  const t = s.temple!;
  if (now < t.cooldownUntil) return fail('not_ready', `wait ${Math.ceil((t.cooldownUntil - now) / MIN)} min after a failed challenge`);
  const mine = t.seat === seat.id;
  if (!mine && templePlace(config, s, now) > seat.arenaTop) return fail('resource_locked', `needs an Arena place in the top ${seat.arenaTop}`);
  const holder = seatHolder(config, s, seat);
  const target = holder.evolution + step;
  const attackers = buildWildTeam(fielded(s, 'temple'), 'attackers', config, s);
  if (attackers.specs.length === 0) return fail('not_found', 'set an SPT Temple team first');
  const battle = runTeams(attackers, buildEnemyTeam(guardianTeam(config, s, seat, target), config), {
    seed: seed ?? Math.floor(config.rng() * 0xffffffff),
    mode: 'temple',
    battleId: `m18:temple:${seat.id}:${target}:${now}`,
  });
  if (!battle) return fail('not_found', 'set an SPT Temple team first');
  const win = battle.winner === 'attackers';
  if (!win) return ok({ state: { ...s, temple: { ...t, cooldownUntil: now + config.temple.failCooldownMinutes * MIN } }, battle, win, took: false });
  if (mine) return ok({ state: { ...s, temple: { ...t, evolution: target } }, battle, win, took: false });
  // Taking a new seat gives up the old one.
  if (t.seat) {
    const old = config.temple.seats.find((x) => x.id === t.seat)!;
    s = takeTitle(s, old.title);
  }
  s = giveTitle(s, seat.title);
  return ok({ state: { ...s, temple: { ...t, seat: seat.id, evolution: target, since: now, checkedDay: dayKey(now), lost: null } }, battle, win, took: true });
}

export interface TempleView {
  unlocked: boolean;
  place: number;
  cooldownMin: number;
  steps: number[];
  lost: string | null;
  seats: { id: string; name: string; title: string; arenaTop: number; you: boolean; evolution: number; eligible: boolean; nextChallenge: number | null }[];
}

export function buildTempleView(config: GameConfig, state: AccountState, now: number): TempleView {
  const s = prepareTemple(config, state, now);
  const t = s.temple!;
  const place = templePlace(config, s, now);
  return {
    unlocked: arenaUnlocked(config, s),
    place,
    cooldownMin: Math.max(0, Math.ceil((t.cooldownUntil - now) / MIN)),
    steps: config.temple.steps,
    lost: t.lost ? (config.temple.seats.find((x) => x.id === t.lost)?.name ?? null) : null,
    seats: config.temple.seats.map((seat) => {
      const h = seatHolder(config, s, seat);
      const days = h.you ? Math.floor((now - t.since) / DAY) + 1 : 0;
      return { id: seat.id, name: seat.name, title: seat.title, arenaTop: seat.arenaTop, you: h.you, evolution: h.evolution, eligible: h.you || place <= seat.arenaTop, nextChallenge: h.you ? cpuChallenge(config, seat, days) : null };
    }),
  };
}
