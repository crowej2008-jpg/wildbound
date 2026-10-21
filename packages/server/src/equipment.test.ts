import { describe, expect, it } from 'vitest';
import { emptyLoadout } from '@wildbound/engine';
import { buildConfig } from './config';
import { consumeCharms, levelRelicAction, levelRuneAction } from './equipment';
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

  it('levels an equipped held item to 60 and charges Held Item Shards', async () => {
    const { srv, wildId } = await supremeStriker();
    const view = await srv.getEquipment(wildId);
    if (!view.ok) throw new Error(view.message);
    const relic = view.value.relics.find((r) => r.className === 'striker');
    if (!relic) throw new Error('no striker relic');
    expect(relic.maxLevel).toBe(60);
    await srv.equipRelic(wildId, relic.instanceId);

    const load = await srv.loadAccount();
    if (!load.ok) throw new Error('reload failed');
    const shardsBefore = load.value.state.currencies.heldItemShard;
    const levelled = await srv.levelRelic(relic.instanceId);
    expect(levelled.ok).toBe(true);
    if (!levelled.ok) return;
    const now = levelled.value.state.equipment.relics.find((r) => r.id === relic.instanceId);
    expect(now?.level).toBe(relic.level + 1);
    expect(levelled.value.state.currencies.heldItemShard).toBe(shardsBefore - 5);
  });

  it('refines a held item with gold + Held Item Shards', async () => {
    const { srv, wildId } = await supremeStriker();
    const view = await srv.getEquipment(wildId);
    if (!view.ok) throw new Error(view.message);
    const relic = view.value.relics.find((r) => r.className === 'striker');
    if (!relic) throw new Error('no striker relic');
    const load = await srv.loadAccount();
    if (!load.ok) throw new Error('reload failed');
    const goldBefore = load.value.state.currencies.gold;
    const shardsBefore = load.value.state.currencies.heldItemShard;

    const refined = await srv.refineRelic(relic.instanceId);
    expect(refined.ok).toBe(true);
    if (!refined.ok) return;
    const now = refined.value.state.equipment.relics.find((r) => r.id === relic.instanceId);
    expect(now?.refine).toBe(relic.refine + 1);
    expect(refined.value.state.currencies.gold).toBe(goldBefore - 800);
    expect(refined.value.state.currencies.heldItemShard).toBe(shardsBefore - 10);
  });

  it('stops a Held Item at its level cap', () => {
    const config = buildConfig();
    const state = createInitialState(config);
    const relic = state.equipment.relics[0]!;
    relic.level = 60;
    const result = levelRelicAction(config, state, relic.id);
    expect(result.ok).toBe(false);
  });

  it('unlocks orbs at the star gate and folds their lines into Power', async () => {
    const { srv, wildId } = await supremeStriker();
    for (let i = 0; i < 3; i++) {
      const up = await srv.starUp(wildId, 1);
      if (!up.ok) throw new Error(up.message);
    }
    const view = await srv.getEquipment(wildId);
    if (!view.ok) throw new Error(view.message);
    expect(view.value.unlocks.runes).toBe(true);
    const rune = view.value.runes[0];
    if (!rune) throw new Error('no starting rune');
    const equipped = await srv.equipRune(wildId, 0, rune.instanceId);
    expect(equipped.ok).toBe(true);

    const after = await srv.getEquipment(wildId);
    if (!after.ok) throw new Error(after.message);
    expect(after.value.loadout.runes[0]).toBe(rune.instanceId);
    expect(after.value.power.layers.runes).toBeGreaterThan(0);
  });

  it('equips two Berry slots, stars with copies + Essence, and dismantles a spare', async () => {
    const { srv, wildId } = await supremeStriker();
    for (let i = 0; i < 4; i++) {
      const up = await srv.starUp(wildId, 1);
      if (!up.ok) throw new Error(up.message);
    }
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

  it('levels an equipped orb with Orb Essence and raises its Power contribution', async () => {
    const { srv, wildId } = await supremeStriker();
    for (let i = 0; i < 3; i++) {
      const up = await srv.starUp(wildId, 1);
      if (!up.ok) throw new Error(up.message);
    }
    await srv.grantCurrency('orbEssence', 1_000);
    const view = await srv.getEquipment(wildId);
    if (!view.ok) throw new Error(view.message);
    const rune = view.value.runes.find((r) => r.levelCost !== null);
    if (!rune || !rune.levelCost) throw new Error('no levellable orb');
    await srv.equipRune(wildId, 0, rune.instanceId);
    const before = await srv.getEquipment(wildId);
    if (!before.ok) throw new Error(before.message);
    const essenceBefore = before.value.orbEssence;

    const levelled = await srv.levelRune(rune.instanceId, true);
    expect(levelled.ok).toBe(true);
    if (!levelled.ok) return;
    expect(levelled.value.state.equipment.runes.find((r) => r.id === rune.instanceId)?.level).toBe(rune.level + 1);
    expect(levelled.value.state.currencies.orbEssence).toBe(essenceBefore - rune.levelCost.essence);

    const after = await srv.getEquipment(wildId);
    if (!after.ok) throw new Error(after.message);
    expect(after.value.power.layers.runes).toBeGreaterThan(before.value.power.layers.runes);
  });

  it('levels an orb by consuming two same-level duplicates', () => {
    const config = buildConfig();
    const base = createInitialState(config);
    const target = base.equipment.runes.find((r) => r.defId === 'rune-verdant-spark');
    if (!target) throw new Error('no target rune');
    const state = {
      ...base,
      currencies: { ...base.currencies, gold: 1_000_000 },
      equipment: {
        ...base.equipment,
        runes: [
          ...base.equipment.runes,
          { id: 'dup-a', defId: target.defId, level: target.level },
          { id: 'dup-b', defId: target.defId, level: target.level },
        ],
      },
    };

    const result = levelRuneAction(config, state, target.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.equipment.runes.find((r) => r.id === target.id)?.level).toBe(target.level + 1);
    expect(result.value.equipment.runes.some((r) => r.id === 'dup-a' || r.id === 'dup-b')).toBe(false);
  });

  it('equips two Soul-heart pieces, shows the 2-piece bonus, and stars one up', async () => {
    const { srv, wildId } = await supremeStriker();
    for (let i = 0; i < 9; i++) {
      const up = await srv.starUp(wildId, 1);
      if (!up.ok) throw new Error(up.message);
    }
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

  it('unlocks Potential, eats a duplicate, and refunds the shard ladder on reset', async () => {
    const { srv, wildId, duplicateId } = await supremeStriker();
    const view = await srv.getEquipment(wildId);
    if (!view.ok) throw new Error(view.message);
    expect(view.value.unlocks.talents).toBe(true);
    expect(view.value.fodderCount).toBe(1);
    const tree = view.value.trees.find((tr) => tr.className === 'striker');
    if (!tree) throw new Error('no striker tree');
    const chosen = await srv.chooseTalentTree(wildId, tree.id);
    expect(chosen.ok).toBe(true);

    const before = await srv.loadAccount();
    if (!before.ok) throw new Error('reload failed');
    const shardsBefore = before.value.state.currencies.potentialShard;
    const rosterBefore = before.value.state.roster.length;

    const allocated = await srv.allocateTalent(wildId, 0, 0);
    expect(allocated.ok).toBe(true);
    if (!allocated.ok) return;
    expect(allocated.value.state.currencies.potentialShard).toBe(shardsBefore - view.value.costs.talentShardBase);
    expect(allocated.value.state.roster).toHaveLength(rosterBefore - 1);
    expect(allocated.value.state.roster.some((w) => w.id === duplicateId)).toBe(false);

    const after = await srv.getEquipment(wildId);
    if (!after.ok) throw new Error(after.message);
    expect(after.value.loadout.treeId).toBe(tree.id);
    expect(after.value.loadout.talents[0]).toBe(0);
    expect(after.value.power.layers.talents).toBeGreaterThan(0);
    expect(after.value.fodderCount).toBe(0);
    expect(after.value.talentResetRefund).toBe(view.value.costs.talentShardBase);

    const reset = await srv.resetTalents(wildId);
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    expect(reset.value.state.currencies.potentialShard).toBe(shardsBefore);
    expect(reset.value.state.roster).toHaveLength(rosterBefore - 1);
    expect(reset.value.state.loadouts[wildId]?.treeId ?? null).toBe(null);
  });

  it('refuses to feed a locked duplicate to Potential', async () => {
    const { srv, wildId, duplicateId } = await supremeStriker();
    const view = await srv.getEquipment(wildId);
    if (!view.ok) throw new Error(view.message);
    const tree = view.value.trees.find((tr) => tr.className === 'striker');
    if (!tree) throw new Error('no striker tree');
    await srv.chooseTalentTree(wildId, tree.id);
    await srv.toggleLock(duplicateId);

    const blocked = await srv.allocateTalent(wildId, 0, 0);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.error).toBe('insufficient_items');

    await srv.toggleLock(duplicateId);
    const allowed = await srv.allocateTalent(wildId, 0, 0);
    expect(allowed.ok).toBe(true);
  });
});
