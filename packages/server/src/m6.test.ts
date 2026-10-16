import { describe, expect, it } from 'vitest';
import { isAtLeast, mulberry32, type AccountState } from '@wildbound/engine';
import { buildConfig, type GameConfig } from './config';
import { applySummon } from './gacha';
import { LocalServer } from './local-server';
import { createInitialState } from './save';
import { MemoryStore } from './storage';

const START = Date.parse('2026-01-01T00:00:00Z');

function make(): { srv: LocalServer; config: GameConfig; advance: (ms: number) => void } {
  const config = buildConfig();
  let clock = START;
  config.now = () => clock;
  return {
    srv: new LocalServer(new MemoryStore(), config),
    config,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

/** A fresh account with one machine's free draws and tickets zeroed, for pure checks. */
function bare(config: GameConfig, machine: 'common' | 'premium'): AccountState {
  const base = createInitialState(config);
  return {
    ...base,
    currencies: { ...base.currencies, ticketCommon: 0, ticketPremium: 0 },
    gacha: {
      ...base.gacha,
      machines: { ...base.gacha.machines, [machine]: { ...base.gacha.machines[machine], freeRemaining: 0 } },
    },
  };
}

describe('LocalServer M6 summoning', () => {
  it('seeds both machines and their daily free draws', async () => {
    const { srv } = make();
    const load = await srv.loadAccount();
    expect(load.ok).toBe(true);
    if (!load.ok) return;
    const gacha = load.value.state.gacha;
    expect(gacha.machines.common.freeRemaining).toBe(5);
    expect(gacha.machines.premium.freeRemaining).toBe(1);
    expect(gacha.wishedSpeciesId).toBeNull();
  });

  it('falls back free draw -> ticket -> gems (Premium)', async () => {
    const { srv } = make();

    const free = await srv.summon('premium', 1);
    expect(free.ok).toBe(true);
    if (!free.ok) return;
    expect(free.value.cost.free).toBe(1);

    // Free draw is on cooldown; two starting premium tickets cover the next two.
    const ticketOne = await srv.summon('premium', 1);
    const ticketTwo = await srv.summon('premium', 1);
    expect(ticketOne.ok && ticketTwo.ok).toBe(true);
    if (!ticketOne.ok || !ticketTwo.ok) return;
    expect(ticketOne.value.cost.tickets).toBe(1);
    expect(ticketTwo.value.cost.tickets).toBe(1);
    expect(ticketTwo.value.snapshot.state.currencies.ticketPremium).toBe(0);

    // Everything else spent: gems are the last resort (500 starting, 180 a draw).
    const gems = await srv.summon('premium', 1);
    expect(gems.ok).toBe(true);
    if (!gems.ok) return;
    expect(gems.value.cost.gems).toBe(180);
    expect(gems.value.snapshot.state.currencies.gems).toBe(320);
  });

  it('refuses a draw with no free draws, tickets or gem fallback', () => {
    const config = buildConfig();
    config.now = () => START;
    const out = applySummon(config, bare(config, 'common'), 'common', 1, START, mulberry32(1));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe('insufficient_items');
  });

  it('a ten-draw costs ten tickets and always yields a Rare-or-better', async () => {
    const { srv } = make();
    const ten = await srv.summon('common', 10, 4242);
    expect(ten.ok).toBe(true);
    if (!ten.ok) return;
    expect(ten.value.draws).toHaveLength(10);
    expect(ten.value.cost.tickets).toBe(10);
    expect(ten.value.draws.some((d) => isAtLeast(d.tier, 'rare'))).toBe(true);
    expect(ten.value.snapshot.state.currencies.ticketCommon).toBe(0);
  });

  it('grants a fresh instance per draw and records history', async () => {
    const { srv } = make();
    const before = await srv.loadAccount();
    if (!before.ok) return;
    const startCount = before.value.state.roster.length;

    const ten = await srv.summon('common', 10, 7);
    expect(ten.ok).toBe(true);
    if (!ten.ok) return;
    expect(ten.value.snapshot.state.roster).toHaveLength(startCount + 10);
    expect(ten.value.snapshot.state.nextInstanceSeq).toBe(startCount + 11);
    expect(ten.value.snapshot.state.gacha.history).toHaveLength(10);
  });

  it('is reproducible for a pinned seed', async () => {
    const a = make();
    const b = make();
    const first = await a.srv.summon('premium', 1, 999);
    const second = await b.srv.summon('premium', 1, 999);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.draws.map((d) => d.speciesId)).toEqual(second.value.draws.map((d) => d.speciesId));
  });

  it('pity forces a Legendary-or-better at the exact credit threshold', () => {
    const config = buildConfig();
    config.now = () => START;
    const seeded = createInitialState(config);
    const state: AccountState = {
      ...seeded,
      currencies: { ...seeded.currencies, ticketPremium: 1 },
      gacha: {
        ...seeded.gacha,
        machines: {
          ...seeded.gacha.machines,
          premium: { ...seeded.gacha.machines.premium, freeRemaining: 0, pityCredits: 980 },
        },
      },
    };
    const out = applySummon(config, state, 'premium', 1, START, mulberry32(7));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.cost.tickets).toBe(1);
    expect(out.value.draws[0]!.guaranteed).toBe(true);
    expect(isAtLeast(out.value.draws[0]!.tier, 'legendary')).toBe(true);
    expect(out.value.state.gacha.machines.premium.pityCredits).toBe(0);
  });

  it('fills a box, claims it, and resets its credits', async () => {
    const { srv } = make();
    await srv.grantCurrency('ticketCommon', 100);
    for (let i = 0; i < 10; i++) await srv.summon('common', 10, i);

    const ready = await srv.getGacha();
    expect(ready.ok).toBe(true);
    if (!ready.ok) return;
    const common = ready.value.machines.find((m) => m.id === 'common');
    expect(common?.boxReady).toBe(true);
    expect(common?.boxCredits).toBe(100);

    const claim = await srv.claimGachaBox('common');
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(claim.value.granted.shard).toBe(50);
    expect(claim.value.snapshot.state.gacha.machines.common.boxCredits).toBe(0);

    const again = await srv.claimGachaBox('common');
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toBe('not_ready');
  });

  it('sets and clears the Premium wish', async () => {
    const { srv, config } = make();
    const speciesId = [...config.species.keys()][0]!;
    const set = await srv.setWish(speciesId);
    expect(set.ok).toBe(true);
    if (!set.ok) return;
    expect(set.value.state.gacha.wishedSpeciesId).toBe(speciesId);

    const cleared = await srv.setWish(null);
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.value.state.gacha.wishedSpeciesId).toBeNull();

    const bad = await srv.setWish('nope');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBe('not_found');
  });
});

