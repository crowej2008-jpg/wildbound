import { describe, expect, it } from 'vitest';
import { mulberry32, type AccountState } from '@wildbound/engine';
import { applyChooseBox, applyCompose, applyOpenBox, bagView } from './bag';
import { buildConfig } from './config';
import { LocalServer } from './local-server';
import { createInitialState } from './save';
import { MemoryStore } from './storage';

/** R9: the Bag's generic shards and Pokémon boxes, copied from the source (docs/design/bag.md). */

const NOW = Date.parse('2026-01-01T00:00:00Z');
const config = buildConfig();

function withCurrencies(extra: Record<string, number>): AccountState {
  const base = createInitialState(config);
  return { ...base, currencies: { ...base.currencies, ...extra } };
}

describe('Bag tables (source)', () => {
  it('copies the four compose recipes', () => {
    expect(config.bag.recipes).toEqual([
      { from: 'pokemonShard3', count: 40, box: 'box3Star' },
      { from: 'pokemonShard5', count: 50, box: 'box5Star' },
      { from: 'pokemonShard4', count: 50, box: 'chest4Star' },
      { from: 'preciousShard', count: 50, box: 'preciousGiftbox' },
    ]);
  });

  it('copies the boxes: 3★ (14), 5★ (36), 4★ chest (6), Supreme (21), Legendary (6), Shiny (6), L & D (15), Giftbox (6)', () => {
    expect(config.bag.boxes.map((b) => [b.id, b.rows.length])).toEqual([
      ['box3Star', 14],
      ['box5Star', 36],
      ['chest4Star', 6],
      ['boxSupreme', 21],
      ['boxLegendary', 6],
      ['boxShinySupreme', 6],
      ['boxLD', 15],
      ['preciousGiftbox', 6],
    ]);
  });
});

describe('Bag compose', () => {
  it('40 3-Star Shards make a 3★ box that opens itself into a Pokémon at its first star', () => {
    const state = withCurrencies({ pokemonShard3: 85 });
    const before = state.roster.length;
    const out = applyCompose(config, state, 'pokemonShard3', 2, NOW, mulberry32(1));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.state.currencies.pokemonShard3).toBe(5);
    expect(out.value.draws).toHaveLength(2);
    expect(out.value.state.roster).toHaveLength(before + 2);
    for (const d of out.value.draws) expect(d.star).toBe(3);
  });

  it('a 5★ box gives its card at 5★, a 4★ chest at 4★', () => {
    const state = withCurrencies({ pokemonShard5: 50, pokemonShard4: 50 });
    const five = applyCompose(config, state, 'pokemonShard5', 1, NOW, mulberry32(2));
    const four = applyCompose(config, state, 'pokemonShard4', 1, NOW, mulberry32(2));
    expect(five.ok && five.value.draws[0]?.star).toBe(5);
    expect(four.ok && four.value.draws[0]?.star).toBe(4);
  });

  it('50 Precious Shards make a Giftbox that stays in the bag', () => {
    const out = applyCompose(config, withCurrencies({ preciousShard: 100, preciousGiftbox: 0 }), 'preciousShard', 2, NOW, mulberry32(3));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.draws).toEqual([]);
    expect(out.value.boxes).toEqual({ preciousGiftbox: 2 });
    expect(out.value.state.currencies.preciousGiftbox).toBe(2);
    expect(out.value.state.currencies.preciousShard).toBe(0);
  });

  it('refuses too few shards, a bad count and an unknown recipe', () => {
    const state = withCurrencies({ pokemonShard3: 39 });
    expect(applyCompose(config, state, 'pokemonShard3', 1, NOW, mulberry32(1))).toMatchObject({ ok: false, error: 'insufficient_items' });
    expect(applyCompose(config, state, 'pokemonShard3', 0, NOW, mulberry32(1))).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(applyCompose(config, state, 'gold', 1, NOW, mulberry32(1))).toMatchObject({ ok: false, error: 'not_found' });
  });
});

describe('Bag boxes', () => {
  it('a Legendary Random Box opens into one of the six birds and beasts', () => {
    const out = applyOpenBox(config, withCurrencies({ boxLegendary: 3 }), 'boxLegendary', 3, NOW, mulberry32(4));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.state.currencies.boxLegendary).toBe(0);
    const six = ['zapdos', 'moltres', 'articuno', 'raikou', 'entei', 'suicune'];
    for (const d of out.value.draws) expect(six).toContain(d.speciesId);
  });

  it('the L & D Opt Box gives the chosen Light / Dark Pokémon', () => {
    const out = applyChooseBox(config, withCurrencies({ boxLD: 1 }), 'boxLD', 'mewtwo', NOW);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.draws.map((d) => d.speciesId)).toEqual(['mewtwo']);
    expect(applyChooseBox(config, out.value.state, 'boxLD', 'mewtwo', NOW)).toMatchObject({ ok: false, error: 'insufficient_items' });
    expect(applyChooseBox(config, withCurrencies({ boxLD: 1 }), 'boxLD', 'lugia', NOW)).toMatchObject({ ok: false, error: 'invalid_input' });
  });

  it('the Giftbox gives 50 shards of the chosen Legendary', () => {
    const state = withCurrencies({ preciousGiftbox: 1 });
    const out = applyChooseBox(config, state, 'preciousGiftbox', 'raikou', NOW);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.shards).toEqual({ raikou: 50 });
    expect(out.value.state.speciesShards.raikou).toBe((state.speciesShards.raikou ?? 0) + 50);
    expect(out.value.state.roster).toHaveLength(state.roster.length);
  });

  it('a random box cannot be chosen from, and a self-opening box is never in the bag', () => {
    expect(applyChooseBox(config, withCurrencies({ boxLegendary: 1 }), 'boxLegendary', 'zapdos', NOW)).toMatchObject({ ok: false });
    expect(applyOpenBox(config, withCurrencies({}), 'box5Star', 1, NOW, mulberry32(1))).toMatchObject({ ok: false, error: 'not_found' });
  });

  it('the view lists what the shards make and each box row', () => {
    const view = bagView(config, withCurrencies({ pokemonShard5: 120 }));
    expect(view.recipes.find((r) => r.from === 'pokemonShard5')).toMatchObject({ have: 120, makes: 2 });
    const five = view.boxes.find((b) => b.id === 'box5Star')!;
    expect(five.rows.reduce((s, r) => s + (r.probability ?? 0), 0)).toBeCloseTo(1, 6);
    expect(view.boxes.find((b) => b.id === 'preciousGiftbox')!.rows[0]).toMatchObject({ amount: 50, probability: null });
  });
});

describe('LocalServer Bag', () => {
  it('composes through the server boundary and saves', async () => {
    config.now = () => NOW;
    const srv = new LocalServer(new MemoryStore(), config);
    await srv.loadAccount();
    await srv.grantCurrency('pokemonShard3');
    const bag = await srv.getBag();
    expect(bag.ok).toBe(true);
    if (!bag.ok) return;
    const recipe = bag.value.recipes.find((r) => r.from === 'pokemonShard3')!;
    expect(recipe.makes).toBeGreaterThan(0);
    const made = await srv.composeBag('pokemonShard3', 1, 9);
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(made.value.draws).toHaveLength(1);
    expect(made.value.snapshot.state.currencies.pokemonShard3).toBe(recipe.have - 40);
  });
});
