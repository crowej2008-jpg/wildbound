import { describe, expect, it } from 'vitest';
import { grantHeldItem, setWildStars } from './testing';
import { emptyLoadout, mulberry32 } from '@wildbound/engine';
import { buildConfig } from './config';
import { consumeCharms, grantRelic, levelRelicAction } from './equipment';
import { equippedSheet } from './battle';
import { LocalServer } from './local-server';
import { createInitialState } from './save';
import { MemoryStore } from './storage';

/**
 * M7 equipment actions + M11.0 display view. The view is what the Wild screen
 * renders, so these tests pin both the state transition and the Power delta the
 * player sees after equipping each layer.
 */

const START = Date.parse('2026-01-01T00:00:00Z');

function makeServer() {
  const config = buildConfig();
  config.now = () => START;
  return new LocalServer(new MemoryStore(), config);
}

async function supremeStriker() {
  const srv = makeServer();
  const load = await srv.loadAccount();
  if (!load.ok) throw new Error('load failed');
  await srv.grantCurrency('gold', 2_000_000);
  await srv.grantCurrency('candy', 500_000);
  await srv.grantCurrency('shard', 50_000);
  await srv.grantCurrency('stone', 100);
  await srv.grantCurrency('potentialShard', 10_000);
  await srv.grantCurrency('heldItemShard', 5_000);
  const granted = await srv.grantWild('mimikyu');
  if (!granted.ok) throw new Error(`grant failed: ${granted.error}`);
  const fodder = await srv.grantWild('mimikyu');
  if (!fodder.ok) throw new Error(`fodder grant failed: ${fodder.error}`);
  const wild = granted.value.state.roster.find((w) => w.speciesId === 'mimikyu');
  if (!wild) throw new Error('no mimikyu');
  const duplicate = fodder.value.state.roster.find((w) => w.speciesId === 'mimikyu' && w.id !== wild.id);
  if (!duplicate) throw new Error('no duplicate mimikyu');
  return { srv, wildId: wild.id, duplicateId: duplicate.id };
}

