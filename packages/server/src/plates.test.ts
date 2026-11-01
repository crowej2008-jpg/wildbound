import { describe, expect, it } from 'vitest';
import { buildConfig } from './config';
import { LocalServer } from './local-server';
import { upgradePlateAction } from './plates';
import { createInitialState } from './save';
import { buildWildTeam } from './battle';
import { MemoryStore } from './storage';

/** R6a: the source's plates (kb/plate.md; scripts/import-plates.mjs). */

const START = Date.parse('2026-01-01T00:00:00Z');

async function setup(opts: { playerLevel?: number; stars?: number; level?: number } = {}) {
  const config = buildConfig();
  config.now = () => START;
  const srv = new LocalServer(new MemoryStore(), config);
  await srv.loadAccount();
  const exported = await srv.exportSave();
  if (!exported.ok) throw new Error(exported.message);
  const save = JSON.parse(exported.value);
  save.state.profile.level = opts.playerLevel ?? 40;
  const wild = save.state.roster[0];
  wild.stars = opts.stars ?? 6;
  wild.level = opts.level ?? 40;
  await srv.importSave(JSON.stringify(save));
  await srv.grantCurrency('plateBottle', 10_000);
  await srv.grantCurrency('plateFragment', 10_000);
  return { config, srv, wildId: wild.id as string };
}

describe('R6a plates', () => {
  it('copies the source table: 54 plates, one stat table, 630 Bottles + 2,625 Fragments to 18', () => {
    const t = buildConfig().equipment.plates;
    expect(t.plates).toHaveLength(54);
    expect(t.stages[18]).toEqual({ stage: 18, hp: 780002, pAtk: 110931, sAtk: 110931, hpPct: 0.3 });
    const sum = (c: string) => t.steps.filter((s) => s.currency === c).reduce((a, s) => a + s.amount, 0);
    expect(sum('plateBottle')).toBe(630);
    expect(sum('plateFragment')).toBe(2625);
  });

  it('opens at player Lv 34 on a 6★ Pokémon', async () => {
    expect((await (await setup({ playerLevel: 33 })).srv.upgradePlate((await setup({ playerLevel: 33 })).wildId)).ok).toBe(false);
    const low = await setup({ stars: 5 });
    expect((await low.srv.upgradePlate(low.wildId)).ok).toBe(false);
    const { srv, wildId } = await setup();
    const view = await srv.getEquipment(wildId);
    if (!view.ok) throw new Error(view.message);
    expect(view.value.plate.cost).toEqual({ currency: 'plateBottle', amount: 15 });
    expect(view.value.plate.locked).toBeNull();
    const raised = await srv.upgradePlate(wildId);
    if (!raised.ok) throw new Error(raised.message);
    expect(raised.value.state.plates[wildId]).toBe(1);
    expect(raised.value.state.currencies.plateBottle).toBe(10_000 - 15);
  });

  it('5 → 6 takes 375 Fragments; stage 6+ needs the Pokémon at Lv 47', async () => {
    const { srv, wildId } = await setup({ level: 46 });
    for (let i = 0; i < 6; i += 1) {
      const r = await srv.upgradePlate(wildId);
      if (!r.ok) throw new Error(r.message);
    }
    const s = await srv.loadAccount();
    if (!s.ok) throw new Error('load');
    expect(s.value.state.currencies.plateFragment).toBe(10_000 - 375);
    const blocked = await srv.upgradePlate(wildId);
    expect(blocked.ok).toBe(false);
    const view = await srv.getEquipment(wildId);
    if (!view.ok) throw new Error(view.message);
    expect(view.value.plate.locked).toMatch(/Lv 47/);
  });

  it('names the plate by the card type and stops at 18', () => {
    const config = buildConfig();
    const state = createInitialState(config);
    const wild = state.roster[0]!;
    state.profile.level = 99;
    state.plates[wild.id] = 18;
    const result = upgradePlateAction(config, state, wild.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('at_level_cap');
  });

  it('plate skills switch on at stages 6 / 12 / 18 (Wobbuffet: heal, 180% ult, 80% Counter)', () => {
    const config = buildConfig();
    const state = createInitialState(config);
    const wild = { id: 'wob', speciesId: 'wobbuffet', level: 100, stars: 10, locked: false, acquiredAt: 0 };
    state.roster.push(wild);
    const spec = (stage: number) => {
      state.plates.wob = stage;
      return buildWildTeam([wild], 'attackers', config, state).specs[0]!.kit;
    };
    expect(spec(5).skills.ult.rates).toEqual([1.6]);
    expect(spec(6).talents?.triggers?.some((t) => t.on === 'afterUlt')).toBe(true);
    expect(spec(11).skills.ult.rates).toEqual([1.6]);
    expect(spec(12).skills.ult.rates).toEqual([1.8]);
    expect(spec(17).counterShare).toBeUndefined();
    expect(spec(18).counterShare).toBe(0.8);
  });
});
