import { describe, expect, it } from 'vitest';
import { buildConfig } from './config';
import { LocalServer } from './local-server';
import { upgradePlateAction } from './plates';
import { createInitialState } from './save';
import { MemoryStore } from './storage';

const START = Date.parse('2026-01-01T00:00:00Z');

function makeServer() {
  const config = buildConfig();
  config.now = () => START;
  return new LocalServer(new MemoryStore(), config);
}

describe('M11.7 plates', () => {
  it('raises a Wild plate, spends Bottles and lifts Power', async () => {
    const srv = makeServer();
    const loaded = await srv.loadAccount();
    if (!loaded.ok) throw new Error(loaded.message);
    const wild = loaded.value.state.roster[0]!;
    await srv.grantCurrency('plateBottle', 1_000);

    const before = await srv.getEquipment(wild.id);
    if (!before.ok) throw new Error(before.message);
    expect(before.value.plate.stage).toBe(0);
    expect(before.value.plate.cost).toEqual({ currency: 'plateBottle', amount: 10 });
    expect(before.value.power.layers.plates).toBe(0);
    const powerBefore = loaded.value.power[wild.id] ?? 0;

    const raised = await srv.upgradePlate(wild.id);
    expect(raised.ok).toBe(true);
    if (!raised.ok) return;
    expect(raised.value.state.plates[wild.id]).toBe(1);
    expect(raised.value.state.currencies.plateBottle).toBe(990);
    expect(raised.value.power[wild.id] ?? 0).toBeGreaterThan(powerBefore);

    const after = await srv.getEquipment(wild.id);
    if (!after.ok) throw new Error(after.message);
    expect(after.value.plate.stage).toBe(1);
    expect(after.value.plate.cost).toEqual({ currency: 'plateBottle', amount: 15 });
    expect(after.value.power.layers.plates).toBeGreaterThan(0);
    expect(after.value.plate.linesAreNext).toBe(true);
    expect(after.value.plate.linesText.length).toBeGreaterThan(0);
  });

  it('charges Fragments for the 5 → 6 step', async () => {
    const srv = makeServer();
    const loaded = await srv.loadAccount();
    if (!loaded.ok) throw new Error(loaded.message);
    const wild = loaded.value.state.roster[0]!;
    await srv.grantCurrency('plateBottle', 1_000);
    await srv.grantCurrency('plateFragment', 1_000);
    for (let stage = 0; stage < 5; stage += 1) {
      const raised = await srv.upgradePlate(wild.id);
      expect(raised.ok).toBe(true);
    }

    const atFive = await srv.getEquipment(wild.id);
    if (!atFive.ok) throw new Error(atFive.message);
    expect(atFive.value.plate.stage).toBe(5);
    expect(atFive.value.plate.cost).toEqual({ currency: 'plateFragment', amount: 375 });

    const sixth = await srv.upgradePlate(wild.id);
    expect(sixth.ok).toBe(true);
    if (!sixth.ok) return;
    expect(sixth.value.state.plates[wild.id]).toBe(6);
    expect(sixth.value.state.currencies.plateFragment).toBe(625);
  });

  it('stops at stage 20', () => {
    const config = buildConfig();
    const state = createInitialState(config);
    const wild = state.roster[0]!;
    state.plates[wild.id] = 20;
    const result = upgradePlateAction(config, state, wild.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('at_level_cap');
  });
});