describe('M11.0 equipment view and actions', () => {
  it('shows the base sheet, and equipping a held item raises Power', async () => {
    const { srv, wildId } = await supremeStriker();
    const before = await srv.getEquipment(wildId);
    if (!before.ok) throw new Error(before.message);
    expect(before.value.power.base).toBeGreaterThan(0);
    expect(before.value.power.equipped).toBe(before.value.power.base);
    expect(before.value.unlocks.relic).toBe(true);

    const relic = before.value.relics.find((r) => r.className === 'striker');
    if (!relic) throw new Error('no striker relic in starting equipment');
    const equipped = await srv.equipRelic(wildId, relic.instanceId);
    expect(equipped.ok).toBe(true);

    const after = await srv.getEquipment(wildId);
    if (!after.ok) throw new Error(after.message);
    expect(after.value.loadout.relic).toBe(relic.instanceId);
    expect(after.value.power.equipped).toBeGreaterThan(after.value.power.base);
    expect(after.value.power.layers.relic).toBeGreaterThan(0);
  });

  it('levels a held item from 0 on the source shard table (20 a level to 30), cap 200', async () => {
    const { srv, wildId } = await supremeStriker();
    const view = await srv.getEquipment(wildId);
    if (!view.ok) throw new Error(view.message);
    const relic = view.value.relics.find((r) => r.className === 'striker');
    if (!relic) throw new Error('no striker relic');
    expect(relic.level).toBe(0);
    expect(relic.maxLevel).toBe(200);
    expect(relic.levelCost).toBe(20);
    await srv.equipRelic(wildId, relic.instanceId);

    const load = await srv.loadAccount();
    if (!load.ok) throw new Error('reload failed');
    const shardsBefore = load.value.state.currencies.heldItemShard;
    const levelled = await srv.levelRelic(relic.instanceId);
    expect(levelled.ok).toBe(true);
    if (!levelled.ok) return;
    const now = levelled.value.state.equipment.relics.find((r) => r.id === relic.instanceId);
    expect(now?.level).toBe(1);
    expect(levelled.value.state.currencies.heldItemShard).toBe(shardsBefore - 20);
  });

  it('gates level 31 on resonance 250 and stops at 200', () => {
    const config = buildConfig();
    const state = createInitialState(config);
    state.currencies.heldItemShard = 100_000;
    const relic = state.equipment.relics[0]!;
    relic.level = 30;
    const gated = levelRelicAction(config, state, relic.id);
    expect(gated.ok).toBe(false);
    if (!gated.ok) expect(gated.error).toBe('resource_locked');
    state.pve.linkCrystal.level = 250;
    expect(levelRelicAction(config, state, relic.id).ok).toBe(true);
    relic.level = 200;
    state.pve.linkCrystal.level = 600;
    const capped = levelRelicAction(config, state, relic.id);
    expect(capped.ok).toBe(false);
    if (!capped.ok) expect(capped.error).toBe('at_level_cap');
  });

  it('refines a worn Mythic: first roll free, then Held Item Resetters on the ladder, keep or drop', async () => {
    const { srv, wildId } = await supremeStriker();
    const config = buildConfig();
    const id = await grantHeldItem(srv, config, '105101', 3);
    const notWorn = await srv.refineRelic(id, 0, 1);
    expect(notWorn.ok).toBe(false);
    expect((await srv.equipRelic(wildId, id)).ok).toBe(true);

    const view = await srv.getEquipment(wildId);
    if (!view.ok) throw new Error(view.message);
    const item = view.value.relics.find((r) => r.instanceId === id)!;
    expect(item.lines).toHaveLength(6);
    expect(item.refineSlots).toBe(3);
    expect(item.refineCost).toBe(0);
    expect(item.skill?.name).toBe('Shell Bell II');

    const rolled = await srv.refineRelic(id, 0, 42);
    expect(rolled.ok).toBe(true);
    if (!rolled.ok) return;
    const pending = rolled.value.state.equipment.relics.find((r) => r.id === id)!.pending;
    expect(pending?.slot).toBe(0);
    // a second roll waits for keep/drop
    expect((await srv.refineRelic(id, 0, 43)).ok).toBe(false);
    const kept = await srv.settleRefine(id, true);
    expect(kept.ok).toBe(true);
    if (!kept.ok) return;
    const line = kept.value.state.equipment.relics.find((r) => r.id === id)!.lines[0]!;
    expect(line.index).toBe(pending!.index);
    expect(line.value).toBe(pending!.value);

    // the second refine costs 1 Held Item Resetter
    const broke = await srv.refineRelic(id, 0, 44);
    expect(broke.ok).toBe(false);
    if (!broke.ok) expect(broke.error).toBe('insufficient_items');
    await srv.grantCurrency('resetterShard', 40);
    expect((await srv.compoundResetters(2)).ok).toBe(true);
    const paid = await srv.refineRelic(id, 0, 44);
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    expect(paid.value.state.currencies.heldItemResetter).toBe(1);
    expect(paid.value.state.currencies.resetterShard).toBe(0);
    expect((await srv.settleRefine(id, false)).ok).toBe(true);
    expect((await srv.settleRefine(id, false)).ok).toBe(false);
  });

  it('has nothing to refine on a Rare', async () => {
    const { srv, wildId } = await supremeStriker();
    const view = await srv.getEquipment(wildId);
    if (!view.ok) throw new Error(view.message);
    const rare = view.value.relics.find((r) => r.className === 'striker')!;
    expect(rare.refineCost).toBeNull();
    await srv.equipRelic(wildId, rare.instanceId);
    const refused = await srv.refineRelic(rare.instanceId, 0, 1);
    expect(refused.ok).toBe(false);
  });

  it('dismantles only unworn, unlocked items, paying back their levels', async () => {
    const { srv, wildId } = await supremeStriker();
    const config = buildConfig();
    const id = await grantHeldItem(srv, config, '105101', 5);
    expect((await srv.levelRelic(id)).ok).toBe(true);
    expect((await srv.lockRelic(id)).ok).toBe(true);
    expect((await srv.dismantleRelics([id])).ok).toBe(false);
    expect((await srv.lockRelic(id)).ok).toBe(true);
    await srv.equipRelic(wildId, id);
    const worn = await srv.dismantleRelics([id]);
    expect(worn.ok).toBe(false);
    if (!worn.ok) expect(worn.error).toBe('in_use');
    await srv.equipRelic(wildId, null);

    const load = await srv.loadAccount();
    if (!load.ok) throw new Error('reload failed');
    const before = load.value.state.currencies.heldItemShard;
    const done = await srv.dismantleRelics([id]);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.value.state.equipment.relics.some((r) => r.id === id)).toBe(false);
    expect(done.value.state.currencies.heldItemShard).toBe(before + 20 + 20);
  });

  it('equips two Berry slots, stars with copies + Essence, and dismantles a spare', async () => {
    const { srv, wildId } = await supremeStriker();
    // R1: a Supreme starts at 5★, already past the orb (3★) and Berry (4★) gates.
    await srv.grantCurrency('berryEssence', 1_000);
    const view = await srv.getEquipment(wildId);
    if (!view.ok) throw new Error(view.message);
    expect(view.value.unlocks.charms).toBe(true);
    expect(view.value.charmSlots).toBe(2);
    const ember = view.value.charms.find((c) => c.defId === 'charm-emberfruit');
    if (!ember) throw new Error('no starting berry');
    expect(ember.stars).toBe(1);
    expect(ember.upgradeEssence).toBe(20);

    await srv.equipCharm(wildId, 0, ember.defId);
    const after = await srv.getEquipment(wildId);
    if (!after.ok) throw new Error(after.message);
    expect(after.value.loadout.charms[0]).toBe(ember.defId);
    expect(after.value.power.layers.charms).toBeGreaterThan(0);

    const sun = after.value.charms.find((c) => c.defId === 'charm-sunpetal-berry');
    if (!sun) throw new Error('no common berry');
    await srv.equipCharm(wildId, 1, sun.defId);
    const both = await srv.getEquipment(wildId);
    if (!both.ok) throw new Error(both.message);
    expect(both.value.loadout.charms).toEqual([ember.defId, sun.defId]);
    expect(both.value.power.layers.charms).toBeGreaterThan(after.value.power.layers.charms);

    const starred = await srv.upgradeCharm(ember.defId);
    expect(starred.ok).toBe(true);
    if (!starred.ok) return;
    expect(starred.value.state.equipment.charmStars[ember.defId]).toBe(2);
    expect(starred.value.state.equipment.charms[ember.defId]).toBe(1);
    expect(starred.value.state.currencies.berryEssence).toBe(980);
    expect((await srv.dismantleCharm(ember.defId)).ok).toBe(false);

    const mist = both.value.charms.find((c) => c.defId === 'charm-mistbud-berry');
    if (!mist) throw new Error('no spare berry');
    const dismantled = await srv.dismantleCharm(mist.defId);
    expect(dismantled.ok).toBe(true);
    if (!dismantled.ok) return;
    expect(dismantled.value.state.equipment.charms[mist.defId]).toBe(mist.count - 1);
    expect(dismantled.value.state.currencies.berryEssence).toBe(985);
  });

  it('spends one Berry copy for each occupied slot in a real battle', () => {
    const config = buildConfig();
    const state = createInitialState(config);
    const wildId = state.roster[0]!.id;
    state.loadouts[wildId] = {
      ...emptyLoadout(config.equipment.tuning),
      charms: ['charm-sunpetal-berry', 'charm-sunpetal-berry'],
    };
    state.equipment.charms['charm-sunpetal-berry'] = 3;

    const after = consumeCharms(state, [wildId]);

    expect(after.equipment.charms['charm-sunpetal-berry']).toBe(1);
  });

  it('equips two Soul-heart pieces, shows the 2-piece bonus, and stars one up', async () => {
    const { srv, wildId } = await supremeStriker();
    await setWildStars(srv, wildId, 10);
    await srv.grantCurrency('soulHeartExp', 1_000);
    const view = await srv.getEquipment(wildId);
    if (!view.ok) throw new Error(view.message);
    const [first, second] = view.value.cores;
    if (!first || !second) throw new Error('no starting cores');
    await srv.equipCore(wildId, first.socket, first.instanceId);
    await srv.equipCore(wildId, second.socket, second.instanceId);
    const before = await srv.getEquipment(wildId);
    if (!before.ok) throw new Error(before.message);
    const common = before.value.coreSets.find((set) => set.id === 'coreset-common');
    expect(common?.equipped).toBe(2);
    expect(common?.bonuses.find((bonus) => bonus.pieces === 2)?.active).toBe(true);
    const expBefore = before.value.soulHeartExp;
    const cost = first.starCost;
    if (cost === null) throw new Error('first core is already max');

    const starred = await srv.starUpCore(first.instanceId);
    expect(starred.ok).toBe(true);
    if (!starred.ok) return;
    expect(starred.value.state.equipment.cores.find((c) => c.id === first.instanceId)?.stars).toBe(first.stars + 1);
    expect(starred.value.state.currencies.soulHeartExp).toBe(expBefore - cost);

    const after = await srv.getEquipment(wildId);
    if (!after.ok) throw new Error(after.message);
    expect(after.value.sheetEquipped.spiritDef ?? 0).toBeGreaterThan(before.value.sheetEquipped.spiritDef ?? 0);
  });
});

