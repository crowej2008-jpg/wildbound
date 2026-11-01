import { describe, expect, it } from 'vitest';
import { buildConfig } from './config';
import { bestIdleRate } from './economy';
import { buyArenaAttempts } from './pvp/arena';
import { createInitialState } from './save';
import { buildVipView, vipIdleCapMinutes, vipLevelFor } from './vip';

const NOW = Date.parse('2026-01-01T00:00:00Z');

describe('R8 VIP (source vip_priv)', () => {
  it('reads the level from Privilege XP: 60 lands on VIP 12, 300 on 14, 3,000,000 on 40', () => {
    const levels = buildConfig().vip.levels;
    expect(vipLevelFor(0, levels).level).toBe(0);
    expect(vipLevelFor(60, levels).level).toBe(12);
    expect(vipLevelFor(300, levels).level).toBe(14);
    expect(vipLevelFor(3_000_000, levels).level).toBe(40);
  });

  it('sets the idle cap and bonus, and shows the next level', () => {
    const config = buildConfig();
    const state = createInitialState(config);
    expect(vipIdleCapMinutes(config, state)).toBe(8 * 60);
    state.currencies.privilegeXp = 300;
    expect(vipIdleCapMinutes(config, state)).toBe(9 * 60);
    const view = buildVipView(config, state);
    expect(view.level).toBe(14);
    expect(view.next).toMatchObject({ level: 15, remaining: 680 });
    expect(view.browseTo).toBe(18);

    state.campaign = { ...state.campaign, stars: { [config.stages[0]!.id]: 3 } };
    const plain = bestIdleRate(config, { ...state, currencies: { ...state.currencies, privilegeXp: 0 } });
    const boosted = bestIdleRate(config, state);
    if (plain.gold) expect(boosted.gold).toBeCloseTo(plain.gold * 1.05);
  });

  it('caps Arena attempt buys at the VIP level (3 at VIP 0)', () => {
    const config = buildConfig();
    const state = createInitialState(config);
    state.currencies.gems = 100_000;
    expect(buyArenaAttempts(config, state, NOW, 3).ok).toBe(true);
    const over = buyArenaAttempts(config, state, NOW, 4);
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toBe('daily_limit');
  });
});
