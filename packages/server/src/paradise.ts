import {
  dayKey,
  dexStars,
  explore,
  initialParadise,
  mulberry32,
  rollParadise,
  throwBall,
  track,
  upgradeGear,
  paradiseSeason,
  gearFloor,
  type AccountState,
  type CurrencyId,
  type ParadiseBall,
  type ParadiseRules,
  type ParadiseState,
  type Rewards,
} from '@wildbound/engine';
import type { GameConfig } from './config';
import { applyGrant } from './economy';
import { grantDraws } from './gacha';
import { fail, ok, type Result } from './index';

/**
 * Pokémon Paradise (M14.3, the source's poke_catching): explore, track, catch; the seasonal Dex and its star rewards;
 * gear; the Park shop. A catch adds the Pokémon at its card's star; a Pokémon that flees leaves its shards. Opens after
 * story 2-5. See docs/design/paradise.md.
 */

export function paradiseRules(config: GameConfig): ParadiseRules {
  return config.paradise as unknown as ParadiseRules;
}

export const PARADISE_GATE = 'c2-5';

export function paradiseOpen(state: AccountState): boolean {
  return (state.campaign.stars[PARADISE_GATE] ?? 0) > 0;
}

export function prepareParadise(config: GameConfig, state: AccountState, now: number): { state: AccountState; changed: boolean } {
  const rules = paradiseRules(config);
  const day = dayKey(now);
  const current = state.paradise ?? initialParadise(rules, now, day);
  const rolled = rollParadise(rules, current, now, day);
  if (rolled === state.paradise) return { state, changed: false };
  return { state: { ...state, paradise: rolled }, changed: true };
}

const LOCKED = 'Pokémon Paradise opens after story 2-5';
let salt = 0;
const rngFor = (now: number, extra = 0) => mulberry32(((now & 0xffffffff) ^ 0x9a7a ^ Math.imul(++salt + extra, 2654435761)) >>> 0);

function withPark(state: AccountState, park: ParadiseState): AccountState {
  return { ...state, paradise: park };
}

export function exploreParadise(config: GameConfig, state: AccountState, now: number): Result<AccountState> {
  if (!paradiseOpen(state)) return fail('resource_locked', LOCKED);
  const prepared = prepareParadise(config, state, now).state;
  const out = explore(paradiseRules(config), prepared.paradise!, rngFor(now));
  if (!out.ok) return fail(out.error === 'no_stamina' ? 'daily_limit' : 'invalid_input', out.error === 'no_stamina' ? 'no stamina left today' : 'finish the current route first');
  return ok(withPark(prepared, out.state));
}

export function trackParadise(config: GameConfig, state: AccountState, now: number, useScanner = false): Result<{ state: AccountState; success: boolean }> {
  if (!paradiseOpen(state)) return fail('resource_locked', LOCKED);
  const prepared = prepareParadise(config, state, now).state;
  if (useScanner && (prepared.currencies.scanner ?? 0) < 1) return fail('insufficient_items', 'no Scanners');
  const out = track(paradiseRules(config), prepared.paradise!, rngFor(now, 1), useScanner);
  if (!out.ok) return fail('invalid_input', out.error === 'at_pokemon' ? 'the Pokémon is here — throw a ball' : 'explore first');
  let next = withPark(prepared, out.state);
  if (useScanner) next = { ...next, currencies: { ...next.currencies, scanner: (next.currencies.scanner ?? 0) - 1 } };
  return ok({ state: next, success: out.success });
}

const BALL_CURRENCY: Record<ParadiseBall, CurrencyId | null> = { poke: null, advanced: 'ballAdvanced', master: 'ballMaster' };

export interface ParadiseThrow {
  state: AccountState;
  caught: boolean;
  species: string;
  points: number;
  shards: Record<string, number>;
}

/** Throw a ball at the Pokémon. Poké Balls are unlimited; a miss lets it flee and leaves its shards. */
export function throwParadiseBall(config: GameConfig, state: AccountState, now: number, ball: ParadiseBall): Result<ParadiseThrow> {
  if (!paradiseOpen(state)) return fail('resource_locked', LOCKED);
  const prepared = prepareParadise(config, state, now).state;
  const currency = BALL_CURRENCY[ball];
  if (currency && (prepared.currencies[currency] ?? 0) < 1) return fail('insufficient_items', `no ${ball === 'master' ? 'Master' : 'Advanced'} Balls`);
  const out = throwBall(paradiseRules(config), prepared.paradise!, rngFor(now, 2), ball);
  if (!out.ok) return fail('invalid_input', out.error === 'not_pokemon' ? 'track the route to the Pokémon first' : 'explore first');
  const v = out.value;
  let next = withPark(prepared, v.state);
  if (currency && !v.ballKept) next = { ...next, currencies: { ...next.currencies, [currency]: (next.currencies[currency] ?? 0) - 1 } };
  let shards: Record<string, number> = {};
  if (v.caught) {
    const meta = config.species.get(v.entry.species);
    if (meta) next = grantDraws(next, [{ speciesId: v.entry.species, star: v.entry.star, tier: meta.tier, group: 'other' }], now).state;
  } else {
    shards = v.entry.fleeShards;
    const speciesShards = { ...next.speciesShards };
    for (const [id, n] of Object.entries(shards)) speciesShards[id] = (speciesShards[id] ?? 0) + n;
    next = { ...next, speciesShards };
  }
  return ok({ state: next, caught: v.caught, species: v.entry.species, points: v.points, shards });
}

