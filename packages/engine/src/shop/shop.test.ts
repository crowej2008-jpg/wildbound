import { describe, expect, it } from 'vitest';
import {
  initialShopState,
  nextIntervalBoundary,
  nextRestockAt,
  restockDue,
  buyBlock,
  recordBuy,
  manualRefreshBlock,
  refreshesLeft,
  initialShopProgress,
  applyRestock,
} from './index';
import type { ShopDef } from './types';

const DAILY: ShopDef = {
  id: 'daily',
  name: 'Daily',
  currency: 'gems',
  restock: { type: 'daily', hoursUtc: [0, 12, 18] },
  items: [
    { id: 'daily.t1', name: 't1', price: 50, grants: { ticketCommon: 1 }, limit: 2 },
    { id: 'daily.one', name: 'o', price: 10, grants: {}, oneTime: true },
  ],
};

const GUILD: ShopDef = {
  id: 'guild',
  name: 'Guild',
  currency: 'guildCoin',
  restock: { type: 'interval', days: 7, hourUtc: 0 },
  items: [{ id: 'g1', name: 'g1', price: 100, grants: {} }],
};

const WILDS: ShopDef = {
  id: 'wilds',
  name: 'Wilds',
  currency: 'wildCoin',
  restock: { type: 'manual', refreshCost: { wildCoin: 3000 }, refreshDailyLimit: 3 },
  items: [{ id: 'w1', name: 'w1', price: 500, grants: {}, limit: 1 }],
};

describe('shop', () => {
  it('daily restock matches UTC schedule boundaries', () => {
    const d10 = new Date('2026-10-12T10:00:00Z').getTime();
    const n12 = nextRestockAt(DAILY.restock, d10);
    expect(n12).toBe(new Date('2026-10-12T12:00:00Z').getTime());

    const d1759 = new Date('2026-10-12T17:59:00Z').getTime();
    const n18 = nextRestockAt(DAILY.restock, d1759);
    expect(n18).toBe(new Date('2026-10-12T18:00:00Z').getTime());

    const d1859 = new Date('2026-10-12T18:59:00Z').getTime();
    const n00 = nextRestockAt(DAILY.restock, d1859);
    expect(n00).toBe(new Date('2026-10-13T00:00:00Z').getTime());
  });

  it('interval restock is every N days at hourUtc', () => {
    const base = new Date('2026-10-12T00:00:00Z').getTime();
    expect(nextIntervalBoundary(base, 7, 0)).toBe(new Date('2026-10-19T00:00:00Z').getTime());

    const d23 = new Date('2026-10-12T23:59:00Z').getTime();
    expect(nextIntervalBoundary(d23, 7, 0)).toBe(new Date('2026-10-19T00:00:00Z').getTime());

    const h12 = new Date('2026-10-12T12:00:00Z').getTime();
    expect(nextIntervalBoundary(h12, 7, 12)).toBe(new Date('2026-10-19T12:00:00Z').getTime());

    const early = new Date('2026-10-12T01:00:00Z').getTime();
    // If we are before the anchor time of the current cycle, next is today at hourUtc
    expect(nextIntervalBoundary(early, 7, 12)).toBe(new Date('2026-10-12T12:00:00Z').getTime());
  });

  it('restock resets per-window limits but not one-time lines', () => {
    const now = new Date('2026-10-12T10:00:00Z').getTime();
    const state = initialShopState([DAILY, GUILD, WILDS], now, '2026-10-12');
    const prog = state.daily;
    expect(prog).toBeDefined();
    expect(buyBlock(DAILY, DAILY.items[0]!, prog!, { gems: 100 })).toBe(null);

    const after1 = recordBuy(prog!, DAILY.items[0]!);
    expect(after1.bought['daily.t1']).toBe(1);

    const after2 = recordBuy(after1, DAILY.items[0]!);
    expect(after2.bought['daily.t1']).toBe(2);

    const blockedLimit = buyBlock(DAILY, DAILY.items[0]!, after2, { gems: 100 });
    expect(blockedLimit).toBe('limit');

    const restockAt = nextRestockAt(DAILY.restock, now);
    const progRestocked = applyRestock(after2, restockAt);
    expect(buyBlock(DAILY, DAILY.items[0]!, progRestocked, { gems: 100 })).toBe(null);

    const afterOne = recordBuy(prog!, DAILY.items[1]!);
    const r2 = applyRestock(afterOne, restockAt);
    expect(buyBlock(DAILY, DAILY.items[1]!, r2, { gems: 100 })).toBe('owned');
  });

  it('manual shop respects daily refresh limit and cost', () => {
    const now = new Date('2026-10-12T10:00:00Z').getTime();
    let prog = initialShopProgress(now, '2026-10-12');
    expect(refreshesLeft(WILDS.restock, prog, '2026-10-12')).toBe(3);

    expect(manualRefreshBlock(WILDS.restock, prog, { wildCoin: 3000 }, '2026-10-12')).toBe(null);
    prog = { ...prog, refreshes: 3, refreshDay: '2026-10-12' };
    expect(refreshesLeft(WILDS.restock, prog, '2026-10-12')).toBe(0);
    expect(manualRefreshBlock(WILDS.restock, prog, { wildCoin: 3000 }, '2026-10-12')).toBe('limit');

    expect(manualRefreshBlock(WILDS.restock, prog, { wildCoin: 100 }, '2026-10-13')).toBe('insufficient_items');
  });

  it('buyBlock returns owned/limit/insufficient', () => {
    const now = new Date('2026-10-12T10:00:00Z').getTime();
    const prog = initialShopProgress(now, '2026-10-12');
    const p2 = recordBuy(prog, DAILY.items[1]!);
    expect(buyBlock(DAILY, DAILY.items[1]!, p2, { gems: 100 })).toBe('owned');

    const pT = recordBuy(prog, DAILY.items[0]!);
    const pT2 = recordBuy(pT, DAILY.items[0]!);
    expect(buyBlock(DAILY, DAILY.items[0]!, pT2, { gems: 10 })).toBe('limit');
  });

  it('guild interval 7 days', () => {
    const t0 = new Date('2026-10-12T00:00:00Z').getTime();
    const t6 = new Date('2026-10-18T23:59:00Z').getTime();
    expect(restockDue(GUILD.restock, t0, t6)).toBe(false);
    const t7 = new Date('2026-10-19T00:00:00Z').getTime();
    expect(restockDue(GUILD.restock, t0, t7)).toBe(true);
  });

  it('daily at boundaries', () => {
    const d0 = new Date('2026-10-12T00:00:00Z').getTime();
    const d12 = new Date('2026-10-12T12:00:00Z').getTime();
    const d18 = new Date('2026-10-12T18:00:00Z').getTime();
    expect(restockDue(DAILY.restock, d0, d0 + 1)).toBe(false);
    expect(restockDue(DAILY.restock, d0, d12)).toBe(true);
    expect(restockDue(DAILY.restock, d12, d18)).toBe(true);
  });
});
