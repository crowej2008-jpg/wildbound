import { dayKey, mulberry32, type AccountState, type Rewards } from '@wildbound/engine';
import type { GameConfig } from './config';
import { applyGrant } from './economy';
import { fail, ok, type Result } from './index';

/**
 * M16 events, simulated on the account's server-day clock (no live operator calendar solo):
 * - Shovel Carnival (owner's wiki): every 14 days for 4 days. Treasure Shovels spin the Destiny Treasure wheel; the
 *   Gems pool starts at 16,000, grows 20 a draw and pays 5–20 % on its segments; each shovel banks 10 Credits for
 *   milestones; Gems buy shovels in a daily-refreshing shop; Treasure Pieces buy from the Happy Exchange.
 * - Merge Event (stand-in schedule, the wiki's four phases): a one-day leaderboard rush per phase (Berry, Orb,
 *   Soul Heart, Treasure) against a CPU ladder; points come from contributing that phase's material.
 * See docs/design/guild-events.md.
 */

export type EventsState = NonNullable<AccountState['events']>;
const DAY = 86_400_000;

function serverDay(state: AccountState, now: number): number {
  return Math.floor((now - state.serverEpoch) / DAY) + 1;
}

function spend(state: AccountState, currency: string, n: number): AccountState | null {
  const have = (state.currencies as Record<string, number>)[currency] ?? 0;
  if (have < n) return null;
  return { ...state, currencies: { ...state.currencies, [currency]: have - n } };
}

export interface Window {
  cycle: number;
  active: boolean;
  /** Days until the next start (0 while active). */
  startsIn: number;
  /** Day index inside the window (0-based) while active. */
  dayIndex: number;
  /** Days left including today while active. */
  daysLeft: number;
}

function windowAt(first: number, cycleDays: number, length: number, day: number): Window {
  if (day < first) return { cycle: -1, active: false, startsIn: first - day, dayIndex: 0, daysLeft: 0 };
  const off = day - first;
  const cycle = Math.floor(off / cycleDays);
  const into = off % cycleDays;
  return into < length ? { cycle, active: true, startsIn: 0, dayIndex: into, daysLeft: length - into } : { cycle, active: false, startsIn: cycleDays - into, dayIndex: 0, daysLeft: 0 };
}

export function shovelWindow(config: GameConfig, state: AccountState, now: number): Window {
  const t = config.guildEvents.shovel;
  return windowAt(t.firstServerDay, t.cycleDays, t.lengthDays, serverDay(state, now));
}

export function mergeWindow(config: GameConfig, state: AccountState, now: number): Window {
  const t = config.guildEvents.merge;
  return windowAt(t.firstServerDay, t.cycleDays, t.phases.length, serverDay(state, now));
}

function freshShovel(config: GameConfig, cycle: number): EventsState['shovel'] {
  return { cycle, credits: 0, pool: config.guildEvents.shovel.pool.start, claimed: [], shopDay: '', shopBought: [], exchange: {}, draws: 0 };
}

/** The events slice rolled to the current cycles. */
export function eventsOf(config: GameConfig, state: AccountState, now: number): EventsState {
  const cur = state.events ?? { shovel: freshShovel(config, -1), merge: { cycle: -1, points: {}, claimed: [] } };
  const sw = shovelWindow(config, state, now);
  const mw = mergeWindow(config, state, now);
  return {
    shovel: sw.active && cur.shovel.cycle !== sw.cycle ? freshShovel(config, sw.cycle) : cur.shovel,
    merge: mw.active && cur.merge.cycle !== mw.cycle ? { cycle: mw.cycle, points: {}, claimed: [] } : cur.merge,
  };
}

// ---------------------------------------------------------------- Shovel Carnival

function pickSegment(config: GameConfig, rng: () => number) {
  const wheel = config.guildEvents.shovel.wheel;
  const fixed = wheel.reduce((s, w) => s + (w.odds ?? 0), 0);
  const free = wheel.filter((w) => w.odds === undefined);
  const each = (100 - fixed) / free.length;
  let x = rng() * 100;
  for (const w of wheel) {
    x -= w.odds ?? each;
    if (x < 0) return w;
  }
  return wheel[wheel.length - 1]!;
}

function addRewards(a: Rewards, b: Record<string, number>): Rewards {
  const out = { ...a } as Record<string, number>;
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out as Rewards;
}

