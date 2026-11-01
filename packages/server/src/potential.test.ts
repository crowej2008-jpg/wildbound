import { describe, expect, it } from 'vitest';
import { buildConfig } from './config';
import { buildWildTeam } from './battle';
import { LocalServer } from './local-server';
import { MemoryStore } from './storage';
import { setWildStars } from './testing';

/** R4: the source's Potential through the server boundary (kb/potential.md). */

function makeServer() {
  const config = buildConfig();
  config.now = () => Date.UTC(2026, 10, 1);
  return { config, srv: new LocalServer(new MemoryStore(), config) };
}

async function grant(srv: LocalServer, speciesId: string): Promise<string> {
  const before = await srv.loadAccount();
  if (!before.ok) throw new Error('load failed');
  const ids = new Set(before.value.state.roster.map((w) => w.id));
  const granted = await srv.grantWild(speciesId);
  if (!granted.ok) throw new Error(`grant ${speciesId} failed: ${granted.error}`);
  const added = granted.value.state.roster.find((w) => !ids.has(w.id));
  if (!added) throw new Error(`no new ${speciesId}`);
  return added.id;
}

async function darkrai() {
  const { config, srv } = makeServer();
  await srv.loadAccount();
  await srv.grantCurrency('potentialShard', 1_000_000);
  await srv.grantCurrency('gems', 100);
  const wildId = await grant(srv, 'darkrai');
  return { config, srv, wildId };
}

describe('R4 Potential', () => {
  it('opens at 7★; tier 1 takes a 5★ Water, Fire and Grass Pokémon and 20,000 shards', async () => {
    const { srv, wildId } = await darkrai();
    await setWildStars(srv, wildId, 6);
    let view = await srv.getPotential(wildId);
    if (!view.ok) throw new Error(view.message);
    expect(view.value.hasTree).toBe(true);
    expect(view.value.panelOpen).toBe(false);
    expect((await srv.unlockPotential(wildId, 0, 0)).ok).toBe(false);

    await setWildStars(srv, wildId, 7);
    const fodder = [await grant(srv, 'keldeo'), await grant(srv, 'ho-oh'), await grant(srv, 'dialga')];
    view = await srv.getPotential(wildId);
    if (!view.ok) throw new Error(view.message);
    expect(view.value.panelOpen).toBe(true);
    expect(view.value.tiers[0]!.options.map((o) => o.name)).toEqual(['Victory Star', 'Friendly Defense', 'Area Attack']);
    expect(view.value.tiers[0]!.canUnlock).toBe(true);
    expect(view.value.tiers[1]!.open).toBe(false);

    const unlocked = await srv.unlockPotential(wildId, 0, 0);
    if (!unlocked.ok) throw new Error(unlocked.message);
    const s = unlocked.value.state;
    expect(s.currencies.potentialShard).toBe(1_000_000 - 20_000);
    for (const id of fodder) expect(s.roster.some((w) => w.id === id)).toBe(false);
    expect(s.potential[wildId]!.picks[0]).toEqual({ option: 0, lv: 1 });

    const levelled = await srv.levelPotential(wildId, 0);
    if (!levelled.ok) throw new Error(levelled.message);
    expect(levelled.value.state.currencies.potentialShard).toBe(1_000_000 - 20_000 - 26_000);
    expect(levelled.value.state.potential[wildId]!.picks[0]!.lv).toBe(2);
  });

  it('a reset (16 Diamonds) returns the shards and the fodder Pokémon', async () => {
    const { srv, wildId } = await darkrai();
    await setWildStars(srv, wildId, 7);
    for (const s of ['keldeo', 'ho-oh', 'dialga']) await grant(srv, s);
    await srv.unlockPotential(wildId, 0, 1);
    const before = await srv.loadAccount();
    if (!before.ok) throw new Error('load failed');
    const reset = await srv.resetPotential(wildId);
    if (!reset.ok) throw new Error(reset.message);
    const s = reset.value.state;
    expect(s.currencies.potentialShard).toBe(1_000_000);
    expect(s.currencies.gems).toBe((before.value.state.currencies.gems ?? 0) - 16);
    expect(s.potential[wildId]).toBeUndefined();
    const back = s.roster.filter((w) => ['keldeo', 'ho-oh', 'dialga'].includes(w.speciesId));
    expect(back.map((w) => w.stars)).toEqual([5, 5, 5]);
  });

  it('tiers unlock in any order; a Potential Core stands in for the own copy on tiers 5–9', async () => {
    const { srv, wildId } = await darkrai();
    await setWildStars(srv, wildId, 11);
    expect((await srv.unlockPotential(wildId, 4, 1)).ok).toBe(false); // no copy, no Core
    await srv.grantCurrency('potentialCore', 1);
    const view = await srv.getPotential(wildId);
    if (!view.ok) throw new Error(view.message);
    expect(view.value.tiers[4]!.coresNeeded).toBe(1);
    const unlocked = await srv.unlockPotential(wildId, 4, 1);
    if (!unlocked.ok) throw new Error(unlocked.message);
    expect(unlocked.value.state.currencies.potentialCore).toBe(0);
    expect(unlocked.value.state.potential[wildId]!.picks[4]).toEqual({ option: 1, lv: 1 });
    expect(unlocked.value.state.potential[wildId]!.picks[0]).toBeNull();
  });

  it('never takes a squad member or a Pokémon with developed Potential as fodder', async () => {
    const { srv, wildId } = await darkrai();
    await setWildStars(srv, wildId, 11);
    const copy = await grant(srv, 'darkrai');
    await setWildStars(srv, copy, 7);
    for (const s of ['keldeo', 'ho-oh', 'dialga']) await grant(srv, s);
    expect((await srv.unlockPotential(copy, 0, 0)).ok).toBe(true);
    await setWildStars(srv, copy, 5);
    // The copy is a 5★ Darkrai, but its Potential is developed.
    const view = await srv.getPotential(wildId);
    if (!view.ok) throw new Error(view.message);
    expect(view.value.tiers[4]!.fodder[0]!.have).toBe(0);
  });

  it('picks reach the battle spec (Valor: in battle ATK +4%)', async () => {
    const { config, srv, wildId } = await darkrai();
    await setWildStars(srv, wildId, 8);
    for (const s of ['keldeo', 'ho-oh', 'dialga', 'keldeo', 'ho-oh', 'dialga']) await grant(srv, s);
    const unlocked = await srv.unlockPotential(wildId, 1, 0);
    if (!unlocked.ok) throw new Error(unlocked.message);
    const state = unlocked.value.state;
    const wild = state.roster.find((w) => w.id === wildId)!;
    const team = buildWildTeam([wild], 'attackers', config, state);
    expect(team.specs[0]!.statMods).toEqual([{ field: 'atkPct', add: 0.04 }]);
  });
});