describe('LocalServer M6 shops', () => {
  it('deducts the exact price and grants the bundle', async () => {
    const { srv } = make();
    await srv.grantCurrency('gems', 1000);
    const buy = await srv.buyShopItem('daily', 'daily.shard');
    expect(buy.ok).toBe(true);
    if (!buy.ok) return;
    expect(buy.value.granted.shard).toBe(50);
    expect(buy.value.snapshot.state.currencies.shard).toBe(250);
    expect(buy.value.snapshot.state.currencies.gems).toBe(1350);
  });

  it('refuses a purchase when the window limit is reached, then restocks', async () => {
    const { srv, advance } = make();
    await srv.grantCurrency('gems', 5000);
    for (let i = 0; i < 3; i++) {
      expect((await srv.buyShopItem('daily', 'daily.shard')).ok).toBe(true);
    }
    const blocked = await srv.buyShopItem('daily', 'daily.shard');
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toBe('daily_limit');

    // The Daily shop restocks at 12:00 UTC; 12h later the limit resets.
    advance(12 * 60 * 60_000);
    expect((await srv.buyShopItem('daily', 'daily.shard')).ok).toBe(true);
  });

  it('keeps one-time lines bought across a refresh', async () => {
    const { srv } = make();
    await srv.grantCurrency('wildCoin', 20000);
    expect((await srv.buyShopItem('wilds', 'wilds.once')).ok).toBe(true);
    const again = await srv.buyShopItem('wilds', 'wilds.once');
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toBe('invalid_input');

    expect((await srv.refreshShop('wilds')).ok).toBe(true);
    expect((await srv.buyShopItem('wilds', 'wilds.once')).ok).toBe(false);
  });

  it('manual refresh costs currency, resets stock and enforces the daily limit', async () => {
    const { srv } = make();
    await srv.grantCurrency('wildCoin', 20000);
    for (let i = 0; i < 5; i++) {
      expect((await srv.buyShopItem('wilds', 'wilds.candy')).ok).toBe(true);
    }
    expect((await srv.buyShopItem('wilds', 'wilds.candy')).ok).toBe(false);

    const refresh = await srv.refreshShop('wilds');
    expect(refresh.ok).toBe(true);
    if (!refresh.ok) return;
    expect(refresh.value.snapshot.state.currencies.wildCoin).toBe(20000 - 5 * 400 - 3000);
    expect((await srv.buyShopItem('wilds', 'wilds.candy')).ok).toBe(true);

    // Two more refreshes are allowed today; the fourth is refused.
    expect((await srv.refreshShop('wilds')).ok).toBe(true);
    expect((await srv.refreshShop('wilds')).ok).toBe(true);
    const over = await srv.refreshShop('wilds');
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toBe('daily_limit');
  });

  it('refuses a manual refresh on a scheduled shop', async () => {
    const { srv } = make();
    const bad = await srv.refreshShop('daily');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBe('invalid_input');
  });

  it('reports every shop with stock and affordability for the UI', async () => {
    const { srv } = make();
    const view = await srv.getShops();
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    expect(view.value).toHaveLength(6);
    const daily = view.value.find((s) => s.id === 'daily');
    expect(daily?.items.find((i) => i.id === 'daily.shard')?.affordable).toBe(true);
    const wilds = view.value.find((s) => s.id === 'wilds');
    expect(wilds?.restockType).toBe('manual');
    expect(wilds?.nextRestockAt).toBe(Number.POSITIVE_INFINITY);
  });
});