/** Spin the Destiny Treasure wheel 1 or 10 times (1 Treasure Shovel a spin). */
export function spinShovel(config: GameConfig, state: AccountState, now: number, times: 1 | 10): Result<{ state: AccountState; rewards: Rewards; segments: string[] }> {
  if (!shovelWindow(config, state, now).active) return fail('resource_locked', 'the Shovel Carnival is not running');
  const paid = spend(state, 'treasureShovel', times);
  if (!paid) return fail('insufficient_items', `needs ${times} Treasure Shovel(s)`);
  const t = config.guildEvents.shovel;
  const ev = eventsOf(config, state, now);
  let sh = ev.shovel;
  const rng = mulberry32(((now & 0xffffffff) ^ Math.imul(sh.draws + 1, 2654435761)) >>> 0);
  let rewards: Rewards = {};
  const segments: string[] = [];
  for (let i = 0; i < times; i += 1) {
    let pool = sh.pool + t.pool.perDraw;
    const seg = pickSegment(config, rng);
    segments.push(seg.id);
    if (seg.poolPct) {
      const gems = Math.floor((pool * seg.poolPct) / 100);
      rewards = addRewards(rewards, { gems });
      pool = Math.max(t.pool.start, pool - gems);
    } else if (seg.rewards) rewards = addRewards(rewards, seg.rewards);
    sh = { ...sh, pool, draws: sh.draws + 1, credits: sh.credits + t.creditsPerShovel };
  }
  return ok({ state: applyGrant(config, { ...paid, events: { ...ev, shovel: sh } }, rewards), rewards, segments });
}

export function claimShovelMilestone(config: GameConfig, state: AccountState, now: number, credits: number): Result<{ state: AccountState; rewards: Rewards }> {
  const ev = eventsOf(config, state, now);
  const m = config.guildEvents.shovel.milestones.find((x) => x.credits === credits);
  if (!m) return fail('not_found', 'no such milestone');
  if (ev.shovel.claimed.includes(credits)) return fail('invalid_input', 'already claimed');
  if (ev.shovel.credits < credits) return fail('resource_locked', `bank ${credits} Credits first`);
  const rewards = m.rewards as Rewards;
  return ok({ state: applyGrant(config, { ...state, events: { ...ev, shovel: { ...ev.shovel, claimed: [...ev.shovel.claimed, credits] } } }, rewards), rewards });
}

/** Buy one Treasure Shovel from a price tier (Gems; stock refreshes daily while the carnival runs). */
export function buyShovels(config: GameConfig, state: AccountState, now: number, tier: number, count = 1): Result<AccountState> {
  if (!shovelWindow(config, state, now).active) return fail('resource_locked', 'the shovel shop opens with the carnival');
  const row = config.guildEvents.shovel.shop[tier];
  if (!row || count < 1) return fail('invalid_input', 'no such tier');
  const ev = eventsOf(config, state, now);
  const today = dayKey(now);
  const bought = ev.shovel.shopDay === today ? [...ev.shovel.shopBought] : [];
  if ((bought[tier] ?? 0) + count > row.perDay) return fail('daily_limit', `only ${row.perDay} a day at this price`);
  const paid = spend(state, 'gems', row.price * count);
  if (!paid) return fail('insufficient_items', `needs ${row.price * count} Gems`);
  bought[tier] = (bought[tier] ?? 0) + count;
  for (let i = 0; i < bought.length; i += 1) bought[i] ??= 0;
  return ok(applyGrant(config, { ...paid, events: { ...ev, shovel: { ...ev.shovel, shopDay: today, shopBought: bought } } }, { treasureShovel: count }));
}

/** Happy Exchange: Treasure Pieces for items (limits per carnival; open between carnivals too). */
export function exchangeShovel(config: GameConfig, state: AccountState, now: number, id: number): Result<{ state: AccountState; rewards: Rewards }> {
  const row = config.guildEvents.shovel.exchange.find((x) => x.id === id);
  if (!row) return fail('not_found', 'no such offer');
  const ev = eventsOf(config, state, now);
  const used = ev.shovel.exchange[String(id)] ?? 0;
  if (row.limit > 0 && used >= row.limit) return fail('daily_limit', 'sold out this carnival');
  const paid = spend(state, 'treasurePiece', row.price);
  if (!paid) return fail('insufficient_items', `needs ${row.price} Treasure Pieces`);
  const rewards = row.rewards as Rewards;
  return ok({ state: applyGrant(config, { ...paid, events: { ...ev, shovel: { ...ev.shovel, exchange: { ...ev.shovel.exchange, [String(id)]: used + 1 } } } }, rewards), rewards });
}

// ---------------------------------------------------------------- Merge Event

/** The CPU ladder for a phase: 100 deterministic scores below cpuTop. */
export function mergeLadder(config: GameConfig, cycle: number, phase: string): number[] {
  const rng = mulberry32((cycle * 7919 + phase.length * 104729) >>> 0);
  const top = config.guildEvents.merge.cpuTop;
  return Array.from({ length: 100 }, (_, i) => Math.floor(top * Math.pow(0.965, i) * (0.9 + rng() * 0.1))).sort((a, b) => b - a);
}

export function mergeRank(config: GameConfig, cycle: number, phase: string, points: number): number {
  if (points <= 0) return 0;
  return 1 + mergeLadder(config, cycle, phase).filter((s) => s > points).length;
}

