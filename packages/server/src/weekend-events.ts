import { ghostRecords, mulberry32, rankDamage, weekKey, weekdayUtc, type AccountState, type Rewards } from '@wildbound/engine';
import type { GameConfig } from './config';
import { lastWeekCounter, weeklyCounter, type CounterKey } from './counters';
import { applyGrant } from './economy';
import { fail, ok, type Result } from './index';
import { grantTitleCards } from './titles';

/**
 * Weekend Bash and the Flower Event, from the owner's wiki (no source tables):
 * - Elven Treasure (Monday → Friday reset): flip tiles of a 5×5 board for 1 Elven Treasure each; the grand prize hides in
 *   one of the last 4 tiles; each found grand prize starts the next round. 35 treasures a round for Gems (10 at 24,
 *   25 at 35); spending pays cashback treasures; Milk buys from the Pet Exchange.
 * - Bingo (Friday → Monday reset): each Strawberry Sauce opens a random number 1–16 on a 4×4 card (repeats wasted);
 *   rows pay Strawberry Cake, columns fixed prizes, diagonals a chosen wildcard; a full card can be reset. Sauce for
 *   Gems (40 at 20, 40 at 30); Cake buys from the exchange.
 * - Flower Event (weekly, Monday reset): flowers come from this week's activity steps; milestone chests; last week's
 *   total ranks against CPU players. Gifting needs other players and is not built.
 * See docs/design/weekend-flower-events.md.
 */

export type WeekendState = NonNullable<AccountState['weekend']>;
const DAY = 86_400_000;

/** The running event window for a set of UTC weekdays (first day's date is the key). */
function windowKey(weekdays: number[], now: number): string | null {
  if (!weekdays.includes(weekdayUtc(now))) return null;
  let t = now;
  while (weekdays.includes(weekdayUtc(t - DAY)) && weekdays.indexOf(weekdayUtc(t - DAY)) < weekdays.indexOf(weekdayUtc(t))) t -= DAY;
  return new Date(t).toISOString().slice(0, 10);
}

export function elvenKey(config: GameConfig, now: number): string | null {
  return windowKey(config.weekendEvents.elven.weekdays, now);
}

export function bingoKey(config: GameConfig, now: number): string | null {
  return windowKey(config.weekendEvents.bingo.weekdays, now);
}

function grandSlot(key: string, round: number, config: GameConfig): number {
  const e = config.weekendEvents.elven;
  const rng = mulberry32((Date.parse(key) / DAY + round * 97) >>> 0);
  return e.tiles - e.grandIn + 1 + Math.floor(rng() * e.grandIn);
}

function freshElven(config: GameConfig, key: string): WeekendState['elven'] {
  return { key, round: 1, flips: 0, grandAt: grandSlot(key, 1, config), bought: 0, spent: 0, cashback: [], exchange: {} };
}

function freshBingo(key: string): WeekendState['bingo'] {
  return { key, marked: [], claimed: [], draws: 0, bought: [0, 0], cards: 0, exchange: {} };
}

export function weekendOf(config: GameConfig, state: AccountState, now: number): WeekendState {
  const cur = state.weekend ?? { elven: freshElven(config, ''), bingo: freshBingo(''), flower: { week: weekKey(now), claimed: [], lastClaimed: '' } };
  const ek = elvenKey(config, now);
  const bk = bingoKey(config, now);
  return {
    elven: ek && cur.elven.key !== ek ? freshElven(config, ek) : cur.elven,
    bingo: bk && cur.bingo.key !== bk ? freshBingo(bk) : cur.bingo,
    flower: cur.flower.week !== weekKey(now) ? { ...cur.flower, week: weekKey(now), claimed: [] } : cur.flower,
  };
}

function spend(state: AccountState, currency: string, n: number): AccountState | null {
  const have = (state.currencies as Record<string, number>)[currency] ?? 0;
  if (have < n) return null;
  return { ...state, currencies: { ...state.currencies, [currency]: have - n } };
}

function add(a: Rewards, b: Record<string, number>): Rewards {
  const out = { ...a } as Record<string, number>;
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out as Rewards;
}

// ---------------------------------------------------------------- Elven Treasure

export function elvenPrice(config: GameConfig, bought: number): number | null {
  return config.weekendEvents.elven.buy.find((b) => bought < b.upTo)?.price ?? null;
}

