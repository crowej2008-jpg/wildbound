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
    expect(typeof state.serverEpoch).toBe('number');
    expect(state.serverEpoch).toBeGreaterThan(0);
    expect(state.plates).toEqual({});
    expect(state.trinkets).toEqual({});
    expect(state.resonance.unlocked).toBe(2);
    expect(state.resonance.slots).toHaveLength(6);
    expect(state.resonance.slots.every((id) => id === null)).toBe(true);
    expect(state.vip.lastClaimDay).toBeNull();
    expect(state.titles.owned).toEqual({});
    expect(state.titles.equipped).toEqual({ common: null, premium: null, rare: null });
    expect(state.campaign.gyms).toEqual({});
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
    expect(result.value.trinkets).toEqual({});
  });

  it('migrates a v9 save with no trinket slice', () => {
    const state = createInitialState(config);
    const raw = state as unknown as Record<string, unknown>;
    delete raw.trinkets;
    const result = migrateSave(
      { version: 9, state: { ...raw, schemaVersion: 9 } },
      Date.now(),
      config,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.schemaVersion).toBe(SAVE_VERSION);
    expect(result.value.trinkets).toEqual({});
  });

  it('migrates a v10 save with no resonance board', () => {
    const state = createInitialState(config);
    const raw = state as unknown as Record<string, unknown>;
    delete raw.resonance;
    const result = migrateSave(
      { version: 10, state: { ...raw, schemaVersion: 10 } },
      Date.now(),
      config,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.schemaVersion).toBe(SAVE_VERSION);
    expect(result.value.resonance.unlocked).toBe(2);
    expect(result.value.resonance.slots).toEqual([null, null, null, null, null, null]);
  });

  it('migrates a v11 save with no VIP claim slice', () => {
    const state = createInitialState(config);
    const raw = state as unknown as Record<string, unknown>;
    delete raw.vip;
    const result = migrateSave(
      { version: 11, state: { ...raw, schemaVersion: 11 } },
      Date.now(),
      config,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.schemaVersion).toBe(SAVE_VERSION);
    expect(result.value.vip).toEqual({ lastClaimDay: null });
  });

  it('migrates a v12 save, drops expired titles and clears their slots', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    const state = createInitialState(config);
    const raw = state as unknown as Record<string, unknown>;
    const result = migrateSave(
      {
        version: 12,
        state: {
          ...raw,
          schemaVersion: 12,
          titles: {
            owned: {
              'trail-01': { stage: 1, expiresAt: now - 1 },
              'trail-02': { stage: 1, expiresAt: null },
            },
            equipped: { common: 'trail-01', premium: 'trail-02', rare: null },
          },
        },
      },
      now,
      config,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.schemaVersion).toBe(SAVE_VERSION);
    expect(result.value.titles.owned['trail-01']).toBeUndefined();
    expect(result.value.titles.owned['trail-02']).toEqual({ stage: 1, expiresAt: null });
    expect(result.value.titles.equipped).toEqual({ common: null, premium: 'trail-02', rare: null });
  });

  it('migrates a v13 save with no gym clears', () => {
    const state = createInitialState(config);
    const raw = state as unknown as Record<string, unknown>;
    delete raw.serverEpoch;
    const campaign = { stars: { 'c1-1': 3 } };
    const result = migrateSave(
      { version: 13, state: { ...raw, schemaVersion: 13, campaign } },
      Date.now(),
      config,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.schemaVersion).toBe(SAVE_VERSION);
    expect(result.value.campaign.stars).toEqual({ 'c1-1': 3 });
    expect(result.value.campaign.gyms).toEqual({});
    expect(result.value.serverEpoch).toBe(state.mail[0]?.createdAt);
  });

  it('migrates a v14 save with no server epoch from its welcome mail', () => {
    const state = createInitialState(config);
    const raw = state as unknown as Record<string, unknown>;
    delete raw.serverEpoch;
    const result = migrateSave(
      { version: 14, state: { ...raw, schemaVersion: 14 } },
      Date.now(),
      config,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.schemaVersion).toBe(SAVE_VERSION);
    expect(result.value.serverEpoch).toBe(state.mail[0]?.createdAt);
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
