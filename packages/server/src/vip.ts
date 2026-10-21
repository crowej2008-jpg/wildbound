import { dayKey, type AccountState, type Rewards } from '@wildbound/engine';
import type { GameConfig } from './config';
import { applyGrant } from './economy';
import { fail, ok, type Result } from './index';

/**
 * M11.10 VIP. The tier is derived from lifetime trainer XP, never bought.
 * Perks are data in collection.json: idle-cap hours, a shop discount and a
 * daily Common Ticket supply. See docs/design/collection.md.
 */

export type VipTier = GameConfig['collection']['vip']['tiers'][number];

export interface VipNextView {
  tier: number;
  name: string;
  xp: number;
  remaining: number;
  /** 0–1 progress between the current and next tier. */
  progress: number;
}

export interface VipView {
  tier: number;
  name: string;
  xp: number;
  next: VipNextView | null;
  idleCapBonusHours: number;
  shopDiscount: number;
  dailyTickets: number;
  canClaim: boolean;
  claimedToday: boolean;
}

export function vipTierFor(xp: number, tiers: readonly VipTier[]): VipTier {
  let found = tiers[0]!;
  for (const tier of tiers) {
    if (xp >= tier.xp) found = tier;
  }
  return found;
}

export function vipPerks(config: GameConfig, state: AccountState): VipTier {
  return vipTierFor(state.profile.xp, config.collection.vip.tiers);
}

/** The base idle cap plus the tier's extra hours. */
export function vipIdleCapMinutes(
  config: GameConfig,
  state: AccountState,
  baseMinutes: number,
): number {
  return baseMinutes + vipPerks(config, state).idleCapBonusHours * 60;
}

/** Discounted shop price; rounded down but never below one unit. */
export function vipShopPrice(config: GameConfig, state: AccountState, price: number): number {
  const discount = vipPerks(config, state).shopDiscount;
  return Math.max(1, Math.floor(price * (1 - discount)));
}

export function buildVipView(config: GameConfig, state: AccountState, now: number): VipView {
  const tiers = config.collection.vip.tiers;
  const current = vipTierFor(state.profile.xp, tiers);
  const index = tiers.findIndex((tier) => tier.tier === current.tier);
  const following = index >= 0 ? tiers[index + 1] : undefined;
  const span = following ? following.xp - current.xp : 0;
  const day = dayKey(now);
  return {
    tier: current.tier,
    name: current.name,
    xp: state.profile.xp,
    next: following
      ? {
          tier: following.tier,
          name: following.name,
          xp: following.xp,
          remaining: Math.max(0, following.xp - state.profile.xp),
          progress:
            span > 0 ? Math.min(1, Math.max(0, (state.profile.xp - current.xp) / span)) : 0,
        }
      : null,
    idleCapBonusHours: current.idleCapBonusHours,
    shopDiscount: current.shopDiscount,
    dailyTickets: current.dailyTickets,
    canClaim: current.dailyTickets > 0 && state.vip.lastClaimDay !== day,
    claimedToday: current.dailyTickets > 0 && state.vip.lastClaimDay === day,
  };
}

/** Claim today's Common Tickets. One claim per UTC day, tier-gated. */
export function claimVipDailyAction(
  config: GameConfig,
  state: AccountState,
  now: number,
): Result<{ state: AccountState; granted: Rewards }> {
  const view = buildVipView(config, state, now);
  if (view.dailyTickets <= 0) return fail('not_ready', 'your VIP tier has no daily supply yet');
  if (view.claimedToday) return fail('daily_limit', 'VIP supply already claimed today');
  const granted: Rewards = { ticketCommon: view.dailyTickets };
  const next = applyGrant(
    config,
    { ...state, vip: { lastClaimDay: dayKey(now) } },
    granted,
  );
  return ok({ state: next, granted });
}
