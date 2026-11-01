import { describe, expect, it } from 'vitest';
import { equippedSheet } from './battle';
import { buildConfig } from './config';
import { buildEquipmentView } from './equipment-view';
import { createInitialState } from './save';
import {
  activateTitleAction,
  buildTitlesView,
  grantTitleCards,
  setTitleSlotAction,
  titleFoldFor,
} from './titles';

const NOW = Date.parse('2026-01-01T00:00:00Z');
const DAY = 86_400_000;

function makeState() {
  const config = buildConfig();
  config.now = () => NOW;
  const state = createInitialState(config);
  return { config, state };
}

describe('R8 titles from the source', () => {
  it('ships the source 102: 8 / 52 / 42 by slot, 85 permanent, 15 seven-day, 2 fourteen-day', () => {
    const { config } = makeState();
    expect(config.titles).toHaveLength(102);
    const bySlot = (slot: string) => config.titles.filter((title) => title.slot === slot).length;
    expect([bySlot('common'), bySlot('premium'), bySlot('rare')]).toEqual([8, 52, 42]);
    expect(config.titles.filter((title) => title.durationDays === null)).toHaveLength(85);
    expect(config.titles.filter((title) => title.durationDays === 7)).toHaveLength(15);
    expect(config.titles.filter((title) => title.durationDays === 14)).toHaveLength(2);
    // The 35 event titles climb 15 stages to +5.25%.
    const superb = config.titleById.get('601')!;
    expect(superb.stages).toHaveLength(15);
    expect(superb.stages[0]!.stats[0]).toMatchObject({ field: 'pAtkPct', base: 0.015 });
    expect(superb.stages[14]!.stats[0]).toMatchObject({ field: 'pAtkPct', base: 0.0525 });
  });

  it('starts with Starter Trainer owned and worn', () => {
    const { config, state } = makeState();
    expect(state.titles.owned['11']).toEqual({ stage: 1, expiresAt: null });
    expect(state.titles.equipped.common).toBe('11');
    expect(titleFoldFor(config, state)?.lines).toEqual([{ kind: 'percent', field: 'hpPct', base: 0.001, perLevel: 0 }]);
    const row = buildTitlesView(config, state, NOW).rows.find((entry) => entry.id === '11');
    expect(row?.action).toBeNull();
  });

  it('activates a title with its own card, wears it in a free slot and raises the sheet', () => {
    const { config, state } = makeState();
    const wild = state.roster[0]!;
    wild.level = 100;
    const before = equippedSheet(wild, config, state);
    if (!before) throw new Error('no sheet');

    const noCard = activateTitleAction(config, state, '1', NOW);
    expect(noCard.ok).toBe(false);
    if (!noCard.ok) expect(noCard.error).toBe('insufficient_items');

    const withCard = grantTitleCards(state, '1', 1);
    expect(buildTitlesView(config, withCard, NOW).rows.find((row) => row.id === '1')?.canAct).toBe(true);
    const activated = activateTitleAction(config, withCard, '1', NOW);
    expect(activated.ok).toBe(true);
    if (!activated.ok) return;
    expect(activated.value.titles.cards['1']).toBeUndefined();
    expect(activated.value.titles.owned['1']).toEqual({ stage: 1, expiresAt: null });
    expect(activated.value.titles.equipped.rare).toBe('1');

    const after = equippedSheet(wild, config, activated.value);
    if (!after) throw new Error('no sheet');
    expect(after.sheet.hp).toBeGreaterThan(before.sheet.hp);
    expect(after.sheet.pAtk).toBeGreaterThan(before.sheet.pAtk);
    const gear = buildEquipmentView({ config, state: activated.value, wild });
    expect(gear.power.layers.titles).toBeGreaterThan(0);

    const maxed = activateTitleAction(config, grantTitleCards(activated.value, '1', 1), '1', NOW);
    expect(maxed.ok).toBe(false);
    if (!maxed.ok) expect(maxed.error).toBe('at_level_cap');

    const cleared = setTitleSlotAction(config, activated.value, 'rare', null, NOW);
    expect(cleared.ok).toBe(true);
    if (cleared.ok) expect(cleared.value.titles.equipped.rare).toBeNull();
  });

  it('raises an event title a stage per card', () => {
    const { config, state } = makeState();
    let s = grantTitleCards(state, '601', 3);
    for (let i = 0; i < 3; i += 1) {
      const r = activateTitleAction(config, s, '601', NOW);
      if (!r.ok) throw new Error(r.message);
      s = r.value;
    }
    expect(s.titles.owned['601']?.stage).toBe(3);
    expect(titleFoldFor(config, s)?.lines).toContainEqual({ kind: 'percent', field: 'pAtkPct', base: 0.021, perLevel: 0 });
  });

  it('continues a timed title from its current expiry, and it lapses lazily', () => {
    const { config, state } = makeState();
    const first = activateTitleAction(config, grantTitleCards(state, '4001', 2), '4001', NOW);
    if (!first.ok) throw new Error(first.message);
    expect(first.value.titles.owned['4001']?.expiresAt).toBe(NOW + 7 * DAY);
    expect(first.value.titles.equipped.premium).toBe('4001');
    const continued = activateTitleAction(config, first.value, '4001', NOW + DAY);
    if (!continued.ok) throw new Error(continued.message);
    expect(continued.value.titles.owned['4001']?.expiresAt).toBe(NOW + 14 * DAY);
    expect(buildTitlesView(config, continued.value, NOW + 15 * DAY).rows.find((r) => r.id === '4001')?.owned).toBe(false);

    const wrongSlot = setTitleSlotAction(config, continued.value, 'common', '4001', NOW);
    expect(wrongSlot.ok).toBe(false);
  });

  it('takes the Beginner → Master Trainer cards from Hard Tower floors 5 / 135 / 400 / 500', () => {
    const { config } = makeState();
    const cards = config.tower.hard.filter((r) => r.titleCard).map((r) => [r.floor, r.titleCard]);
    expect(cards).toEqual([[5, '12'], [135, '13'], [400, '14'], [500, '15']]);
    expect(config.titleById.get('12')?.earnedBy).toEqual({ kind: 'hardTower', floor: 5 });
  });

  it('refuses titles the source grants without a card', () => {
    const { config, state } = makeState();
    const temple = activateTitleAction(config, state, '2001', NOW);
    expect(temple.ok).toBe(false);
    if (!temple.ok) expect(temple.error).toBe('resource_locked');
  });
});