export function leaveParadiseRoute(config: GameConfig, state: AccountState, now: number): Result<AccountState> {
  const prepared = prepareParadise(config, state, now).state;
  return ok(withPark(prepared, { ...prepared.paradise!, encounter: null }));
}

export function upgradeParadiseGear(config: GameConfig, state: AccountState, now: number, type: number): Result<AccountState> {
  if (!paradiseOpen(state)) return fail('resource_locked', LOCKED);
  const prepared = prepareParadise(config, state, now).state;
  const out = upgradeGear(paradiseRules(config), prepared.paradise!, type);
  if (!out.ok) return fail('invalid_input', out.error);
  return ok(withPark(prepared, out.state));
}

function payPrize(config: GameConfig, state: AccountState, now: number, rewards: Rewards, boxes: string[] | undefined, seed: number): AccountState {
  let next = applyGrant(config, state, rewards);
  if (boxes?.length) {
    const rng = mulberry32(seed >>> 0);
    const draws = boxes.map((faction) => {
      const rows = config.paradise.evolveBoxes[faction as 'water' | 'fire' | 'grass'];
      const total = rows.reduce((s, r) => s + r.weight, 0);
      let x = rng() * total;
      const row = rows.find((r) => (x -= r.weight) < 0) ?? rows[rows.length - 1]!;
      return { speciesId: row.species, star: row.star, tier: config.species.get(row.species)!.tier, group: 'other' as const };
    });
    next = grantDraws(next, draws, now).state;
  }
  return next;
}

/** Claim a Dex star milestone. */
export function claimParadiseStars(config: GameConfig, state: AccountState, now: number, stars: number): Result<{ state: AccountState; rewards: Rewards }> {
  if (!paradiseOpen(state)) return fail('resource_locked', LOCKED);
  const rules = paradiseRules(config);
  const prepared = prepareParadise(config, state, now).state;
  const park = prepared.paradise!;
  const row = paradiseSeason(rules, park.cycle).starRewards.find((r) => r.stars === stars);
  if (!row) return fail('not_found', 'no such milestone');
  const key = `stars:${stars}`;
  if (park.claimed.includes(key)) return fail('invalid_input', 'already claimed');
  if (dexStars(rules, park) < stars) return fail('not_ready', `reach ${stars} Dex stars first`);
  const paid = payPrize(config, withPark(prepared, { ...park, claimed: [...park.claimed, key] }), now, row.rewards, row.evolveBoxes, now ^ stars);
  return ok({ state: paid, rewards: row.rewards });
}

/** Buy from the Park shop with Paradise Points or Exploration EXP (per-Park limits, gear-level gates). */
export function buyParadiseShop(config: GameConfig, state: AccountState, now: number, id: number): Result<{ state: AccountState; rewards: Rewards }> {
  if (!paradiseOpen(state)) return fail('resource_locked', LOCKED);
  const rules = paradiseRules(config);
  const prepared = prepareParadise(config, state, now).state;
  const park = prepared.paradise!;
  const row = paradiseSeason(rules, park.cycle).shop.find((r) => r.id === id);
  if (!row) return fail('not_found', 'no such offer');
  if (gearFloor(park) < row.gearLevel) return fail('resource_locked', `needs all gear at Lv ${row.gearLevel}`);
  const bought = park.bought[String(id)] ?? 0;
  if (bought >= row.limit) return fail('daily_limit', 'sold out this Park');
  if (row.points && park.points < row.points) return fail('insufficient_items', `needs ${row.points} Paradise Points`);
  if (row.exp && park.exp < row.exp) return fail('insufficient_items', `needs ${row.exp} Exploration EXP`);
  const nextPark = { ...park, points: park.points - (row.points ?? 0), exp: park.exp - (row.exp ?? 0), bought: { ...park.bought, [String(id)]: bought + 1 } };
  return ok({ state: payPrize(config, withPark(prepared, nextPark), now, row.rewards, row.evolveBoxes, now ^ (id * 7919)), rewards: row.rewards });
}
