import { mulberry32 } from '../rng';
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

/**
 * R9: the rows a restock shows — the `fixed` rows plus a uniform draw from the others to fill `slots` (the source's
 * draw weights are not in the dumps), seeded by the shop and the restock time so a window is stable.
 */
export function drawOffered(shop: ShopDef, now: number): string[] | undefined {
  if (!shop.slots || shop.slots >= shop.items.length) return undefined;
  const fixed = shop.fixed ?? [];
  const pool = shop.items.map((i) => i.id).filter((id) => !fixed.includes(id));
  let seed = Math.floor(now / 1000);
  for (const ch of shop.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rng = mulberry32(seed);
  const picked: string[] = [];
  while (picked.length < shop.slots - fixed.length && pool.length > 0) {
    picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
  }
  const order = new Map(shop.items.map((i, n) => [i.id, n]));
  return [...fixed, ...picked].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

/** Reset the per-window purchase counts (and draw the shown rows); one-time buys are permanent. */
export function applyRestock(progress: ShopProgress, now: number, shop?: ShopDef): ShopProgress {
  const offered = shop ? drawOffered(shop, now) : undefined;
  const next: ShopProgress = { ...progress, lastRestockAt: now, bought: {} };
  if (offered) next.offered = offered;
  else delete next.offered;
  return next;
}

/** Whether a row shows this restock. */
export function isOffered(shop: ShopDef, progress: ShopProgress, itemId: string): boolean {
  if (!shop.slots || shop.slots >= shop.items.length) return true;
  return (progress.offered ?? drawOffered(shop, progress.lastRestockAt) ?? []).includes(itemId);
}

/** The currency a row is paid in. */
export function itemCurrency(shop: ShopDef, item: ShopItemDef): string {
  return item.currency ?? shop.currency;
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
  if (!isOffered(shop, progress, item.id)) return 'not_offered';
  if (item.badge !== undefined) return 'locked';
  if (item.oneTime && isOneTimeBought(progress, item.id)) return 'owned';
  if (boughtCount(progress, item.id) >= buyLimit(item)) return 'limit';
  if ((currencies[itemCurrency(shop, item)] ?? 0) < item.price) return 'insufficient_items';
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
