import type { Rewards } from '../economy/rewards';
import { mulberry32 } from '../rng';
import type { BagItem, BagOrb, HeldQuality, HoopaCard, HoopaRun, HoopaVaultRules, HoopaVaultState } from './types';

/** Held-item def ids by quality (from the content catalogue): every name at a quality drops at equal odds. */
export type HeldNamesByQuality = Partial<Record<HeldQuality, string[]>>;

export * from './types';

export type HoopaError = 'run_active' | 'no_run' | 'floor_locked' | 'multiplier_locked' | 'bad_card' | 'at_guardian' | 'not_at_guardian';

export function initialHoopaVault(): HoopaVaultState {
  return { highest: 0, keyDay: '', run: null, runs: 0 };
}

/** The highest multiplier the account may pick. */
export function maxMultiplier(rules: HoopaVaultRules, highest: number): number {
  let max = 1;
  for (const row of rules.multipliers) if (highest >= row.afterFloor) max = Math.max(max, row.max);
  return max;
}

/** Floors 1 … highest + 1 are open. */
export function floorOpen(rules: HoopaVaultRules, highest: number, floor: number): boolean {
  return Number.isInteger(floor) && floor >= 1 && floor <= Math.min(rules.floors, highest + 1);
}

/** Free keys can be claimed once per UTC day. */
export function keysClaimable(state: HoopaVaultState, day: string): boolean {
  return state.keyDay !== day;
}

function cardRng(run: { seed: number; stage: number }, salt: number): () => number {
  return mulberry32((run.seed ^ Math.imul(run.stage + 1, 0x9e3779b1) ^ salt) >>> 0);
}

/** Draw `offerSize` different cards by weight (deterministic per run and stage). */
export function drawOffer(rules: HoopaVaultRules, run: { seed: number; stage: number }): HoopaCard[] {
  const rng = cardRng(run, 0x51);
  const pool = (Object.keys(rules.run.cards) as HoopaCard[]).filter((c) => rules.run.cards[c].weight > 0);
  const out: HoopaCard[] = [];
  while (out.length < rules.run.offerSize && pool.length > 0) {
    const total = pool.reduce((s, c) => s + rules.run.cards[c].weight, 0);
    let roll = rng() * total;
    let pick = pool[0]!;
    for (const c of pool) {
      roll -= rules.run.cards[c].weight;
      if (roll < 0) {
        pick = c;
        break;
      }
    }
    out.push(pick);
    pool.splice(pool.indexOf(pick), 1);
  }
  return out;
}

export function startRun(
  rules: HoopaVaultRules,
  state: HoopaVaultState,
  floor: number,
  multiplier: number,
  seed: number,
): { ok: true; state: HoopaVaultState } | { ok: false; error: HoopaError } {
  if (state.run) return { ok: false, error: 'run_active' };
  if (!floorOpen(rules, state.highest, floor)) return { ok: false, error: 'floor_locked' };
  if (!Number.isInteger(multiplier) || multiplier < 1 || multiplier > maxMultiplier(rules, state.highest)) {
    return { ok: false, error: 'multiplier_locked' };
  }
  const base = { seed: seed >>> 0, stage: 0 };
  const run: HoopaRun = {
    floor,
    multiplier,
    escape: rules.run.startEscape,
    hoopa: 0,
    stage: 0,
    offer: drawOffer(rules, base),
    attackBoost: 0,
    dropBoost: 0,
    bag: {},
    items: [],
    orbs: [],
    atGuardian: false,
    seed: base.seed,
  };
  return { ok: true, state: { ...state, run } };
}

/** The round cap for the next route battle: the lead the player has over Hoopa. */
export function routeRoundCap(run: HoopaRun): number {
  return Math.max(1, run.escape - run.hoopa);
}

function addRewards(a: Rewards, b: Rewards): Rewards {
  const out: Record<string, number> = { ...(a as Record<string, number>) };
  for (const [k, v] of Object.entries(b as Record<string, number>)) if (v) out[k] = (out[k] ?? 0) + v;
  return out as Rewards;
}

export function resetterFactor(rules: HoopaVaultRules, floor: number): number {
  let f = 1;
  for (const row of rules.resetterFactor) if (floor >= row.floor) f = row.factor;
  return f;
}

export interface VaultDrops {
  rewards: Rewards;
  items: BagItem[];
  orbs: BagOrb[];
}

