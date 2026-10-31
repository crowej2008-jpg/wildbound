import { describe, expect, it } from 'vitest';
import { applySkillLevels } from '@wildbound/engine';
import { kitById, kitToEngine } from '@wildbound/content';
import { buildConfig } from './config';
import { LocalServer } from './local-server';
import { createInitialState } from './save';
import { composeWildAction, upgradeOriginSkillAction } from './shards';
import { MemoryStore } from './storage';

/** E4: each species' own shards and the Origins' skill levels (source rules; owner 2026-10-31). */

const START = Date.parse('2026-01-01T00:00:00Z');

function makeServer() {
  const config = buildConfig();
  config.now = () => START;
  return { srv: new LocalServer(new MemoryStore(), config), config };
}

describe('species shards', () => {
  it('compose a Pokémon from its own shards (50 for an Origin), refusing short counts', () => {
    const config = buildConfig();
    const state = createInitialState(config);
    expect(state.speciesShards).toEqual({});
    expect(config.species.get('zacian')?.shards).toBe(50);
    expect(composeWildAction(config, state, 'zacian', 0).ok).toBe(false);
    const made = composeWildAction(config, { ...state, speciesShards: { zacian: 60 } }, 'zacian', 0);
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(made.value.speciesShards.zacian).toBe(10);
    expect(made.value.roster.at(-1)?.speciesId).toBe('zacian');
  });
});

describe('Origin skill levels', () => {
  it('cost 50 then 100 of the Origin’s own shards, cap at LV.3, and only Origins level', async () => {
    const { srv } = makeServer();
    await srv.loadAccount();
    await srv.grantSpeciesShards('zacian', 50);
    const made = await srv.composeWild('zacian');
    if (!made.ok) throw new Error(made.message);
    const zacian = made.value.state.roster.find((w) => w.speciesId === 'zacian')!;

    expect((await srv.upgradeOriginSkill(zacian.id, 'ult')).ok).toBe(false);
    await srv.grantSpeciesShards('zacian', 150);
    const l2 = await srv.upgradeOriginSkill(zacian.id, 'ult');
    expect(l2.ok).toBe(true);
    const l3 = await srv.upgradeOriginSkill(zacian.id, 'ult');
    if (!l3.ok) throw new Error(l3.message);
    expect(l3.value.state.speciesShards.zacian).toBe(0);
    expect(l3.value.state.roster.find((w) => w.id === zacian.id)?.skillLevels?.ult).toBe(3);
    const capped = await srv.upgradeOriginSkill(zacian.id, 'ult');
    expect(capped.ok).toBe(false);

    const view = await srv.getOriginSkills(zacian.id);
    if (!view.ok || !view.value) throw new Error('no view');
    const ult = view.value.rows.find((r) => r.row === 'ult')!;
    expect(ult.level).toBe(3);
    expect(ult.cost).toBeNull();
    expect(ult.text).toHaveLength(3);

    const config = buildConfig();
    const state = createInitialState(config);
    const plain = state.roster[0]!;
    expect(upgradeOriginSkillAction(config, { ...state, speciesShards: { [plain.speciesId]: 999 } }, plain.id, 'ult').ok).toBe(false);
  });

  it('a level swaps in its content (Zacian ult 150% → 170% at LV.3; Shadow Mewtwo splash 10% → 20%)', () => {
    const zacian = kitToEngine(kitById('zacian')!);
    expect(zacian.skills.ult.rates).toEqual([1.5]);
    expect(applySkillLevels(zacian, { ult: 3 }).skills.ult.rates).toEqual([1.7]);
    const mewtwo = kitToEngine(kitById('shadow-mewtwo')!);
    const splash = (k: typeof mewtwo) =>
      k.talents?.triggers?.flatMap((t) => t.effects ?? []).find((e) => e.op === 'splash');
    expect(splash(mewtwo)).toMatchObject({ share: 0.1 });
    expect(splash(applySkillLevels(mewtwo, { passive: 3 }))).toMatchObject({ share: 0.2 });
    expect(applySkillLevels(mewtwo, { passive: 1 })).toBe(mewtwo);
  });
});
