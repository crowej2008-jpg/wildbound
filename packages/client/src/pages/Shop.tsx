import { useCallback, useEffect, useState } from 'react';
import type { ShopItemView, ShopView } from '@wildbound/server';
import RewardLine from '../components/RewardLine';
import { currencyLabel, t, type CurrencyKey } from '../i18n';
import { useServer } from '../server/ServerProvider';

/** `1D 02:23:40` (or `02:23:40`) until an epoch, for the restock countdown. */
function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d > 0 ? `${d}D ` : ''}${pad(h)}:${pad(m)}:${pad(s)}`;
}

function buyLabel(item: ShopItemView): string {
  if (item.owned) return t('shop.owned');
  if (item.remaining === 0) return t('shop.limitReached');
  if (!item.affordable) return t('shop.noCurrency');
  return t('shop.buy');
}

function ShopCard({
  shop,
  now,
  busy,
  onBuy,
  onRefresh,
}: {
  shop: ShopView;
  now: number;
  busy: boolean;
  onBuy: (itemId: string) => void;
  onRefresh: () => void;
}) {
  const currency = shop.currency as CurrencyKey;
  return (
    <section className="card shop-card" data-shop={shop.id}>
      <div className="shop-head">
        <h2 className="section-title">{shop.name}</h2>
        <span className="chip">{currencyLabel[currency] ?? currency}</span>
      </div>

      {shop.restockType === 'manual' ? (
        <div className="shop-refresh">
          <span className="muted">
            {t('shop.manual')} · {t('shop.refreshesLeft')}: <strong>{shop.refreshesLeft}</strong>
          </span>
          {shop.refreshCost && (
            <span className="shop-refresh-cost">
              {t('shop.refreshCost')}: <RewardLine rewards={shop.refreshCost} />
            </span>
          )}
          <button type="button" className="btn" disabled={busy || shop.refreshesLeft <= 0} onClick={onRefresh}>
            {t('shop.refresh')}
          </button>
        </div>
      ) : (
        <p className="muted">
          {t('shop.nextRestock')}: <strong>{formatCountdown(shop.nextRestockAt - now)}</strong>
        </p>
      )}

      <ul className="shop-list">
        {shop.items.map((item) => (
          <li key={item.id} className="shop-item">
            <div className="shop-item-info">
              <span className="shop-item-name">{item.name}</span>
              <RewardLine rewards={item.grants} />
              <span className="muted">
                {item.price.toLocaleString()} {currencyLabel[currency] ?? currency}
                {' · '}
                {item.owned
                  ? t('shop.owned')
                  : item.remaining === null
                    ? t('shop.unlimited')
                    : `${t('shop.limit')}: ${item.remaining}`}
                {item.oneTime && ` · ${t('shop.oneTime')}`}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || item.blocked !== null}
              onClick={() => onBuy(item.id)}
            >
              {buyLabel(item)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Shop screen: scheduled and manual shops with restock timers (M6, PROMPT §7.9/§8). */
export default function Shop() {
  const { busy, claim, getShops } = useServer();
  const [shops, setShops] = useState<ShopView[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    const result = await getShops();
    if (result.ok) setShops(result.value);
  }, [getShops]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const doBuy = async (shopId: string, itemId: string) => {
    const result = await claim((s) => s.buyShopItem(shopId, itemId));
    if (result.ok) await refresh();
  };

  const doRefresh = async (shopId: string) => {
    const result = await claim((s) => s.refreshShop(shopId));
    if (result.ok) await refresh();
  };

  return (
    <main className="main">
      <h1 className="page-title">{t('shop.title')}</h1>
      <p className="muted">{t('shop.subtitle')}</p>
      {shops.map((shop) => (
        <ShopCard
          key={shop.id}
          shop={shop}
          now={now}
          busy={busy}
          onBuy={(itemId) => void doBuy(shop.id, itemId)}
          onRefresh={() => void doRefresh(shop.id)}
        />
      ))}
    </main>
  );
}
