import { nextRestock, UTC_DAY_MS } from '../time';
import type { ShopBuyBlock, ShopDef, ShopItemDef, ShopProgress, RestockSchedule } from './types';

/**
 * Shop rules (M6, PROMPT §7.9). Pure and content-free: every function takes a
 * shop definition, its progress slice and the current epoch. See docs/design/shops.md.
 */

// const HOUR_MS = 3_600_000;

/** The next interval boundary (every `days` at `hourUtc`) strictly after `now`. */
export function nextIntervalBoundary(now: number, days: number, hourUtc: number): number {
  const period = Math.max(1, Math.floor(days)) * UTC_DAY_MS;
  const hourMs = 3_600_000;
  const anchorDay = new Date(Date.UTC(2026, 9, 12)).getTime(); // 2026-10-12 00:00:00Z
  const offset = hourUtc * hourMs;
  let boundary = anchorDay + offset;
  while (boundary <= now) {
    boundary += period;
  }
  return boundary;
}

/** The next restock epoch for a schedule (Infinity for a manual shop). */
export function nextRestockAt(restock: RestockSchedule, from: number): number {
  switch (restock.type) {
    case 'daily':
      return nextRestock(from, restock.hoursUtc);
    case 'interval':
      return nextIntervalBoundary(from, restock.days, restock.hourUtc);
    case 'manual':
      return Number.POSITIVE_INFINITY;
  }
}

/** Whether a shop is due for a restock given when it last restocked. */
export function restockDue(restock: RestockSchedule, lastRestockAt: number, now: number): boolean {
  if (restock.type === 'manual') return false;
  return now >= nextRestockAt(restock, lastRestockAt);
}

/** Reset the per-window purchase counts; one-time buys are permanent. */
export function applyRestock(progress: ShopProgress, now: number): ShopProgress {
  return { ...progress, lastRestockAt: now, bought: {} };
}

export function boughtCount(progress: ShopProgress, itemId: string): number {
  return progress.bought[itemId] ?? 0;
}

export function isOneTimeBought(progress: ShopProgress, itemId: string): boolean {
  return progress.oneTimeBought.includes(itemId);
}

/** How many of an item may be bought per restock window. */
export function buyLimit(item: ShopItemDef): number {
  if (item.oneTime) return 1;
  return item.limit ?? Number.POSITIVE_INFINITY;
}

/** Why a purchase is blocked, or null when it is allowed. */
export function buyBlock(
  shop: ShopDef,
  item: ShopItemDef,
  progress: ShopProgress,
  currencies: Record<string, number>,
): ShopBuyBlock | null {
  if (item.oneTime && isOneTimeBought(progress, item.id)) return 'owned';
  if (boughtCount(progress, item.id) >= buyLimit(item)) return 'limit';
  if ((currencies[shop.currency] ?? 0) < item.price) return 'insufficient_items';
  return null;
}

/** Record a purchase's effect on the per-window and one-time counters. */
export function recordBuy(progress: ShopProgress, item: ShopItemDef): ShopProgress {
  const bought = { ...progress.bought, [item.id]: boughtCount(progress, item.id) + 1 };
  const oneTimeBought =
    item.oneTime && !progress.oneTimeBought.includes(item.id)
      ? [...progress.oneTimeBought, item.id]
      : progress.oneTimeBought;
  return { ...progress, bought, oneTimeBought };
}

/** How many manual refreshes remain today (only meaningful for a manual shop). */
export function refreshesLeft(restock: RestockSchedule, progress: ShopProgress, day: string): number {
  if (restock.type !== 'manual') return 0;
  const used = progress.refreshDay === day ? progress.refreshes : 0;
  return Math.max(0, restock.refreshDailyLimit - used);
}

/** Whether a manual refresh is allowed (manual shops only) and its cost is affordable. */
export function manualRefreshBlock(
  restock: RestockSchedule,
  progress: ShopProgress,
  currencies: Record<string, number>,
  day: string,
): ShopBuyBlock | null {
  if (restock.type !== 'manual') return 'limit';
  if (refreshesLeft(restock, progress, day) <= 0) return 'limit';
  const cost = restock.refreshCost;
  for (const [key, amount] of Object.entries(cost)) {
    if ((currencies[key] ?? 0) < (amount ?? 0)) return 'insufficient_items';
  }
  return null;
}