export function buyElven(config: GameConfig, state: AccountState, now: number, count: number): Result<AccountState> {
  if (!elvenKey(config, now)) return fail('resource_locked', 'Elven Treasure runs Monday to Friday');
  if (!Number.isInteger(count) || count < 1) return fail('invalid_input', 'buy at least one');
  const w = weekendOf(config, state, now);
  let cost = 0;
  for (let i = 0; i < count; i += 1) {
    const p = elvenPrice(config, w.elven.bought + i);
    if (p === null) return fail('daily_limit', 'no more Elven Treasure for sale this round');
    cost += p;
  }
  const paid = spend(state, 'gems', cost);
  if (!paid) return fail('insufficient_items', `needs ${cost} Gems`);
  return ok(applyGrant(config, { ...paid, weekend: { ...w, elven: { ...w.elven, bought: w.elven.bought + count } } }, { elvenTreasure: count }));
}

/** Flip one tile. The grand prize ends the round and starts the next board. */
export function flipElven(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; rewards: Rewards; grand: boolean; round: number }> {
  if (!elvenKey(config, now)) return fail('resource_locked', 'Elven Treasure runs Monday to Friday');
  const e = config.weekendEvents.elven;
  const paid = spend(state, 'elvenTreasure', 1);
  if (!paid) return fail('insufficient_items', 'needs 1 Elven Treasure');
  const w = weekendOf(config, state, now);
  let el = { ...w.elven, flips: w.elven.flips + 1, spent: w.elven.spent + 1 };
  const grand = el.flips >= el.grandAt;
  let rewards: Rewards = { ...e.tileReward } as Rewards;
  let next = paid;
  const round = el.round;
  if (grand) {
    const g = e.grand.find((x) => x.round === el.round);
    if (g) {
      rewards = add(rewards, g.rewards);
      if (g.titleCard) next = grantTitleCards(next, g.titleCard, 1);
    }
    el = { ...el, round: el.round + 1, flips: 0, grandAt: grandSlot(el.key, el.round + 1, config) };
  }
  for (const [at, bonus] of e.cashback) {
    if (el.spent >= at && !el.cashback.includes(at)) {
      el = { ...el, cashback: [...el.cashback, at] };
      rewards = add(rewards, { elvenTreasure: bonus });
    }
  }
  return ok({ state: applyGrant(config, { ...next, weekend: { ...w, elven: el } }, rewards), rewards, grand, round });
}

/** Pet Exchange (Milk) / Cake exchange; limits per event round. */
export function buyWeekendExchange(config: GameConfig, state: AccountState, now: number, kind: 'elven' | 'bingo', id: number): Result<{ state: AccountState; rewards: Rewards }> {
  const row = config.weekendEvents[kind].exchange.find((r) => r.id === id);
  if (!row) return fail('not_found', 'no such offer');
  const w = weekendOf(config, state, now);
  const used = w[kind].exchange[String(id)] ?? 0;
  if (row.limit > 0 && used >= row.limit) return fail('daily_limit', 'sold out this round');
  const paid = spend(state, kind === 'elven' ? 'milk' : 'strawberryCake', row.price);
  if (!paid) return fail('insufficient_items', `needs ${row.price}`);
  const next = { ...w, [kind]: { ...w[kind], exchange: { ...w[kind].exchange, [String(id)]: used + 1 } } } as WeekendState;
  return ok({ state: applyGrant(config, { ...paid, weekend: next }, row.rewards as Rewards), rewards: row.rewards as Rewards });
}

// ---------------------------------------------------------------- Bingo

export function buySauce(config: GameConfig, state: AccountState, now: number, tier: number, count: number): Result<AccountState> {
  if (!bingoKey(config, now)) return fail('resource_locked', 'Bingo runs Friday to Monday');
  const row = config.weekendEvents.bingo.sauceShop[tier];
  if (!row || !Number.isInteger(count) || count < 1) return fail('invalid_input', 'no such offer');
  const w = weekendOf(config, state, now);
  const bought = [...w.bingo.bought];
  if ((bought[tier] ?? 0) + count > row.limit) return fail('daily_limit', `only ${row.limit} at this price a round`);
  const paid = spend(state, 'gems', row.price * count);
  if (!paid) return fail('insufficient_items', `needs ${row.price * count} Gems`);
  bought[tier] = (bought[tier] ?? 0) + count;
  return ok(applyGrant(config, { ...paid, weekend: { ...w, bingo: { ...w.bingo, bought } } }, { strawberrySauce: count }));
}

