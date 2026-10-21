import { describe, expect, it } from 'vitest';
import { CURRENCY_IDS, MATERIAL_CURRENCY_IDS, emptyLoadout } from '@wildbound/engine';
import { buildConfig } from './config';
import { createInitialState, migrateSave, parseSave, serializeSave, SAVE_VERSION } from './save';

const config = buildConfig();

describe('save codec', () => {
  it('creates a seeded initial account', () => {
    const state = createInitialState(config);
    expect(state.roster).toHaveLength(config.startingRoster.length);
    expect(state.currencies.gold).toBeGreaterThan(0);
    expect(state.schemaVersion).toBe(SAVE_VERSION);
    expect(state.plates).toEqual({});
    expect(new Set(state.roster.map((w) => w.id)).size).toBe(state.roster.length);
  });

  it('round-trips through serialize/parse', () => {
    const state = createInitialState(config);
    const result = parseSave(serializeSave(state));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.roster).toEqual(state.roster);
    expect(result.value.currencies).toEqual(state.currencies);
  });

  it('fills every M11 material when migrating a v6 save', () => {
    const state = createInitialState(config);
    const oldCurrencies: Record<string, number> = { ...state.currencies };
    for (const id of MATERIAL_CURRENCY_IDS) delete oldCurrencies[id];
    const result = migrateSave(
      { version: 6, state: { ...state, schemaVersion: 6, currencies: oldCurrencies } },
      Date.now(),
      config,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.schemaVersion).toBe(SAVE_VERSION);
    for (const id of CURRENCY_IDS) {
      expect(result.value.currencies[id]).toBeTypeOf('number');
    }
    for (const id of MATERIAL_CURRENCY_IDS) expect(result.value.currencies[id]).toBe(0);
  });

  it('migrates the single v7 Berry slot into two slots', () => {
    const state = createInitialState(config);
    const wildId = state.roster[0]!.id;
    const loadout = emptyLoadout(config.equipment.tuning) as unknown as Record<string, unknown>;
    delete loadout.charms;
    loadout.charm = 'charm-sunpetal-berry';
    const result = migrateSave(
      { version: 7, state: { ...state, schemaVersion: 7, loadouts: { [wildId]: loadout } } },
      Date.now(),
      config,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.loadouts[wildId]?.charms).toEqual(['charm-sunpetal-berry', null]);
    expect('charm' in (result.value.loadouts[wildId] ?? {})).toBe(false);
    expect(result.value.plates).toEqual({});
  });

  it('rejects malformed JSON and missing fields', () => {
    expect(parseSave('{ not json').ok).toBe(false);
    expect(parseSave('{}').ok).toBe(false);
    expect(parseSave(JSON.stringify({ version: 1, state: { schemaVersion: 1 } })).ok).toBe(false);
  });

  it('rejects a save from a newer schema version', () => {
    const state = createInitialState(config);
    const raw = { version: SAVE_VERSION + 1, state };
    const result = migrateSave(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('corrupt_save');
  });
});
