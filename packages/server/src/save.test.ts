import { describe, expect, it } from 'vitest';
import { buildConfig } from './config';
import { createInitialState, migrateSave, MIN_SAVE_VERSION, parseSave, serializeSave, SAVE_VERSION } from './save';

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
    expect(state.resonance.slots).toHaveLength(2);
    expect(state.resonance.evolved).toBe(false);
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

  it('fills missing slices on a current-version save', () => {
    const state = createInitialState(config);
    const raw = state as unknown as Record<string, unknown>;
    delete raw.trinkets;
    delete raw.vip;
    const result = migrateSave({ version: SAVE_VERSION, state: raw }, Date.now(), config);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.trinkets).toEqual({});
    expect(result.value.vip).toEqual({ lastClaimDay: null });
  });

  it('refuses every save older than MIN_SAVE_VERSION as outdated (source-retrofit reset)', () => {
    const state = createInitialState(config);
    for (let version = 1; version < MIN_SAVE_VERSION; version += 1) {
      const result = migrateSave({ version, state: { ...state, schemaVersion: version } }, Date.now(), config);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('outdated_save');
    }
    expect(migrateSave({ version: MIN_SAVE_VERSION, state }, Date.now(), config).ok).toBe(true);
  });

  it('rejects malformed JSON and missing fields', () => {
    expect(parseSave('{ not json').ok).toBe(false);
    expect(parseSave('{}').ok).toBe(false);
    expect(parseSave(JSON.stringify({ version: 1, state: { schemaVersion: 1 } })).ok).toBe(false);
    const state = createInitialState(config);
    const raw = state as unknown as Record<string, unknown>;
    const petHome = { ...(raw.petHome as Record<string, unknown>) };
    delete petHome.nextPetSeq;
    expect(migrateSave({ version: SAVE_VERSION, state: { ...raw, petHome } }).ok).toBe(false);
    const skyPillar = { ...(raw.skyPillar as Record<string, unknown>) };
    delete skyPillar.claimedChests;
    expect(migrateSave({ version: SAVE_VERSION, state: { ...raw, skyPillar } }).ok).toBe(false);
  });

  it('rejects a save from a newer schema version', () => {
    const state = createInitialState(config);
    const raw = { version: SAVE_VERSION + 1, state };
    const result = migrateSave(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('corrupt_save');
  });
});
