import { describe, expect, it } from 'vitest';
import { buildConfig } from './config';
import { LocalServer } from './local-server';
import { createInitialState } from './save';
import { MemoryStore } from './storage';
import { upgradeTrinketAction } from './trinkets';

const START = Date.parse('2026-01-01T00:00:00Z');

function makeServer() {
  const config = buildConfig();
  config.now = () => START;
  return new LocalServer(new MemoryStore(), config);
}

describe('M11.8 trinkets', () => {
  it('levels a species trinket with Star Shards, lifts Power and shares it with copies', async () => {
    const srv = makeServer();
    const loaded = await srv.loadAccount();
    if (!loaded.ok) throw new Error(loaded.message);
    const wild = loaded.value.state.roster[0]!;
    await srv.grantCurrency('starShard', 1_000);

    const before = await srv.getEquipment(wild.id);
    if (!before.ok) throw new Error(before.message);
    expect(before.value.trinket.level).toBe(0);
    expect(before.value.trinket.maxLevel).toBe(40);
    expect(before.value.trinket.cost).toBe(10);
    expect(before.value.trinket.name).toContain('Keepsake');
    expect(before.value.power.layers.trinkets).toBe(0);
    expect(before.value.starShards).toBe(1_000);
    const powerBefore = loaded.value.power[wild.id] ?? 0;

    const raised = await srv.upgradeTrinket(wild.id);
    expect(raised.ok).toBe(true);
    if (!raised.ok) return;
    expect(raised.value.state.trinkets[wild.speciesId]).toBe(1);
    expect(raised.value.state.currencies.starShard).toBe(990);
    expect(raised.value.power[wild.id] ?? 0).toBeGreaterThan(powerBefore);

    const after = await srv.getEquipment(wild.id);
    if (!after.ok) throw new Error(after.message);
    expect(after.value.trinket.level).toBe(1);
    expect(after.value.trinket.cost).toBe(15);
    expect(after.value.trinket.linesAreNext).toBe(true);
    expect(after.value.trinket.linesText.length).toBeGreaterThan(0);
    expect(after.value.power.layers.trinkets).toBeGreaterThan(0);

    const copy = await srv.grantWild(wild.speciesId);
    expect(copy.ok).toBe(true);
    if (!copy.ok) return;
    const copyWild = copy.value.state.roster[copy.value.state.roster.length - 1]!;
    const copyView = await srv.getEquipment(copyWild.id);
    if (!copyView.ok) throw new Error(copyView.message);
    expect(copyView.value.trinket.level).toBe(1);
  });

  it('stops at level 40', () => {
    const config = buildConfig();
    const state = createInitialState(config);
    const wild = state.roster[0]!;
    state.trinkets[wild.speciesId] = 40;
    const result = upgradeTrinketAction(config, state, wild.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('at_level_cap');
  });
});