/** Contribute the current phase's material (perPoint units = 1 point). */
export function contributeMerge(config: GameConfig, state: AccountState, now: number, amount: number): Result<AccountState> {
  const w = mergeWindow(config, state, now);
  if (!w.active) return fail('resource_locked', 'no Merge Event phase is running');
  const phase = config.guildEvents.merge.phases[w.dayIndex]!;
  if (!Number.isInteger(amount) || amount < phase.perPoint) return fail('invalid_input', `contribute at least ${phase.perPoint}`);
  const units = Math.floor(amount / phase.perPoint) * phase.perPoint;
  const paid = spend(state, phase.currency, units);
  if (!paid) return fail('insufficient_items', `needs ${units}`);
  const ev = eventsOf(config, state, now);
  const points = { ...ev.merge.points, [phase.id]: (ev.merge.points[phase.id] ?? 0) + units / phase.perPoint };
  return ok({ ...paid, events: { ...ev, merge: { ...ev.merge, points } } });
}

/** Claim a finished phase's rank reward (until the next Merge Event starts). */
export function claimMerge(config: GameConfig, state: AccountState, now: number, phaseId: string): Result<{ state: AccountState; rewards: Rewards }> {
  const t = config.guildEvents.merge;
  const idx = t.phases.findIndex((p) => p.id === phaseId);
  if (idx < 0) return fail('not_found', 'no such phase');
  const ev = eventsOf(config, state, now);
  const w = mergeWindow(config, state, now);
  if (ev.merge.cycle < 0 || (w.active && w.cycle === ev.merge.cycle && w.dayIndex <= idx)) return fail('resource_locked', 'the phase has not ended');
  if (ev.merge.claimed.includes(phaseId)) return fail('invalid_input', 'already claimed');
  const rank = mergeRank(config, ev.merge.cycle, phaseId, ev.merge.points[phaseId] ?? 0);
  const tier = rank > 0 ? t.rankRewards.find((r) => rank <= r.rank) : undefined;
  if (!tier) return fail('resource_locked', 'no reward at this rank');
  const rewards = tier.rewards as Rewards;
  return ok({ state: applyGrant(config, { ...state, events: { ...ev, merge: { ...ev.merge, claimed: [...ev.merge.claimed, phaseId] } } }, rewards), rewards });
}

// ---------------------------------------------------------------- View

export interface EventsView {
  serverDay: number;
  shovel: {
    window: Window;
    credits: number;
    pool: number;
    shovels: number;
    pieces: number;
    milestones: { credits: number; rewards: Record<string, number>; claimed: boolean }[];
    shop: { tier: number; price: number; left: number }[];
    exchange: { id: number; name: string; price: number; left: number | null }[];
  };
  merge: {
    window: Window;
    cycle: number;
    phases: { id: string; currency: string; perPoint: number; points: number; rank: number; running: boolean; claimable: boolean; claimed: boolean; have: number }[];
  };
}

export function buildEventsView(config: GameConfig, state: AccountState, now: number): EventsView {
  const t = config.guildEvents;
  const ev = eventsOf(config, state, now);
  const sw = shovelWindow(config, state, now);
  const mw = mergeWindow(config, state, now);
  const c = state.currencies as Record<string, number>;
  const today = dayKey(now);
  return {
    serverDay: serverDay(state, now),
    shovel: {
      window: sw,
      credits: ev.shovel.credits,
      pool: ev.shovel.pool,
      shovels: c.treasureShovel ?? 0,
      pieces: c.treasurePiece ?? 0,
      milestones: t.shovel.milestones.map((m) => ({ credits: m.credits, rewards: m.rewards, claimed: ev.shovel.claimed.includes(m.credits) })),
      shop: t.shovel.shop.map((r, tier) => ({ tier, price: r.price, left: r.perDay - (ev.shovel.shopDay === today ? (ev.shovel.shopBought[tier] ?? 0) : 0) })),
      exchange: t.shovel.exchange.map((r) => ({ id: r.id, name: r.name, price: r.price, left: r.limit > 0 ? r.limit - (ev.shovel.exchange[String(r.id)] ?? 0) : null })),
    },
    merge: {
      window: mw,
      cycle: ev.merge.cycle,
      phases: t.merge.phases.map((p, i) => {
        const points = ev.merge.points[p.id] ?? 0;
        const running = mw.active && mw.cycle === ev.merge.cycle && mw.dayIndex === i;
        const ended = ev.merge.cycle >= 0 && !(mw.active && mw.cycle === ev.merge.cycle && mw.dayIndex <= i);
        const rank = mergeRank(config, Math.max(0, ev.merge.cycle), p.id, points);
        return { id: p.id, currency: p.currency, perPoint: p.perPoint, points, rank, running, claimable: ended && rank > 0 && rank <= t.merge.rankRewards[t.merge.rankRewards.length - 1]!.rank && !ev.merge.claimed.includes(p.id), claimed: ev.merge.claimed.includes(p.id), have: c[p.currency] ?? 0 };
      }),
    },
  };
}