describe('R5 held-item data is the source', () => {
  const config = buildConfig();
  const { relics, held } = config.equipment;

  it('has the 75 items at 9 / 9 / 12 / 18 / 27 per quality, class-locked, with tier-I/II skills from Legendary', () => {
    expect(relics).toHaveLength(75);
    const count = (tier: string) => relics.filter((r) => r.tier === tier).length;
    expect([count('rare'), count('epic'), count('legendary'), count('supreme'), count('mythic')]).toEqual([9, 9, 12, 18, 27]);
    expect(relics.filter((r) => r.tier === 'mythic').every((r) => r.lineCount === 6 && r.refineSlots === 3 && r.dismantle === 20)).toBe(true);
    expect(relics.filter((r) => r.tier === 'supreme').every((r) => r.lineCount === 5 && r.refineSlots === 2)).toBe(true);
    expect(relics.filter((r) => r.tier === 'rare' || r.tier === 'epic').every((r) => r.skill === null)).toBe(true);
    expect(relics.find((r) => r.id === '105107')).toMatchObject({ name: 'Choice Band', className: 'striker' });
    expect(relics.find((r) => r.id === '105208')?.skill?.text).toBe('Restore backline HP every turn, healing amount is 5% of current HP');
  });

  it('prices 7,350 shards to Lv 200 and 110 Resetters for the owner ladder of 21 refines', () => {
    expect(held.levelCost.reduce((a, b) => a + b, 0)).toBe(7350);
    expect(held.refineLadder).toHaveLength(21);
    expect(held.refineLadder[0]).toBe(0);
    expect(held.refineLadder.reduce((a, b) => a + b, 0)).toBe(110);
    expect(held.resetterCompound).toBe(20);
  });

  it('has 31 lines per quality pool', () => {
    for (const pool of [11, 12, 13, 14, 15]) expect(held.linePool.filter((r) => r.pool === pool)).toHaveLength(31);
  });
});

