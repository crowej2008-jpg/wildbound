import {
  applyRestock,
  boughtCount,
  buyBlock,
  dayKey,
  initialShopProgress,
  isOffered,
  isOneTimeBought,
  itemCurrency,
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
  type ShopDef,
  type ShopProgress,
} from '@wildbound/engine';
import { applyGrant } from './economy';
import type { GameConfig } from './config';
import type { Outcome } from './outcome';
import { vipPerks } from './vip';

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
  return restockDue(shop.restock, current.lastRestockAt, now) ? applyRestock(current, now, shop) : current;
}

function blockError(block: ShopBuyBlock): 'insufficient_items' | 'invalid_input' | 'daily_limit' | 'resource_locked' {
  if (block === 'insufficient_items') return 'insufficient_items';
  if (block === 'owned' || block === 'not_offered') return 'invalid_input';
  if (block === 'locked') return 'resource_locked';
  return 'daily_limit';
}

const BLOCK_TEXT: Record<ShopBuyBlock, string> = {
  owned: 'already bought',
  limit: 'restock limit reached',
  insufficient_items: 'not enough currency',
  not_offered: 'not on sale this restock',
  locked: 'needs a Champion Road badge (Champion Road arrives in M14)',
};

/** R9: the manual refreshes a shop allows today, and what the next one costs. */
function refreshTerms(config: GameConfig, state: AccountState, shop: ShopDef, progress: ShopProgress, day: string) {
  const used = progress.refreshDay === day ? progress.refreshes : 0;
  if (shop.refresh) {
    const limit = shop.refresh.limit === 'vip' ? vipPerks(config, state).dailyShopRefreshes : shop.refresh.limit;
    const cost = shop.refresh.costs[Math.min(used, shop.refresh.costs.length - 1)] ?? {};
    return { left: Math.max(0, limit - used), cost, used };
  }
  if (shop.restock.type === 'manual') {
    return { left: refreshesLeft(shop.restock, progress, day), cost: shop.restock.refreshCost, used };
  }
  return null;
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
  if (block) return { ok: false, error: blockError(block), message: BLOCK_TEXT[block] };

  const currency = itemCurrency(shop, item) as CurrencyId;
  let paid: AccountState = {
    ...state,
    currencies: { ...state.currencies, [currency]: Math.max(0, (state.currencies[currency] ?? 0) - price) },
    shops: { ...state.shops, [shopId]: recordBuy(progress, item) },
  };
  // R9: species shards go to that species' own shard count.
  if (item.speciesShards) {
    const shards = { ...paid.speciesShards };
    for (const [id, n] of Object.entries(item.speciesShards)) shards[id] = (shards[id] ?? 0) + n;
    paid = { ...paid, speciesShards: shards };
  }
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
  const day = dayKey(now);
  const progress = shopProgress(config, state, shopId, now) ?? initialShopProgress(now, day);
  const terms = refreshTerms(config, state, shop, progress, day);
  if (!terms) return { ok: false, error: 'invalid_input', message: 'this shop has no manual refresh' };
  if (shop.restock.type === 'manual' && !shop.refresh) {
    const block = manualRefreshBlock(shop.restock, progress, state.currencies, day);
    if (block) {
      return { ok: false, error: blockError(block), message: block === 'limit' ? 'no refreshes left today' : 'not enough currency to refresh' };
    }
  }
  if (terms.left <= 0) return { ok: false, error: 'daily_limit', message: 'no refreshes left today' };
  for (const [key, amount] of Object.entries(terms.cost)) {
    if ((state.currencies[key as CurrencyId] ?? 0) < (amount ?? 0)) {
      return { ok: false, error: 'insufficient_items', message: 'not enough currency to refresh' };
    }
  }

  const currencies = { ...state.currencies };
  for (const [key, amount] of Object.entries(terms.cost)) {
    const id = key as CurrencyId;
    currencies[id] = Math.max(0, (currencies[id] ?? 0) - (amount ?? 0));
  }
  // A manual refresh redraws the shown rows and resets the buys; the schedule keeps its own boundaries.
  const redrawn = applyRestock(progress, now, shop);
  const refreshed: ShopProgress = {
    ...redrawn,
    lastRestockAt: shop.restock.type === 'manual' ? now : progress.lastRestockAt,
    refreshDay: day,
    refreshes: terms.used + 1,
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
  /** R9: the row's currency (may differ from the shop's). */
  currency: string;
  grants: Rewards;
  speciesShards: Record<string, number> | null;
  discount: number | null;
  badge: number | null;
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
  /** The next manual refresh's price (null = no manual refresh). */
  refreshCost: Rewards | null;
  items: ShopItemView[];
}

/** Display-ready shop state: stock left, affordability and the next restock. */
export function shopsView(config: GameConfig, state: AccountState, now: number): ShopView[] {
  const day = dayKey(now);
  return config.shops.map((shop): ShopView => {
    const progress = shopProgress(config, state, shop.id, now) ?? initialShopProgress(now, day);
    const terms = refreshTerms(config, state, shop, progress, day);
    const items = shop.items.filter((item) => isOffered(shop, progress, item.id)).map((item): ShopItemView => {
      const bought = boughtCount(progress, item.id);
      const cap = item.oneTime ? 1 : (item.limit ?? Number.POSITIVE_INFINITY);
      const priced = item;
      const price = item.price;
      return {
        id: item.id,
        name: item.name,
        price,
        currency: itemCurrency(shop, item),
        grants: item.grants,
        speciesShards: item.speciesShards ?? null,
        discount: item.discount ?? null,
        badge: item.badge ?? null,
        limit: Number.isFinite(cap) ? cap : null,
        oneTime: Boolean(item.oneTime),
        bought,
        remaining: Number.isFinite(cap) ? Math.max(0, cap - bought) : null,
        owned: item.oneTime ? isOneTimeBought(progress, item.id) : false,
        affordable: (state.currencies[itemCurrency(shop, item) as CurrencyId] ?? 0) >= price,
        blocked: buyBlock(shop, priced, progress, state.currencies),
      };
    });
    return {
      id: shop.id,
      name: shop.name,
      currency: shop.currency,
      restockType: shop.restock.type,
      nextRestockAt: nextRestockAt(shop.restock, now),
      refreshesLeft: terms?.left ?? 0,
      refreshCost: terms ? terms.cost : null,
      items,
    };
  });
}
