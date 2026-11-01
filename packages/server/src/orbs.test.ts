import { describe, expect, it } from 'vitest';
import { buildConfig } from './config';
import { LocalServer } from './local-server';
import { MemoryStore } from './storage';
import { setWildStars } from './testing';

/** R3: the source's orbs through the server boundary (kb/orbs.md, the owner's wiki). */

async function setup(playerLevel = 60) {
  const config = buildConfig();
  config.now = () => Date.UTC(2026, 10, 1);
  const srv = new LocalServer(new MemoryStore(), config);
  await srv.loadAccount();
  await srv.grantCurrency('gold', 10_000_000);
  const exported = await srv.exportSave();
  if (!exported.ok) throw new Error(exported.message);
  const save = JSON.parse(exported.value);
  save.state.profile.level = playerLevel;
  await srv.importSave(JSON.stringify(save));
  const granted = await srv.grantWild('darkrai');
  if (!granted.ok) throw new Error(granted.message);
  const wildId = granted.value.state.roster.find((w) => w.speciesId === 'darkrai')!.id;
  await setWildStars(srv, wildId, 9);
  return { config, srv, wildId };
}

async function orbIds(srv: LocalServer): Promise<string[]> {
  const s = await srv.loadAccount();
  if (!s.ok) throw new Error('load failed');
  return s.value.state.equipment.orbs.map((o) => o.id);
}

describe('R3 orbs', () => {
  it('the system opens at player Lv 50; sockets at 9★; row 2 at Lv 240', async () => {
    const low = await setup(49);
    await low.srv.grantOrb('sharp', 'red', 1);
    const [id] = await orbIds(low.srv);
    expect((await low.srv.equipOrb(low.wildId, 0, id!)).ok).toBe(false);

    const { srv, wildId } = await setup();
    await srv.grantOrb('sharp', 'red', 1);
    const [orb] = await orbIds(srv);
    expect((await srv.equipOrb(wildId, 4, orb!)).ok).toBe(false); // row 2 needs Lv 240
    const socketed = await srv.equipOrb(wildId, 0, orb!);
    if (!socketed.ok) throw new Error(socketed.message);
    const view = await srv.getOrbs(wildId);
    if (!view.ok) throw new Error(view.message);
    expect(view.value.sockets[0]!.orbId).toBe(orb);
    expect(view.value.sockets[1]!.family).toBe('defensive');
  });

  it('socket families: an offensive orb does not fit a defensive-only socket', async () => {
    const { srv, wildId } = await setup();
    await srv.grantOrb('leisure', 'red', 1);
    const [orb] = await orbIds(srv);
    expect((await srv.equipOrb(wildId, 1, orb!)).ok).toBe(false);
    expect((await srv.equipOrb(wildId, 2, orb!)).ok).toBe(true);
  });

  it('a level takes two free same-level copies plus Gold; Quick Upgrade fuses lower ones three to one', async () => {
    const { srv } = await setup();
    for (let i = 0; i < 3; i += 1) await srv.grantOrb('sharp', 'red', 1);
    const [target] = await orbIds(srv);
    const levelled = await srv.levelOrb(target!);
    if (!levelled.ok) throw new Error(levelled.message);
    const s = levelled.value.state;
    expect(s.equipment.orbs).toHaveLength(1);
    expect(s.equipment.orbs[0]!.level).toBe(2);

    // +2 → +3 needs two +2 copies: none, but six +1s fuse into two +2s.
    for (let i = 0; i < 6; i += 1) await srv.grantOrb('sharp', 'red', 1);
    expect((await srv.levelOrb(target!)).ok).toBe(false);
    const before = await srv.loadAccount();
    const quick = await srv.levelOrb(target!, true);
    if (!quick.ok) throw new Error(quick.message);
    expect(quick.value.state.equipment.orbs).toHaveLength(1);
    expect(quick.value.state.equipment.orbs[0]!.level).toBe(3);
    // Gold: two fusions at +1 → +2 (10,000 each) + the level itself (30,000).
    expect(quick.value.state.currencies.gold).toBe((before.ok ? before.value.state.currencies.gold : 0) - 50_000);
  });

  it('a full set turns on at its lowest orb level and changes the sheet', async () => {
    const { srv, wildId } = await setup();
    for (const kind of ['sharp', 'placating', 'mystique']) await srv.grantOrb(kind, 'red', 3);
    const ids = await orbIds(srv);
    // DMG Down: sockets 0 (either), 1 (defensive), 2 (offensive — no), 3 (either).
    await srv.equipOrb(wildId, 0, ids[0]!);
    await srv.equipOrb(wildId, 1, ids[1]!);
    await srv.equipOrb(wildId, 3, ids[2]!);
    const view = await srv.getOrbs(wildId);
    if (!view.ok) throw new Error(view.message);
    expect(view.value.sets.map((s) => s.name)).toEqual(['DMG Down']);
    expect(view.value.sets[0]!.tiers.map((t) => t.active)).toEqual([true, false, false, false]);
  });

  it('dismantles unlocked, unsocketed orbs for Orb Essence; red cannot be dismantled', async () => {
    const { srv } = await setup();
    await srv.grantOrb('sharp', 'orange', 2);
    await srv.grantOrb('sharp', 'red', 1);
    const [orange, red] = await orbIds(srv);
    expect((await srv.dismantleOrbs([red!])).ok).toBe(false);
    await srv.lockOrb(orange!);
    expect((await srv.dismantleOrbs([orange!])).ok).toBe(false);
    await srv.lockOrb(orange!);
    const done = await srv.dismantleOrbs([orange!]);
    if (!done.ok) throw new Error(done.message);
    expect(done.value.state.currencies.orbEssence).toBe(230);
  });
});
