import { describe, expect, it } from 'vitest';
import { buildConfig } from './config';
import { createInitialState, migrateSave, parseSave, serializeSave, SAVE_VERSION } from './save';

const config = buildConfig();

describe('save codec', () => {
  it('creates a seeded initial account', () => {
    const state = createInitialState(config);
    expect(state.roster).toHaveLength(config.startingRoster.length);
    expect(state.currencies.gold).toBeGreaterThan(0);
    expect(state.schemaVersion).toBe(SAVE_VERSION);
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
