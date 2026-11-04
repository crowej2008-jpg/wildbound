import { describe, expect, it } from 'vitest';
import { mulberry32, type AccountState } from '@wildbound/engine';
import { buildConfig, type GameConfig } from './config';
import { applySummon } from './gacha';
import { LocalServer } from './local-server';
import { createInitialState, SAVE_VERSION } from './save';
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

describe('LocalServer summoning (R9: copied from the source)', () => {
  it('seeds both gachas, their daily free draws, no wish and no VIP credits', async () => {
    const { srv } = make();
    const load = await srv.loadAccount();
    expect(load.ok).toBe(true);
    if (!load.ok) return;
    const gacha = load.value.state.gacha;
    expect(gacha.machines.common.freeRemaining).toBe(5);
    expect(gacha.machines.premium.freeRemaining).toBe(1);
    expect(gacha.wishFaction).toBeNull();
    expect(gacha.vipCredits).toBe(0);
  });

  it('falls back free draw -> ticket -> gems (Premium)', async () => {
    const { srv } = make();
    const free = await srv.summon('premium', 1);
    expect(free.ok).toBe(true);
    if (!free.ok) return;
    expect(free.value.cost.free).toBe(1);

    const ticketOne = await srv.summon('premium', 1);
    const ticketTwo = await srv.summon('premium', 1);
    expect(ticketOne.ok && ticketTwo.ok).toBe(true);
    if (!ticketOne.ok || !ticketTwo.ok) return;
    expect(ticketOne.value.cost.tickets).toBe(1);
    expect(ticketTwo.value.snapshot.state.currencies.ticketPremium).toBe(0);

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

  it('draws Pokémon at their pool star, and the first sighting is new', async () => {
    const { srv, config } = make();
    const ten = await srv.summon('common', 10, 4242);
    expect(ten.ok).toBe(true);
    if (!ten.ok) return;
    expect(ten.value.cost.tickets).toBe(10);
    const pool = config.gacha.pools.common;
    for (const d of ten.value.draws) {
      expect(pool.some((r) => r.speciesId === d.speciesId && r.star === d.star)).toBe(true);
    }
    const roster = ten.value.snapshot.state.roster.slice(-10);
    expect(roster.map((w) => w.stars)).toEqual(ten.value.draws.map((d) => d.star));
    expect(ten.value.snapshot.state.gacha.history.map((h) => h.star)).toEqual(ten.value.draws.map((d) => d.star));
  });

  it('copies the source pools: 30 Common rows, 116 Premium rows, display weights', () => {
    const config = buildConfig();
    expect(config.gacha.pools.common).toHaveLength(30);
    expect(config.gacha.pools.premium).toHaveLength(116);
    const caterpie = config.gacha.pools.common.find((r) => r.speciesId === 'caterpie');
    expect(caterpie).toMatchObject({ star: 1, weight: 85502, group: 'other', tier: 'common' });
    const mythic = config.gacha.pools.premium.filter((r) => r.group === 'mythic');
    expect(mythic).toHaveLength(21);
    expect(mythic.every((r) => r.weight === 100 && r.star === 5)).toBe(true);
  });

  it('the Premium plus multi-draw takes tickets only, up to 50', async () => {
    const { srv } = make();
    await srv.grantCurrency('ticketPremium', 48);
    const fifty = await srv.summon('premium', 50, 3);
    expect(fifty.ok).toBe(true);
    if (!fifty.ok) return;
    expect(fifty.value.draws).toHaveLength(50);
    expect(fifty.value.cost).toEqual({ free: 0, tickets: 50, gems: 0 });
    const noTickets = await srv.summon('premium', 20);
    expect(noTickets.ok).toBe(false);
    expect((await srv.summon('common', 20)).ok).toBe(false);
  });

  it('is reproducible for a pinned seed', async () => {
    const a = make();
    const b = make();
    const first = await a.srv.summon('premium', 1, 999);
    const second = await b.srv.summon('premium', 1, 999);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.draws).toEqual(second.value.draws);
  });

  it('every draw adds 1 box credit; the Common box is 50 5-Star Pokémon Shards at 100', async () => {
    const { srv } = make();
    await srv.grantCurrency('ticketCommon', 100);
    for (let i = 0; i < 10; i++) await srv.summon('common', 10, i);
    const ready = await srv.getGacha();
    if (!ready.ok) return;
    const common = ready.value.machines.find((m) => m.id === 'common');
    expect(common?.boxReady).toBe(true);
    expect(common?.boxCredits).toBe(100);

    const claim = await srv.claimGachaBox('common');
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(claim.value.granted).toEqual({ pokemonShard5: 50 });
    expect(claim.value.snapshot.state.gacha.machines.common.boxCredits).toBe(0);
    const again = await srv.claimGachaBox('common');
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toBe('not_ready');
  });

  it('the Premium box pays 5 Selectable Precious Shards every 20 draws', async () => {
    const { srv } = make();
    await srv.grantCurrency('ticketPremium', 18);
    await srv.summon('premium', 20, 5);
    const claim = await srv.claimGachaBox('premium');
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(claim.value.granted).toEqual({ preciousShard: 5 });
  });

  it('VIP credits: +20 a Premium draw, +1 a Common draw', async () => {
    const { srv } = make();
    await srv.summon('premium', 1, 1);
    const out = await srv.summon('common', 10, 1);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.snapshot.state.gacha.vipCredits).toBe(30);
  });

  it('the daily reset refills free draws but keeps the running timer', async () => {
    const { srv, advance } = make();
    advance(20 * 60 * 60_000); // 20:00 UTC
    await srv.summon('premium', 1, 1);
    advance(6 * 60 * 60_000); // 02:00 the next day: refilled, still 18 h on the timer
    const view = await srv.getGacha();
    if (!view.ok) return;
    const premium = view.value.machines.find((m) => m.id === 'premium')!;
    expect(premium.freeRemaining).toBe(1);
    const paid = await srv.summon('premium', 1, 2);
    expect(paid.ok).toBe(true);
    if (paid.ok) expect(paid.value.cost.free).toBe(0);
  });

  it('the Wishing Well opens after 200 Premium draws and takes Water, Fire or Grass', async () => {
    const { srv } = make();
    const early = await srv.setWishFaction('fire');
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.error).toBe('resource_locked');

    await srv.grantCurrency('ticketPremium', 200);
    for (let i = 0; i < 4; i++) await srv.summon('premium', 50, i);
    expect((await srv.setWishFaction('light')).ok).toBe(false);
    const set = await srv.setWishFaction('fire');
    expect(set.ok).toBe(true);
    if (!set.ok) return;
    expect(set.value.state.gacha.wishFaction).toBe('fire');

    const view = await srv.getGacha();
    if (!view.ok) return;
    const premium = view.value.machines.find((m) => m.id === 'premium')!;
    const entei = premium.probabilities.find((r) => r.speciesId === 'entei')!;
    const suicune = premium.probabilities.find((r) => r.speciesId === 'suicune')!;
    expect(entei.probability / suicune.probability).toBeCloseTo(1.8, 5);

    const cleared = await srv.setWishFaction(null);
    expect(cleared.ok && cleared.value.state.gacha.wishFaction).toBe(null);
  });

  it('the Supreme Gift needs VIP 14 and 1,000 VIP credits, then gives a Legendary or Supreme', async () => {
    const { srv, config } = make();
    const seeded = await srv.loadAccount();
    if (!seeded.ok) return;
    const withCredits = { ...seeded.value.state, gacha: { ...seeded.value.state.gacha, vipCredits: 1000 } };
    await srv.importSave(JSON.stringify({ version: SAVE_VERSION, state: withCredits }));
    const locked = await srv.openSupremeGift(1);
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.error).toBe('resource_locked');

    const vip14 = config.vip.levels.find((l) => l.level === 14)!.xp;
    await srv.grantCurrency('privilegeXp', vip14);
    const open = await srv.openSupremeGift(1);
    expect(open.ok).toBe(true);
    if (!open.ok) return;
    expect(config.gacha.supremeGift.species).toContain(open.value.draw.speciesId);
    expect(['legendary', 'supreme']).toContain(open.value.draw.tier);
    expect(open.value.snapshot.state.gacha.vipCredits).toBe(0);
    expect((await srv.openSupremeGift(2)).ok).toBe(false);
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
    expect(view.value).toHaveLength(7);
    const daily = view.value.find((s) => s.id === 'daily');
    expect(daily?.items.find((i) => i.id === 'daily.shard')?.affordable).toBe(true);
    const wilds = view.value.find((s) => s.id === 'wilds');
    expect(wilds?.restockType).toBe('manual');
    expect(wilds?.nextRestockAt).toBe(Number.POSITIVE_INFINITY);
  });
});