/** Open 1 or 5 numbers (1 Strawberry Sauce each). */
export function drawBingo(config: GameConfig, state: AccountState, now: number, times: 1 | 5): Result<{ state: AccountState; numbers: number[] }> {
  if (!bingoKey(config, now)) return fail('resource_locked', 'Bingo runs Friday to Monday');
  const b = config.weekendEvents.bingo;
  const w = weekendOf(config, state, now);
  if (w.bingo.marked.length >= b.numbers) return fail('invalid_input', 'the card is full — reset it for a new card');
  const paid = spend(state, 'strawberrySauce', times);
  if (!paid) return fail('insufficient_items', `needs ${times} Strawberry Sauce`);
  const rng = mulberry32(((now / 1000) ^ Math.imul(w.bingo.draws + 1, 2654435761)) >>> 0);
  const marked = new Set(w.bingo.marked);
  const numbers: number[] = [];
  for (let i = 0; i < times; i += 1) {
    const n = 1 + Math.floor(rng() * b.numbers);
    numbers.push(n);
    marked.add(n);
  }
  return ok({ state: { ...paid, weekend: { ...w, bingo: { ...w.bingo, marked: [...marked].sort((x, y) => x - y), draws: w.bingo.draws + times } } }, numbers });
}

export function claimBingoLine(config: GameConfig, state: AccountState, now: number, lineId: string, pick?: string): Result<{ state: AccountState; rewards: Rewards }> {
  const b = config.weekendEvents.bingo;
  const w = weekendOf(config, state, now);
  const line = b.lines.find((l) => l.id === lineId);
  if (!line) return fail('not_found', 'no such line');
  if (w.bingo.claimed.includes(lineId)) return fail('invalid_input', 'already claimed');
  if (!line.cells.every((c) => w.bingo.marked.includes(c))) return fail('resource_locked', 'the line is not complete');
  let rewards = line.rewards as Rewards | undefined;
  if (line.wildcard) {
    const opt = b.wildcards[line.wildcard - 1]?.find((o) => o.id === pick);
    if (!opt) return fail('invalid_input', 'pick a wildcard prize');
    rewards = opt.rewards as Rewards;
  }
  return ok({ state: applyGrant(config, { ...state, weekend: { ...w, bingo: { ...w.bingo, claimed: [...w.bingo.claimed, lineId] } } }, rewards ?? {}), rewards: rewards ?? {} });
}

/** Start a new card once the current one is full and every line is claimed. */
export function resetBingo(config: GameConfig, state: AccountState, now: number): Result<AccountState> {
  const b = config.weekendEvents.bingo;
  const w = weekendOf(config, state, now);
  if (w.bingo.marked.length < b.numbers) return fail('invalid_input', 'finish the card first');
  if (w.bingo.claimed.length < b.lines.length) return fail('invalid_input', 'claim every line first');
  return ok({ ...state, weekend: { ...w, bingo: { ...w.bingo, marked: [], claimed: [], cards: w.bingo.cards + 1 } } });
}

// ---------------------------------------------------------------- Flower Event

function flowersFrom(config: GameConfig, value: (key: CounterKey) => number): number {
  let total = 0;
  for (const t of config.weekendEvents.flower.tasks) {
    const v = value(t.source as CounterKey);
    for (const [at, f] of t.steps) if (v >= at) total += f;
  }
  return total;
}

export function flowersThisWeek(config: GameConfig, state: AccountState, now: number): number {
  return flowersFrom(config, (k) => weeklyCounter(state, now, k));
}

export function flowerRank(config: GameConfig, week: string, flowers: number): number {
  if (flowers <= 0) return 0;
  const seed = week.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 5) >>> 0;
  return rankDamage(flowers, ghostRecords([config.weekendEvents.flower.cpuTop], seed, 99));
}

export function claimFlowerMilestone(config: GameConfig, state: AccountState, now: number, flowers: number): Result<{ state: AccountState; rewards: Rewards }> {
  const m = config.weekendEvents.flower.milestones.find((x) => x.flowers === flowers);
  if (!m) return fail('not_found', 'no such chest');
  const w = weekendOf(config, state, now);
  if (w.flower.claimed.includes(flowers)) return fail('invalid_input', 'already claimed');
  if (flowersThisWeek(config, state, now) < flowers) return fail('resource_locked', `collect ${flowers} flowers first`);
  return ok({ state: applyGrant(config, { ...state, weekend: { ...w, flower: { ...w.flower, claimed: [...w.flower.claimed, flowers] } } }, m.rewards as Rewards), rewards: m.rewards as Rewards });
}

