import {
  applyRestock,
  boughtCount,
  buyBlock,
  dayKey,
  initialShopProgress,
  isOneTimeBought,
  manualRefreshBlock,
  nextRestockAt,
  recordBuy,
  refreshesLeft,
  restockDue,
  type AccountState,
  type CurrencyId,
  type RestockSchedule,
  type Rewards,
  type ShopBuyBlock,
  type ShopProgress,
} from '@wildbound/engine';
import { applyGrant } from './economy';
import type { GameConfig } from './config';
import type { Outcome } from './outcome';

/**
 * Server-side shop glue (M6, PROMPT §7.9). The engine owns the restock/buy rules;
 * these helpers read the injected config's shops so the LocalServer methods stay
 * thin. Pure: they take state and an epoch and return new state.
 */

function shopById(config: GameConfig, shopId: string) {
  return config.shops.find((s) => s.id === shopId);
}

/** A shop's progress restocked to `now` when its window has rolled over. */
export function shopProgress(config: GameConfig, state: AccountState, shopId: string, now: number): ShopProgress | null {
  const shop = shopById(config, shopId);
  if (!shop) return null;
  const current = state.shops[shopId] ?? initialShopProgress(now, dayKey(now));
  return restockDue(shop.restock, current.lastRestockAt, now) ? applyRestock(current, now) : current;
}

function blockError(block: ShopBuyBlock): 'insufficient_items' | 'invalid_input' | 'daily_limit' {
  if (block === 'insufficient_items') return 'insufficient_items';
  if (block === 'owned') return 'invalid_input';
  return 'daily_limit';
}

/** Restock if due, validate the price/limit, deduct, grant, record the buy. */
export function applyBuy(
  config: GameConfig,
  state: AccountState,
  shopId: string,
  itemId: string,
  now: number,
): Outcome<{ state: AccountState; granted: Rewards }> {
  const shop = shopById(config, shopId);
  if (!shop) return { ok: false, error: 'not_found', message: `unknown shop "${shopId}"` };
  const item = shop.items.find((i) => i.id === itemId);
  if (!item) return { ok: false, error: 'not_found', message: `unknown shop item "${itemId}"` };

  const progress = shopProgress(config, state, shopId, now) ?? initialShopProgress(now, dayKey(now));
  const priced = item;
  const price = item.price;
  const block = buyBlock(shop, priced, progress, state.currencies);
  if (block) {
    const message =
      block === 'owned' ? 'already bought' : block === 'limit' ? 'restock limit reached' : 'not enough currency';
    return { ok: false, error: blockError(block), message };
  }

  const currency = shop.currency as CurrencyId;
  const paid: AccountState = {
    ...state,
    currencies: { ...state.currencies, [currency]: Math.max(0, (state.currencies[currency] ?? 0) - price) },
    shops: { ...state.shops, [shopId]: recordBuy(progress, item) },
  };
  return { ok: true, value: { state: applyGrant(config, paid, item.grants), granted: item.grants } };
}

/** Pay a manual shop's refresh cost, reset its bought counts and bump the daily counter. */
export function applyRefresh(
  config: GameConfig,
  state: AccountState,
  shopId: string,
  now: number,
): Outcome<{ state: AccountState; granted: Rewards }> {
  const shop = shopById(config, shopId);
  if (!shop) return { ok: false, error: 'not_found', message: `unknown shop "${shopId}"` };
  if (shop.restock.type !== 'manual') {
    return { ok: false, error: 'invalid_input', message: 'this shop restocks on a schedule' };
  }
  const day = dayKey(now);
  const progress = state.shops[shopId] ?? initialShopProgress(now, day);
  const block = manualRefreshBlock(shop.restock, progress, state.currencies, day);
  if (block) {
    return {
      ok: false,
      error: blockError(block),
      message: block === 'limit' ? 'no refreshes left today' : 'not enough currency to refresh',
    };
  }

  const currencies = { ...state.currencies };
  for (const [key, amount] of Object.entries(shop.restock.refreshCost)) {
    const id = key as CurrencyId;
    currencies[id] = Math.max(0, (currencies[id] ?? 0) - (amount ?? 0));
  }
  const refreshed: ShopProgress = {
    ...applyRestock(progress, now),
    refreshDay: day,
    refreshes: (progress.refreshDay === day ? progress.refreshes : 0) + 1,
  };
  return {
    ok: true,
    value: { state: { ...state, currencies, shops: { ...state.shops, [shopId]: refreshed } }, granted: {} },
  };
}

export interface ShopItemView {
  id: string;
  name: string;
  price: number;
  grants: Rewards;
  /** Per-window cap; null = unlimited. */
  limit: number | null;
  oneTime: boolean;
  bought: number;
  /** Purchases left this window; null = unlimited. */
  remaining: number | null;
  owned: boolean;
  affordable: boolean;
  blocked: ShopBuyBlock | null;
}

export interface ShopView {
  id: string;
  name: string;
  currency: string;
  restockType: RestockSchedule['type'];
  /** Next restock epoch; `Infinity` for a manual shop. */
  nextRestockAt: number;
  refreshesLeft: number;
  /** Manual shops only: the refresh price. */
  refreshCost: Rewards | null;
  items: ShopItemView[];
}

/** Display-ready shop state: stock left, affordability and the next restock. */
export function shopsView(config: GameConfig, state: AccountState, now: number): ShopView[] {
  const day = dayKey(now);
  return config.shops.map((shop): ShopView => {
    const progress = state.shops[shop.id] ?? initialShopProgress(now, day);
    const items = shop.items.map((item): ShopItemView => {
      const bought = boughtCount(progress, item.id);
      const cap = item.oneTime ? 1 : (item.limit ?? Number.POSITIVE_INFINITY);
      const priced = item;
      const price = item.price;
      return {
        id: item.id,
        name: item.name,
        price,
        grants: item.grants,
        limit: Number.isFinite(cap) ? cap : null,
        oneTime: Boolean(item.oneTime),
        bought,
        remaining: Number.isFinite(cap) ? Math.max(0, cap - bought) : null,
        owned: item.oneTime ? isOneTimeBought(progress, item.id) : false,
        affordable: (state.currencies[shop.currency as CurrencyId] ?? 0) >= price,
        blocked: buyBlock(shop, priced, progress, state.currencies),
      };
    });
    return {
      id: shop.id,
      name: shop.name,
      currency: shop.currency,
      restockType: shop.restock.type,
      nextRestockAt: nextRestockAt(shop.restock, now),
      refreshesLeft: refreshesLeft(shop.restock, progress, day),
      refreshCost: shop.restock.type === 'manual' ? shop.restock.refreshCost : null,
      items,
    };
  });
}
