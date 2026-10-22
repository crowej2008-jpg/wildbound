import { describe, expect, it } from 'vitest';
import { equippedSheet } from './battle';
import { buildConfig } from './config';
import { buildEquipmentView } from './equipment-view';
import { createInitialState } from './save';
import {
  activateTitleAction,
  buildTitlesView,
  setTitleSlotAction,
  titleFoldFor,
} from './titles';

const NOW = Date.parse('2026-01-01T00:00:00Z');
const DAY = 86_400_000;

function makeState() {
  const config = buildConfig();
  config.now = () => NOW;
  const state = createInitialState(config);
  state.currencies.titleTicket = 200;
  return { config, state };
}

describe('M11.11 titles', () => {
  it('ships 85 permanent, 15 seven-day and 2 fourteen-day titles', () => {
    const { config } = makeState();
    expect(config.titles).toHaveLength(102);
    expect(config.titles.filter((title) => title.durationDays === null)).toHaveLength(85);
    expect(config.titles.filter((title) => title.durationDays === 7)).toHaveLength(15);
    expect(config.titles.filter((title) => title.durationDays === 14)).toHaveLength(2);
  });

  it('activates a title, auto-equips it and pays Title Tickets', () => {
    const { config, state } = makeState();
    const wild = state.roster[0]!;
    wild.level = 100;
    const before = equippedSheet(wild, config, state);
    if (!before) throw new Error('no sheet');
    const view = buildTitlesView(config, state, NOW);
    const row = view.rows.find((entry) => entry.id === 'trail-01');
    expect(row?.action).toBe('activate');
    expect(row?.canAct).toBe(true);

    const activated = activateTitleAction(config, state, 'trail-01', NOW);
    expect(activated.ok).toBe(true);
    if (!activated.ok) return;
    expect(activated.value.currencies.titleTicket).toBe(199);
    expect(activated.value.titles.owned['trail-01']).toEqual({ stage: 1, expiresAt: null });
    expect(activated.value.titles.equipped.common).toBe('trail-01');
    expect(titleFoldFor(config, activated.value)?.lines).toHaveLength(3);

    const after = equippedSheet(wild, config, activated.value);
    if (!after) throw new Error('no sheet');
    expect(after.sheet.hp).toBeGreaterThan(before.sheet.hp);
    expect(after.sheet.pAtk).toBeGreaterThan(before.sheet.pAtk);

    const gear = buildEquipmentView({ config, state: activated.value, wild });
    expect(gear.power.layers.titles).toBeGreaterThan(0);
    expect(gear.power.equipped).toBe(gear.power.base + gear.power.layers.titles);

    const viewAfter = buildTitlesView(config, activated.value, NOW);
    expect(viewAfter.slots[0]?.titleId).toBe('trail-01');
    expect(viewAfter.ownedCount).toBe(1);

    const cleared = setTitleSlotAction(config, activated.value, 'common', null, NOW);
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(titleFoldFor(config, cleared.value)).toBeUndefined();
  });

  it('gates titles on trainer level and locks guild/event rows', () => {
    const { config, state } = makeState();
    const blocked = activateTitleAction(config, state, 'trail-02', NOW);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toBe('resource_locked');

    const guild = activateTitleAction(config, state, 'guild-vanguard', NOW);
    expect(guild.ok).toBe(false);
    if (!guild.ok) expect(guild.error).toBe('resource_locked');

    const view = buildTitlesView(config, state, NOW);
    expect(view.rows.find((row) => row.id === 'guild-vanguard')?.lockedReason).toBe('guild');
    expect(view.rows.find((row) => row.id === 'event-festival')?.lockedReason).toBe('event');
  });

  it('extends a max-stage timed title from its current expiry', () => {
    const { config, state } = makeState();
    state.pvp.arena.bestCredits = 250;
    const first = activateTitleAction(config, state, 'arena-banner-01', NOW);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.titles.owned['arena-banner-01']?.expiresAt).toBe(NOW + 7 * DAY);
    expect(first.value.titles.equipped.premium).toBe('arena-banner-01');

    const continued = activateTitleAction(config, first.value, 'arena-banner-01', NOW + DAY);
    expect(continued.ok).toBe(true);
    if (!continued.ok) return;
    expect(continued.value.titles.owned['arena-banner-01']?.stage).toBe(1);
    expect(continued.value.titles.owned['arena-banner-01']?.expiresAt).toBe(NOW + 14 * DAY);
    expect(continued.value.currencies.titleTicket).toBe(184);

    const wrongSlot = setTitleSlotAction(config, continued.value, 'common', 'arena-banner-01', NOW);
    expect(wrongSlot.ok).toBe(false);
    if (!wrongSlot.ok) expect(wrongSlot.error).toBe('invalid_input');
  });

  it('applies percent-total title lines to the sheet', () => {
    const { config, state } = makeState();
    const wild = state.roster[0]!;
    wild.level = 100;
    state.profile.level = 20;
    const before = equippedSheet(wild, config, state);
    if (!before) throw new Error('no sheet');
    const activated = activateTitleAction(config, state, 'collector-01', NOW);
    expect(activated.ok).toBe(true);
    if (!activated.ok) return;
    expect(activated.value.titles.equipped.premium).toBe('collector-01');
    const after = equippedSheet(wild, config, activated.value);
    if (!after) throw new Error('no sheet');
    expect(after.sheet.hp).toBeGreaterThan(before.sheet.hp);
  });
});
