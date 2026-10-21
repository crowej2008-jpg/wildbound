import { describe, expect, it } from 'vitest';
import { equippedSheet } from './battle';
import { buildConfig } from './config';
import {
  buildResonanceView,
  resonanceUnlockCost,
  setResonanceSlotAction,
  unlockResonanceSlotAction,
} from './resonance';
import { createInitialState } from './save';

const START = Date.parse('2026-01-01T00:00:00Z');

function makeState() {
  const config = buildConfig();
  config.now = () => START;
  return { config, state: createInitialState(config) };
}

describe('M11.9 resonance', () => {
  it('opens with two slots and prices the rest in Resonation Shards', () => {
    const { config, state } = makeState();
    const view = buildResonanceView(config, state);
    expect(view.slots).toBe(6);
    expect(view.openSlots).toBe(2);
    expect(view.unlocked).toBe(2);
    expect(view.entries.map((e) => e.unlocked)).toEqual([true, true, false, false, false, false]);
    expect(view.nextUnlockCost).toBe(50);
    expect(resonanceUnlockCost(2, config.collection)).toBe(50);
    expect(resonanceUnlockCost(5, config.collection)).toBe(200);

    state.currencies.resonationShard = 100;
    const opened = unlockResonanceSlotAction(config, state);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value.resonance.unlocked).toBe(3);
    expect(opened.value.currencies.resonationShard).toBe(50);
    expect(buildResonanceView(config, opened.value).nextUnlockCost).toBe(100);

    state.resonance.unlocked = 6;
    const capped = unlockResonanceSlotAction(config, state);
    expect(capped.ok).toBe(false);
    if (!capped.ok) expect(capped.error).toBe('at_level_cap');
  });

  it('shares the Link Crystal level with a slotted Wild and moves it between slots', () => {
    const { config, state } = makeState();
    state.pve.linkCrystal = { unlocked: true, level: 100 };
    const wild = state.roster[0]!;
    const before = equippedSheet(wild, config, state);
    if (!before) throw new Error('no sheet');

    const assigned = setResonanceSlotAction(config, state, 0, wild.id);
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    const after = equippedSheet(wild, config, assigned.value);
    if (!after) throw new Error('no sheet');
    expect(after.sheet.pAtk).toBeGreaterThan(before.sheet.pAtk);
    expect(after.sheet.hp).toBeGreaterThan(before.sheet.hp);

    const view = buildResonanceView(config, assigned.value);
    expect(view.entries[0]?.wildId).toBe(wild.id);
    expect(view.entries[0]?.wildName).toBeTruthy();
    expect(view.entries[0]?.bonusText.some((line) => line.includes('P.ATK +100'))).toBe(true);

    const moved = setResonanceSlotAction(config, assigned.value, 1, wild.id);
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.value.resonance.slots[0]).toBeNull();
    expect(moved.value.resonance.slots[1]).toBe(wild.id);

    const locked = setResonanceSlotAction(config, moved.value, 4, null);
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.error).toBe('resource_locked');
  });
});
