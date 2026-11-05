import type { Rewards } from '../economy/rewards';
import { weekKey } from '../pve/reset';
import type { RiftDifficultyRule, RiftExtras, RiftMerchantOffer, RiftRules, RiftState } from './types';

export * from './types';

export type RiftError =
  | 'season_closed'
  | 'floor_locked'
  | 'no_lives'
  | 'chest_locked'
  | 'chest_claimed'
  | 'offer_missing'
  | 'offer_locked'
  | 'offer_sold_out';

const HOUR = 3_600_000;

/** ISO weekday (1 = Monday … 7 = Sunday) and the UTC hour of a moment. */
function isoDay(ms: number): { day: number; hour: number } {
  const d = new Date(ms);
  return { day: ((d.getUTCDay() + 6) % 7) + 1, hour: d.getUTCHours() };
}

/** Whether the season is open now (source: Tue 07:00 → Sun 22:00 UTC). */
export function riftSeasonOpen(rules: RiftRules, now: number): boolean {
  const { day, hour } = isoDay(now);
  const t = day * 24 + hour;
  const { openDay, openHour, endDay, endHour } = rules.season;
  return t >= openDay * 24 + openHour && t < endDay * 24 + endHour;
}

/** Milliseconds until the season ends (open) or opens (closed). */
export function riftSeasonCountdown(rules: RiftRules, now: number): number {
  const { day, hour } = isoDay(now);
  const into = ((day - 1) * 24 + hour) * HOUR + (now % HOUR);
  const target = riftSeasonOpen(rules, now)
    ? ((rules.season.endDay - 1) * 24 + rules.season.endHour) * HOUR
    : ((rules.season.openDay - 1) * 24 + rules.season.openHour) * HOUR;
  const week = 7 * 24 * HOUR;
  return (((target - into) % week) + week) % week;
}

export function riftDifficultyFor(rules: RiftRules, resonance: number): RiftDifficultyRule {
  let pick = rules.difficulties[0]!;
  for (const row of rules.difficulties) if (resonance >= row.minResonance) pick = row;
  return pick;
}

export function riftDifficulty(rules: RiftRules, state: RiftState): RiftDifficultyRule {
  return rules.difficulties.find((d) => d.difficulty === state.difficulty) ?? rules.difficulties[0]!;
}

export function initialRift(): RiftState {
  return { season: '', difficulty: 1, highest: 0, lives: 0, livesDay: '', challenges: 0, claimedChests: [], bought: {} };
}

/**
 * Roll the state forward: a new season resets progress and locks a difficulty from the current resonance;
 * a new UTC day refills the lives. `ended` reports the season that just closed (its leftover coins convert).
 */
export function rollRift(
  rules: RiftRules,
  state: RiftState,
  now: number,
  resonance: number,
): { state: RiftState; newSeason: boolean } {
  const season = weekKey(now);
  const day = new Date(now).toISOString().slice(0, 10);
  let next = state;
  let newSeason = false;
  if (state.season !== season) {
    next = { ...initialRift(), season, difficulty: riftDifficultyFor(rules, resonance).difficulty };
    newSeason = state.season !== '';
  }
  if (next.livesDay !== day) next = { ...next, lives: rules.livesPerDay, livesDay: day };
  return { state: next, newSeason };
}

export function isBossFloor(rules: RiftRules, floor: number): boolean {
  return floor % rules.bossEvery === 0;
}

/** The next floor to fight (one past the highest cleared), or null when all are cleared. */
export function nextRiftFloor(rules: RiftRules, state: RiftState): number | null {
  return state.highest >= rules.floors ? null : state.highest + 1;
}

/** What a win on a floor drops. */
export function riftDrops(rules: RiftRules, floor: number): Rewards {
  const advanced = floor > rules.easyFloors;
  const boss = isBossFloor(rules, floor);
  return advanced ? (boss ? rules.drops.advancedBoss : rules.drops.advanced) : boss ? rules.drops.easyBoss : rules.drops.easy;
}

/** The Easy-track floor reward reached on this floor (difficulty's table), if any. */
export function riftFloorReward(rules: RiftRules, state: RiftState, floor: number): Rewards | null {
  return riftDifficulty(rules, state).floorRewards.find((r) => r.floor === floor)?.rewards ?? null;
}

/** Can the player challenge now? (season open, lives left, a floor left). */
export function riftChallengeBlock(rules: RiftRules, state: RiftState, now: number): RiftError | null {
  if (!riftSeasonOpen(rules, now)) return 'season_closed';
  if (nextRiftFloor(rules, state) === null) return 'floor_locked';
  if (state.lives <= 0) return 'no_lives';
  return null;
}

/** Settle a challenge on the next floor: a win clears it, a loss costs a life. Both count toward chests. */
export function settleRift(
  rules: RiftRules,
  state: RiftState,
  win: boolean,
): { state: RiftState; floor: number; rewards: Rewards; extras: RiftExtras } {
  const floor = state.highest + 1;
  const counted = { ...state, challenges: state.challenges + 1 };
  if (!win) return { state: { ...counted, lives: Math.max(0, state.lives - 1) }, floor, rewards: {}, extras: {} };
  const drops = riftDrops(rules, floor);
  const bonus = riftFloorReward(rules, state, floor);
  const milestone = rules.milestones.find((m) => m.floor === floor);
  const rewards: Record<string, number> = { ...(drops as Record<string, number>) };
  for (const add of [bonus ?? {}, milestone?.rewards ?? {}]) {
    for (const [k, v] of Object.entries(add as Record<string, number>)) rewards[k] = (rewards[k] ?? 0) + v;
  }
  const extras: RiftExtras = milestone ? { ...(milestone.orbs ? { orbs: milestone.orbs } : {}), ...(milestone.mythicHeld ? { mythicHeld: milestone.mythicHeld } : {}) } : {};
  return { state: { ...counted, highest: floor }, floor, rewards: rewards as Rewards, extras };
}

/** The Merchant rows open this season (their unlock floor is cleared). */
export function merchantOpen(rules: RiftRules, state: RiftState, offer: RiftMerchantOffer): boolean {
  return state.highest >= offer.unlockFloor;
}

/** Buy one Merchant row (the server checks and takes the price). */
export function buyMerchant(
  rules: RiftRules,
  state: RiftState,
  id: string,
): { ok: true; state: RiftState; offer: RiftMerchantOffer } | { ok: false; error: RiftError } {
  const offer = rules.merchant.find((o) => o.id === id);
  if (!offer) return { ok: false, error: 'offer_missing' };
  if (!merchantOpen(rules, state, offer)) return { ok: false, error: 'offer_locked' };
  const used = state.bought[id] ?? 0;
  if (used >= offer.limit) return { ok: false, error: 'offer_sold_out' };
  return { ok: true, state: { ...state, bought: { ...state.bought, [id]: used + 1 } }, offer };
}

export function claimRiftChest(
  rules: RiftRules,
  state: RiftState,
  challenges: number,
): { ok: true; state: RiftState; rewards: Rewards } | { ok: false; error: RiftError } {
  const chest = rules.chests.find((c) => c.challenges === challenges);
  if (!chest || state.challenges < challenges) return { ok: false, error: 'chest_locked' };
  if (state.claimedChests.includes(challenges)) return { ok: false, error: 'chest_claimed' };
  return { ok: true, state: { ...state, claimedChests: [...state.claimedChests, challenges] }, rewards: chest.rewards };
}
