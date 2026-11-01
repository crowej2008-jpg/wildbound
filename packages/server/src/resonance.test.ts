import { describe, expect, it } from 'vitest';
import { upgradeCost } from '@wildbound/engine';
import { buildConfig } from './config';
import {
  buildResonanceView,
  buyResonanceSlotAction,
  clearResonanceCooldownAction,
  evolveResonanceAction,
  resonanceLevel,
  setResonanceSlotAction,
  syncResonance,
  upgradeResonanceAction,
} from './resonance';
import { createInitialState } from './save';

const NOW = Date.parse('2026-01-01T00:00:00Z');

/** Six top Pokémon at `level` plus one low one (the newcomer) — the starting six are all non-Origins. */
function setup(level = 100) {
  const config = buildConfig();
  const state = createInitialState(config);
  state.roster = state.roster.map((w) => ({ ...w, level, stars: 10 }));
  state.roster.push({ ...state.roster[0]!, id: 'newbie', level: 5, stars: 5 });
  state.currencies.resonationShard = 1_000;
  state.currencies.gems = 1_000;
  return { config, state };
}

describe('R7 resonance (source rules)', () => {
  it('the top six set the crystal level and a slotted Pokémon takes it; leaving gives its own level back', () => {
    const { config, state } = setup(120);
    expect(resonanceLevel(config, state)).toBe(120);
    const put = setResonanceSlotAction(config, state, 0, 'newbie', NOW);
    expect(put.ok).toBe(true);
    if (!put.ok) return;
    const newbie = put.value.roster.find((w) => w.id === 'newbie')!;
    expect(newbie.level).toBe(120);
    expect(newbie.ownLevel).toBe(5);

    const out = setResonanceSlotAction(config, put.value, 0, null, NOW);
    if (!out.ok) throw new Error(out.message);
    const back = out.value.roster.find((w) => w.id === 'newbie')!;
    expect(back.level).toBe(5);
    expect(back.ownLevel).toBeUndefined();
    // the slot now cools down for 24 hours; clearing costs 4 Diamonds an hour
    expect(setResonanceSlotAction(config, out.value, 0, 'newbie', NOW + 3_600_000).ok).toBe(false);
    const view = buildResonanceView(config, out.value, NOW + 3_600_000);
    expect(view.slots[0]!.clearGems).toBe(23 * 4);
    const cleared = clearResonanceCooldownAction(config, out.value, 0, NOW + 3_600_000);
    expect(cleared.ok).toBe(true);
    if (cleared.ok) expect(cleared.value.currencies.gems).toBe(1_000 - 92);
  });

  it('buys slots from the source price table (30, 80, 100 … Resonation Shards)', () => {
    const { config, state } = setup();
    const view = buildResonanceView(config, state, NOW);
    expect(view.slots).toHaveLength(2);
    expect(view.nextSlot).toEqual({ shards: 30, gems: 12 });
    const one = buyResonanceSlotAction(config, state);
    if (!one.ok) throw new Error(one.message);
    expect(one.value.currencies.resonationShard).toBe(970);
    expect(buildResonanceView(config, one.value, NOW).nextSlot).toEqual({ shards: 80, gems: 32 });
  });

  it('evolves at Lv 340 (six free slots) and then levels with Candy, Gold and Stones up to 340 + 8 per 12★', () => {
    const { config, state } = setup(340);
    expect(setup(339).state && evolveResonanceAction(config, setup(339).state).ok).toBe(false);
    const evolved = evolveResonanceAction(config, state);
    if (!evolved.ok) throw new Error(evolved.message);
    const r = evolved.value.resonance;
    expect(r.evolved).toBe(true);
    expect(r.level).toBe(340);
    expect(r.slots).toHaveLength(8);

    // no Pokémon at 12★: capped at 340
    const rich = { ...evolved.value, currencies: { ...evolved.value.currencies, candy: 1e9, gold: 1e9, stone: 1e6 } };
    expect(upgradeResonanceAction(config, rich).ok).toBe(false);
    rich.roster = rich.roster.map((w, i) => (i === 0 ? { ...w, stars: 12 } : w));
    const up = upgradeResonanceAction(config, rich);
    if (!up.ok) throw new Error(up.message);
    expect(up.value.resonance.level).toBe(341);
    // the top six share the evolved level
    expect(up.value.roster.filter((w) => w.level === 341).length).toBeGreaterThanOrEqual(6);
  });

  it('prices the crystal from the server reads and interpolates between them', () => {
    const t = buildConfig().resonance;
    expect(upgradeCost(350, t)).toEqual({ candy: 210_000, gold: 630_000, stones: 1_450 });
    expect(upgradeCost(614, t)).toEqual({ candy: 1_780_000, gold: 5_340_000, stones: 4_050 });
    const mid = upgradeCost(355, t);
    expect(mid.candy).toBe(240_000);
    expect(mid.stones).toBe(1_500);
  });

  it('sync is stable and keeps Origins out', () => {
    const { config, state } = setup(150);
    expect(syncResonance(config, state)).toBe(state);
  });
});
