import type { Rewards } from '../economy/rewards';

/**
 * Shop vocabulary (M6, PROMPT §7.9). Pure types + helpers; the restock rules live
 * in `shop.ts`, the data lives in `content/shops/*.json`. See docs/design/shops.md.
 */

/** How a shop refills its stock. */
export type RestockSchedule =
  | { type: 'daily'; hoursUtc: number[] }
  | { type: 'interval'; days: number; hourUtc: number }
  | { type: 'manual'; refreshCost: Rewards; refreshDailyLimit: number };

export interface ShopItemDef {
  id: string;
  name: string;
  /** Price in the shop's currency. */
  price: number;
  grants: Rewards;
  /** Max buys per restock window (absent = unlimited). */
  limit?: number;
  /** Bought once, forever; never restocks. */
  oneTime?: boolean;
  /** R9: a species' own shards. */
  speciesShards?: Record<string, number>;
  /** R9: the row's cost currency when it differs from the shop's. */
  currency?: string;
  /** R9: the source's shown discount (display only). */
  discount?: number;
  /** R9: the Champion Road badge the row needs. */
  badge?: number;
}

export interface ShopDef {
  id: string;
  name: string;
  /** Currency id the shop charges in. */
  currency: string;
  restock: RestockSchedule;
  /** R9: manual refreshes on top of the schedule: each one's price, the day's limit (`vip` = by VIP level). */
  refresh?: { costs: Rewards[]; limit: 'vip' | number };
  /** R9: rows shown per restock: the `fixed` ones plus the rest drawn from the other rows. */
  slots?: number;
  fixed?: string[];
  items: ShopItemDef[];
}

/** Per-shop bookkeeping stored in the save. */
export interface ShopProgress {
  lastRestockAt: number;
  bought: Record<string, number>;
  oneTimeBought: string[];
  /** UTC day of the last manual refresh (for its daily limit). */
  refreshDay: string;
  refreshes: number;
  /** R9: the rows shown this restock (absent = all rows). */
  offered?: string[];
}

export type ShopState = Record<string, ShopProgress>;

export type ShopBuyBlock = 'owned' | 'limit' | 'insufficient_items' | 'not_offered' | 'locked';

export function initialShopProgress(now: number, day: string): ShopProgress {
  return { lastRestockAt: now, bought: {}, oneTimeBought: [], refreshDay: day, refreshes: 0 };
}

export function initialShopState(shops: readonly ShopDef[], now: number, day: string): ShopState {
  const state: ShopState = {};
  for (const shop of shops) state[shop.id] = initialShopProgress(now, day);
  return state;
}
