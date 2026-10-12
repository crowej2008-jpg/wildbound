/**
 * Reward bundles (M5, PROMPT §7.4). A `Rewards` value is a partial payout over
 * the currencies plus trainer `xp`. Leaf module: it imports nothing so campaign,
 * daily and the account state can all depend on it without cycles.
 */

export interface Rewards {
  gold?: number;
  gems?: number;
  candy?: number;
  shard?: number;
  stone?: number;
  xp?: number;
}

export const CURRENCY_REWARD_KEYS = ['gold', 'gems', 'candy', 'shard', 'stone'] as const;
export type RewardKey = keyof Rewards;

export function emptyRewards(): Rewards {
  return {};
}

/** Sum any number of bundles (missing keys are 0). */
export function addRewards(...bundles: Rewards[]): Rewards {
  const out: Rewards = {};
  const keys: RewardKey[] = ['gold', 'gems', 'candy', 'shard', 'stone', 'xp'];
  for (const key of keys) {
    const total = bundles.reduce((sum, b) => sum + (b[key] ?? 0), 0);
    if (total !== 0) out[key] = total;
  }
  return out;
}

export function scaleRewards(rewards: Rewards, factor: number): Rewards {
  const out: Rewards = {};
  const keys: RewardKey[] = ['gold', 'gems', 'candy', 'shard', 'stone', 'xp'];
  for (const key of keys) {
    const value = rewards[key];
    if (value !== undefined) out[key] = Math.floor(value * factor);
  }
  return out;
}

export function isZeroRewards(rewards: Rewards): boolean {
  const keys: RewardKey[] = ['gold', 'gems', 'candy', 'shard', 'stone', 'xp'];
  return keys.every((k) => (rewards[k] ?? 0) === 0);
}

/**
 * Apply a bundle to a currency record; floors at 0 and never touches `xp`
 * (the caller applies xp to the profile).
 */
export function applyRewards(currencies: Record<string, number>, rewards: Rewards): Record<string, number> {
  const out: Record<string, number> = { ...currencies };
  for (const key of CURRENCY_REWARD_KEYS) {
    const amount = rewards[key];
    if (amount === undefined) continue;
    out[key] = Math.max(0, Math.floor((out[key] ?? 0) + amount));
  }
  return out;
}