function lastWeekFlowers(config: GameConfig, state: AccountState, now: number): { week: string; flowers: number } {
  let week = '';
  const flowers = flowersFrom(config, (k) => {
    const r = lastWeekCounter(state, now, k);
    week = r.week;
    return r.week === weekKey(now - 7 * DAY) ? r.value : 0;
  });
  return { week, flowers };
}

export function claimFlowerRank(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; rewards: Rewards }> {
  const w = weekendOf(config, state, now);
  const last = lastWeekFlowers(config, state, now);
  if (!last.week || last.flowers <= 0) return fail('not_ready', 'no flowers last week');
  if (w.flower.lastClaimed === last.week) return fail('invalid_input', 'already claimed');
  const rank = flowerRank(config, last.week, last.flowers);
  const row = config.weekendEvents.flower.ranks.find((r) => rank <= r.rank);
  if (!row) return fail('resource_locked', 'no reward at this rank');
  return ok({ state: applyGrant(config, { ...state, weekend: { ...w, flower: { ...w.flower, lastClaimed: last.week } } }, row.rewards as Rewards), rewards: row.rewards as Rewards });
}

// ---------------------------------------------------------------- View

export interface WeekendView {
  elven: { open: boolean; round: number; flips: number; tiles: number; treasures: number; milk: number; price: number | null; bought: number; spent: number; nextGrand: Record<string, number> | null; exchange: { id: number; name: string; price: number }[] };
  bingo: { open: boolean; marked: number[]; lines: { id: string; cells: number[]; done: boolean; claimed: boolean; rewards: Record<string, number> | null; wildcard: { id: string; rewards: Record<string, number> }[] | null }[]; sauce: number; cake: number; shop: { tier: number; price: number; left: number }[]; full: boolean; exchange: { id: number; name: string; price: number }[] };
  flower: { flowers: number; rank: number; tasks: { label: string; value: number; steps: [number, number][] }[]; milestones: { flowers: number; rewards: Record<string, number>; claimed: boolean }[]; lastWeek: { flowers: number; rank: number; claimable: boolean } | null };
}

export function buildWeekendView(config: GameConfig, state: AccountState, now: number): WeekendView {
  const t = config.weekendEvents;
  const w = weekendOf(config, state, now);
  const c = state.currencies as Record<string, number>;
  const flowers = flowersThisWeek(config, state, now);
  const last = lastWeekFlowers(config, state, now);
  return {
    elven: {
      open: !!elvenKey(config, now),
      round: w.elven.round,
      flips: w.elven.flips,
      tiles: t.elven.tiles,
      treasures: c.elvenTreasure ?? 0,
      milk: c.milk ?? 0,
      price: elvenPrice(config, w.elven.bought),
      bought: w.elven.bought,
      spent: w.elven.spent,
      nextGrand: t.elven.grand.find((g) => g.round === w.elven.round)?.rewards ?? null,
      exchange: t.elven.exchange.map((r) => ({ id: r.id, name: r.name, price: r.price })),
    },
    bingo: {
      open: !!bingoKey(config, now),
      marked: w.bingo.marked,
      lines: t.bingo.lines.map((l) => ({ id: l.id, cells: l.cells, done: l.cells.every((x) => w.bingo.marked.includes(x)), claimed: w.bingo.claimed.includes(l.id), rewards: l.rewards ?? null, wildcard: l.wildcard ? (t.bingo.wildcards[l.wildcard - 1] ?? null) : null })),
      sauce: c.strawberrySauce ?? 0,
      cake: c.strawberryCake ?? 0,
      shop: t.bingo.sauceShop.map((r, tier) => ({ tier, price: r.price, left: r.limit - (w.bingo.bought[tier] ?? 0) })),
      full: w.bingo.marked.length >= t.bingo.numbers,
      exchange: t.bingo.exchange.map((r) => ({ id: r.id, name: r.name, price: r.price })),
    },
    flower: {
      flowers,
      rank: flowerRank(config, weekKey(now), flowers),
      tasks: t.flower.tasks.map((x) => ({ label: x.label, value: weeklyCounter(state, now, x.source as CounterKey), steps: x.steps })),
      milestones: t.flower.milestones.map((m) => ({ flowers: m.flowers, rewards: m.rewards, claimed: w.flower.claimed.includes(m.flowers) })),
      lastWeek: last.flowers > 0 ? { flowers: last.flowers, rank: flowerRank(config, last.week, last.flowers), claimable: w.flower.lastClaimed !== last.week } : null,
    },
  };
}