describe('E2 held-item skills reach the battle', () => {
  it('every Legendary+ skill is active in battle', () => {
    const config = buildConfig();
    const skills = config.equipment.relics.flatMap((r) => (r.skill ? [r.skill] : []));
    expect(skills).toHaveLength(57);
    expect(skills.every((s) => s.active)).toBe(true);
  });

  it("a worn Light Clay puts its turn-start heal into the wearer's battle spec", async () => {
    const config = buildConfig();
    const state = createInitialState(config);
    const guardianSpecies = [...config.species.values()].find((s) => s.className === 'guardian' && s.tier === 'mythic');
    if (!guardianSpecies) throw new Error('no mythic guardian');
    const granted = grantRelic(config, state, '105208', mulberry32(1));
    if (!granted.ok) throw new Error(granted.message);
    const next = granted.value;
    const wild = { id: 'wx', speciesId: guardianSpecies.id, level: 1, stars: guardianSpecies.stars[0]!.star, locked: false, acquiredAt: 0 };
    next.roster.push(wild as (typeof next.roster)[number]);
    next.loadouts[wild.id] = { ...emptyLoadout(config.equipment.tuning), relic: `re${state.equipment.nextSeq}` };
    const equipped = equippedSheet(wild as (typeof next.roster)[number], config, next);
    expect(equipped?.triggers.some((t) => t.on === 'turnStart')).toBe(true);
  });
});
