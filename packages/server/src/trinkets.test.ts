import { describe, expect, it } from 'vitest';
import { buildConfig } from './config';
import { LocalServer } from './local-server';
import { createInitialState } from './save';
import { MemoryStore } from './storage';
import { grantTrinketItem, upgradeTrinketAction } from './trinkets';

const START = Date.parse('2026-01-01T00:00:00Z');

function makeServer() {
  const config = buildConfig();
  config.now = () => START;
  return new LocalServer(new MemoryStore(), config);
}

function grownState(config: ReturnType<typeof buildConfig>) {
  const state = createInitialState(config);
  const wild = { ...state.roster[0]!, speciesId: 'charizard' };
  // R6b unlock: 6 Pokémon at Lv 220, this one at 7★.
  state.roster = Array.from({ length: 6 }, (_, n) => ({ ...wild, id: `g${n}`, level: 220, stars: 10 }));
  return { state, wild: state.roster[0]! };
}

describe('R6b trinkets', () => {
  it('levels a holder with Star Shards (and its own item at 9 / 19 / 29 / 39), shared by copies', async () => {
    const srv = makeServer();
    const loaded = await srv.loadAccount();
    if (!loaded.ok) throw new Error(loaded.message);
    const wild = loaded.value.state.roster.find((w) => w.speciesId === 'charizard')!;
    const before = await srv.getEquipment(wild.id);
    if (!before.ok) throw new Error(before.message);
    expect(before.value.trinket.available).toBe(true);
    expect(before.value.trinket.maxLevel).toBe(40);
    expect(before.value.trinket.cost?.starShard).toBe(1_400);
    expect(before.value.trinket.locked?.reason).toBe('roster');
    expect((await srv.upgradeTrinket(wild.id)).ok).toBe(false);

    const config = buildConfig();
    const { state, wild: grown } = grownState(config);
    state.currencies.starShard = 1_000_000;
    let s = state;
    for (let n = 0; n < 9; n += 1) {
      const r = upgradeTrinketAction(config, s, grown.id);
      if (!r.ok) throw new Error(r.message);
      s = r.value;
    }
    expect(s.trinkets[grown.speciesId]).toBe(9);
    const blocked = upgradeTrinketAction(config, s, grown.id);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toBe('insufficient_items');
    const r10 = upgradeTrinketAction(config, grantTrinketItem(s, grown.speciesId, 140), grown.id);
    expect(r10.ok).toBe(true);
    if (r10.ok) expect(r10.value.trinketItems[grown.speciesId]).toBe(0);
  });

  it('needs the holder at 7 stars and stops at level 40', () => {
    const config = buildConfig();
    const { state, wild } = grownState(config);
    state.roster[0] = { ...wild, stars: 6 };
    const low = upgradeTrinketAction(config, state, wild.id);
    expect(low.ok).toBe(false);
    if (!low.ok) expect(low.error).toBe('resource_locked');
    state.roster[0] = wild;
    state.trinkets[wild.speciesId] = 40;
    const result = upgradeTrinketAction(config, state, wild.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('at_level_cap');
  });

  it('has none for Starmie', () => {
    const config = buildConfig();
    const { state, wild } = grownState(config);
    state.roster[0] = { ...wild, speciesId: 'starmie' };
    const result = upgradeTrinketAction(config, state, wild.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not_found');
  });
});
