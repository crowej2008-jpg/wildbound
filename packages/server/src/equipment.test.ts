import { describe, expect, it } from 'vitest';
import { buildConfig } from './config';
import { LocalServer } from './local-server';
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

  it('levels an equipped held item and charges the authored cost', async () => {
    const { srv, wildId } = await supremeStriker();
    const view = await srv.getEquipment(wildId);
    if (!view.ok) throw new Error(view.message);
    const relic = view.value.relics.find((r) => r.className === 'striker');
    if (!relic) throw new Error('no striker relic');
    await srv.equipRelic(wildId, relic.instanceId);

    const load = await srv.loadAccount();
    if (!load.ok) throw new Error('reload failed');
    const goldBefore = load.value.state.currencies.gold;
    const levelled = await srv.levelRelic(relic.instanceId);
    expect(levelled.ok).toBe(true);
    if (!levelled.ok) return;
    const now = levelled.value.state.equipment.relics.find((r) => r.id === relic.instanceId);
    expect(now?.level).toBe(relic.level + 1);
    expect(levelled.value.state.currencies.gold).toBeLessThan(goldBefore);
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

  it('unlocks berries at the star gate and folds an equipped berry into Power', async () => {
    const { srv, wildId } = await supremeStriker();
    for (let i = 0; i < 4; i++) {
      const up = await srv.starUp(wildId, 1);
      if (!up.ok) throw new Error(up.message);
    }
    const view = await srv.getEquipment(wildId);
    if (!view.ok) throw new Error(view.message);
    expect(view.value.unlocks.charms).toBe(true);
    const charm = view.value.charms.find((c) => c.count > 0);
    if (!charm) throw new Error('no starting berry');
    const equipped = await srv.equipCharm(wildId, charm.defId);
    expect(equipped.ok).toBe(true);

    const after = await srv.getEquipment(wildId);
    if (!after.ok) throw new Error(after.message);
    expect(after.value.loadout.charm).toBe(charm.defId);
    expect(after.value.power.layers.charms).toBeGreaterThan(0);
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
