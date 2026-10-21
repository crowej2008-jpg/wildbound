import { describe, expect, it } from 'vitest';
import { dayKey } from '@wildbound/engine';
import { buildConfig } from './config';
import { createInitialState } from './save';
import { shopsView } from './shops';
import {
  buildVipView,
  claimVipDailyAction,
  vipIdleCapMinutes,
  vipPerks,
  vipShopPrice,
  vipTierFor,
} from './vip';

const NOW = Date.parse('2026-01-01T00:00:00Z');

function makeState() {
  const config = buildConfig();
  config.now = () => NOW;
  return { config, state: createInitialState(config) };
}

describe('M11.10 VIP', () => {
  it('derives the tier from lifetime XP and prices perks from data', () => {
    const { config, state } = makeState();
    const tiers = config.collection.vip.tiers;
    expect(vipTierFor(0, tiers).tier).toBe(0);
    expect(vipTierFor(999, tiers).tier).toBe(0);
    expect(vipTierFor(1_000, tiers).tier).toBe(1);
    expect(vipTierFor(5_000, tiers).tier).toBe(2);
    expect(vipTierFor(250_000, tiers).tier).toBe(6);

    state.profile.xp = 5_000;
    const view = buildVipView(config, state, NOW);
    expect(view.name).toBe('Silver');
    expect(view.next?.name).toBe('Gold');
    expect(view.next?.remaining).toBe(10_000);
    expect(view.idleCapBonusHours).toBe(2);
    expect(view.shopDiscount).toBeCloseTo(0.04);
    expect(vipShopPrice(config, state, 100)).toBe(96);
    expect(vipShopPrice(config, state, 25)).toBe(24);
    expect(vipPerks(config, state).dailyTickets).toBe(1);
    expect(vipIdleCapMinutes(config, state, 480)).toBe(600);

    const shop = shopsView(config, state, NOW)[0]!;
    const baseItem = config.shops[0]!.items[0]!;
    expect(shop.items[0]?.price).toBe(Math.max(1, Math.floor(baseItem.price * 0.96)));
  });

  it('claims one daily ticket supply per UTC day', () => {
    const { config, state } = makeState();
    state.profile.xp = 5_000;
    const before = state.currencies.ticketCommon;
    const claimed = claimVipDailyAction(config, state, NOW);
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.value.granted.ticketCommon).toBe(1);
    expect(claimed.value.state.currencies.ticketCommon).toBe(before + 1);
    expect(claimed.value.state.vip.lastClaimDay).toBe(dayKey(NOW));
    expect(buildVipView(config, claimed.value.state, NOW).claimedToday).toBe(true);

    const again = claimVipDailyAction(config, claimed.value.state, NOW);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toBe('daily_limit');

    const tomorrow = claimVipDailyAction(config, claimed.value.state, NOW + 86_400_000);
    expect(tomorrow.ok).toBe(true);
  });

  it('has no supply for a fresh account', () => {
    const { config, state } = makeState();
    const view = buildVipView(config, state, NOW);
    expect(view.tier).toBe(0);
    expect(view.canClaim).toBe(false);
    const result = claimVipDailyAction(config, state, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not_ready');
  });
});
