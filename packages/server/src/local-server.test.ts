import { describe, expect, it } from 'vitest';
import { buildConfig } from './config';
import { LocalServer } from './local-server';
import { MemoryStore } from './storage';
import { BACKUP_KEY, createInitialState, RETIRED_KEY, SAVE_KEY } from './save';

function server(): { store: MemoryStore; srv: LocalServer } {
  const store = new MemoryStore();
  return { store, srv: new LocalServer(store, buildConfig()) };
}

describe('LocalServer', () => {
  it('loads a fresh account and exposes the Sky Pillar view through the server boundary', async () => {
    const { srv } = server();
    await expect(srv.loadAccount()).resolves.toMatchObject({ ok: true });
    const view = await srv.getSkyPillar();
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    expect(view.value.floors).toHaveLength(180);
    expect(view.value.detail?.stages).toHaveLength(10);
    expect(view.value.unlocked).toBe(false);
  });

  it('retires a save older than MIN_SAVE_VERSION and starts a fresh account', async () => {
    const { store, srv } = server();
    const old = JSON.stringify({ version: 17, state: createInitialState(buildConfig()) });
    await store.write(SAVE_KEY, old);
    await store.write(BACKUP_KEY, old);
    const loaded = await srv.loadAccount();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.state.mail[0]?.id).toBe('mail_fresh_start');
    expect(await store.read(RETIRED_KEY)).toBe(old);
    expect(await store.read(BACKUP_KEY)).toBeNull();
    const imported = await srv.importSave(old);
    expect(imported.ok).toBe(false);
    if (!imported.ok) expect(imported.error).toBe('outdated_save');
  });

  it('seeds a fresh account on first load', async () => {
    const { srv } = server();
    const loaded = await srv.loadAccount();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.state.roster).toHaveLength(6);
    expect(Object.keys(loaded.value.power)).toHaveLength(6);
  });

  it('grants Wilds and currencies', async () => {
    const { srv } = server();
    await srv.loadAccount();
    const granted = await srv.grantWild('kyogre');
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;
    expect(granted.value.state.roster.some((w) => w.speciesId === 'kyogre')).toBe(true);
    const before = granted.value.state.currencies.gold;
    const rich = await srv.grantCurrency('gold');
    if (!rich.ok) return;
    expect(rich.value.state.currencies.gold).toBeGreaterThan(before);
  });

  it('rejects an unknown species and an unknown currency', async () => {
    const { srv } = server();
    await srv.loadAccount();
    expect((await srv.grantWild('nope')).ok).toBe(false);
    expect((await srv.grantCurrency('dogecoin')).ok).toBe(false);
  });

  it('levels a Wild and refuses past the stage cap', async () => {
    const { srv } = server();
    const load = await srv.loadAccount();
    if (!load.ok) return;
    const id = load.value.state.roster[0]?.id as string;
    for (let i = 0; i < 30; i++) {
      await srv.grantCurrency('candy');
      await srv.grantCurrency('gold');
    }
    const leveled = await srv.levelUp(id, 19);
    expect(leveled.ok).toBe(true);
    if (!leveled.ok) return;
    expect(leveled.value.state.roster.find((w) => w.id === id)?.level).toBe(20);
    const past = await srv.levelUp(id, 999);
    expect(past.ok).toBe(true);
    if (!past.ok) return;
    expect(past.value.state.roster.find((w) => w.id === id)?.level).toBe(60);
    const capped = await srv.levelUp(id, 1);
    expect(capped.ok).toBe(false);
    if (!capped.ok) expect(capped.error).toBe('at_level_cap');
  });

  it('evolves a Wild once it meets the requirements', async () => {
    const { srv } = server();
    const load = await srv.loadAccount();
    if (!load.ok) return;
    const id = load.value.state.roster[0]?.id as string;
    expect((await srv.evolve(id)).ok).toBe(false);
    await srv.levelUp(id, 19);
    const evolved = await srv.evolve(id);
    expect(evolved.ok).toBe(true);
    if (!evolved.ok) return;
    expect(evolved.value.state.roster.find((w) => w.id === id)?.evolutionStage).toBe(1);
  });

  it('auto-fills a legal squad and rejects duplicates', async () => {
    const { srv } = server();
    const auto = await srv.autoFormation('campaign');
    expect(auto.ok).toBe(true);
    if (!auto.ok) return;
    expect(auto.value.state.squads.campaign.filter(Boolean)).toHaveLength(6);
    const ids = auto.value.state.squads.campaign.filter((x): x is string => x !== null);
    const bad = await srv.saveSquad('campaign', [ids[0] as string, ids[0] as string, null, null, null, null], 'balanced');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBe('invalid_squad');
  });

  it('persists across server instances (reload)', async () => {
    const { store, srv } = server();
    const load = await srv.loadAccount();
    if (!load.ok) return;
    const id = load.value.state.roster[0]?.id as string;
    const leveled = await srv.levelUp(id, 10);
    if (!leveled.ok) return;
    const level = leveled.value.state.roster.find((w) => w.id === id)?.level;
    const reloaded = new LocalServer(store, buildConfig());
    const again = await reloaded.loadAccount();
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.state.roster.find((w) => w.id === id)?.level).toBe(level);
  });

  it('recovers from a corrupt primary using the backup', async () => {
    const { store, srv } = server();
    await srv.loadAccount();
    const good = await srv.levelUp('w1', 1);
    expect(good.ok).toBe(true);
    await store.write(SAVE_KEY, '{ corrupt');
    const recovered = new LocalServer(store, buildConfig());
    const load = await recovered.loadAccount();
    expect(load.ok).toBe(true);
  });

  it('fails clean when both primary and backup are corrupt', async () => {
    const store = new MemoryStore();
    await store.write(SAVE_KEY, '{ corrupt');
    const srv = new LocalServer(store, buildConfig());
    const load = await srv.loadAccount();
    expect(load.ok).toBe(false);
    if (!load.ok) expect(load.error).toBe('corrupt_save');
  });

  it('exports, imports and resets', async () => {
    const { srv } = server();
    await srv.loadAccount();
    await srv.grantWild('kyogre');
    const exported = await srv.exportSave();
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const reset = await srv.resetAccount();
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    expect(reset.value.state.roster).toHaveLength(6);
    const imported = await srv.importSave(exported.value);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value.state.roster.some((w) => w.speciesId === 'kyogre')).toBe(true);
  });
});