/** Draw one held item for a floor: a quality by the band's odds, then any name of that quality at equal odds. */
export function drawHeldItem(rules: HoopaVaultRules, floor: number, names: HeldNamesByQuality, rng: () => number): BagItem | null {
  const band = floorBand(rules, floor);
  if (!band) return null;
  const entries = (Object.entries(band.qualities) as [HeldQuality, number][]).filter(([q, w]) => w > 0 && (names[q]?.length ?? 0) > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return null;
  let roll = rng() * total;
  let quality = entries[0]![0];
  for (const [q, w] of entries) {
    roll -= w;
    if (roll < 0) {
      quality = q;
      break;
    }
  }
  const pool = names[quality]!;
  return { defId: pool[Math.floor(rng() * pool.length)]!, quality };
}

/** What one route win adds to the bag. Each of the `multiplier` copies rolls its own item and orb chance. */
export function stageDrops(rules: HoopaVaultRules, run: HoopaRun, card: HoopaCard, names: HeldNamesByQuality = {}): VaultDrops {
  const rng = cardRng(run, 0xd7);
  const boost = 1 + run.dropBoost + (card === 'strong' ? 0.5 : 0);
  const pay = rules.stagePay;
  const shards = Math.round((pay.heldItemShard.base + pay.heldItemShard.perFloor * run.floor) * boost) * run.multiplier;
  const rewards: Rewards = { heldItemShard: shards };
  if (rng() < Math.min(1, pay.resetterShard.chance * boost)) {
    const lump = pay.resetterShard.min + Math.floor(rng() * (pay.resetterShard.max - pay.resetterShard.min + 1));
    rewards.resetterShard = Math.round(lump * resetterFactor(rules, run.floor)) * run.multiplier;
  }
  const items: BagItem[] = [];
  const orbs: BagOrb[] = [];
  const band = floorBand(rules, run.floor);
  for (let copy = 0; copy < run.multiplier; copy += 1) {
    if (rng() < Math.min(1, rules.routeDrops.itemChance * boost)) {
      const item = drawHeldItem(rules, run.floor, names, rng);
      if (item) items.push(item);
    }
    if (band?.orb && rng() < Math.min(1, rules.routeDrops.orbChance * boost)) orbs.push({ ...band.orb });
  }
  return { rewards, items, orbs };
}

/**
 * Settle a route battle on the chosen card. A win adds the card's escape, buffs and drops; Hoopa advances by
 * the rounds fought either way. A loss, a time-out or being caught (Hoopa ≥ escape) ends the run.
 */
export function settleRoute(
  rules: HoopaVaultRules,
  state: HoopaVaultState,
  card: HoopaCard,
  win: boolean,
  rounds: number,
  names: HeldNamesByQuality = {},
): { ok: true; state: HoopaVaultState; ended: 'caught' | 'lost' | null; drops: VaultDrops } | { ok: false; error: HoopaError } {
  const none: VaultDrops = { rewards: {}, items: [], orbs: [] };
  const run = state.run;
  if (!run) return { ok: false, error: 'no_run' };
  if (run.atGuardian) return { ok: false, error: 'at_guardian' };
  if (!run.offer.includes(card)) return { ok: false, error: 'bad_card' };
  if (!win) return { ok: true, state: { ...state, run: null, runs: state.runs + 1 }, ended: 'lost', drops: none };
  const rule = rules.run.cards[card];
  const drops = stageDrops(rules, run, card, names);
  const escape = run.escape + rule.escape;
  const hoopa = run.hoopa + Math.max(0, rounds);
  if (hoopa >= escape) return { ok: true, state: { ...state, run: null, runs: state.runs + 1 }, ended: 'caught', drops: none };
  const stage = run.stage + 1;
  const next: HoopaRun = {
    ...run,
    escape,
    hoopa,
    stage,
    attackBoost: run.attackBoost + rule.attackBoost,
    dropBoost: run.dropBoost + rule.dropBoost,
    bag: addRewards(run.bag, drops.rewards),
    items: [...run.items, ...drops.items],
    orbs: [...run.orbs, ...drops.orbs],
    atGuardian: escape >= rules.run.target,
    offer: escape >= rules.run.target ? [] : drawOffer(rules, { seed: run.seed, stage }),
  };
  return { ok: true, state: { ...state, run: next }, ended: null, drops };
}

/** The Exit Guardian's pay on a win (before the bag): shards and `items` held items per multiplier copy. */
export function guardianDrops(rules: HoopaVaultRules, run: HoopaRun, names: HeldNamesByQuality = {}): VaultDrops {
  const rng = cardRng(run, 0x6a);
  const r = rules.guardianPay.resetterShard;
  const lump = r.min + Math.floor(rng() * (r.max - r.min + 1));
  const items: BagItem[] = [];
  for (let i = 0; i < rules.guardianPay.items * run.multiplier; i += 1) {
    const item = drawHeldItem(rules, run.floor, names, rng);
    if (item) items.push(item);
  }
  return {
    rewards: {
      resetterShard: Math.round(lump * resetterFactor(rules, run.floor)) * run.multiplier,
      heldItemShard: rules.guardianPay.heldItemShard * run.multiplier,
    },
    items,
    orbs: [],
  };
}

/** Settle the Exit Guardian. A win keeps the bag plus the guardian's pay and clears the floor. */
export function settleGuardian(
  rules: HoopaVaultRules,
  state: HoopaVaultState,
  win: boolean,
  names: HeldNamesByQuality = {},
): { ok: true; state: HoopaVaultState; kept: VaultDrops; floor: number } | { ok: false; error: HoopaError } {
  const run = state.run;
  if (!run) return { ok: false, error: 'no_run' };
  if (!run.atGuardian) return { ok: false, error: 'not_at_guardian' };
  const done = { ...state, run: null, runs: state.runs + 1 };
  if (!win) return { ok: true, state: done, kept: { rewards: {}, items: [], orbs: [] }, floor: run.floor };
  const guard = guardianDrops(rules, run, names);
  const kept: VaultDrops = {
    rewards: addRewards(run.bag, guard.rewards),
    items: [...run.items, ...guard.items],
    orbs: [...run.orbs, ...guard.orbs],
  };
  return { ok: true, state: { ...done, highest: Math.max(state.highest, run.floor) }, kept, floor: run.floor };
}

/** Leave the run: the bag is lost (the server refunds the keys). */
export function exitRun(state: HoopaVaultState): { ok: true; state: HoopaVaultState; run: HoopaRun } | { ok: false; error: HoopaError } {
  if (!state.run) return { ok: false, error: 'no_run' };
  return { ok: true, state: { ...state, run: null, runs: state.runs + 1 }, run: state.run };
}

/** The band a floor sits in (the source's drop pool and its note). */
export function floorBand(rules: HoopaVaultRules, floor: number): HoopaVaultRules['bands'][number] | null {
  let band: HoopaVaultRules['bands'][number] | null = null;
  for (const row of rules.bands) if (floor >= row.floor) band = row;
  return band;
}
