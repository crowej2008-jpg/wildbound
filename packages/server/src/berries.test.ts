import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@wildbound/engine';
import { buildConfig } from './config';
import {
  berriesView,
  breakthroughBerryAction,
  cultivateBerryAction,
  dismantleBerriesAction,
  elevateBerryAction,
  equipBerryAction,
  grantBerry,
  reforgeBerryAction,
} from './berries';
import { createInitialState } from './save';

function setup() {
  const config = buildConfig();
  const state = createInitialState(config);
  const wild = state.roster[0]!;
  state.roster[0] = { ...wild, stars: 10 };
  state.profile = { ...state.profile, level: 60 };
  state.currencies.berryEssence = 100_000;
  state.currencies.gold = 10_000_000;
  state.currencies.reforgePotion = 1_000;
  state.currencies.berryMulchBlue = 100;
  state.currencies.berryMulchPurple = 100;
  return { config, state, wildId: wild.id };
}

function add(config: ReturnType<typeof buildConfig>, state: ReturnType<typeof createInitialState>, defId: string, seed = 1) {
  const r = grantBerry(config, state, defId, mulberry32(seed));
  if (!r.ok) throw new Error(r.message);
  return { state: r.value, id: r.value.equipment.berries[r.value.equipment.berries.length - 1]!.id };
}

describe('R6d berries', () => {
  it('starts with rolled berries; a new one has one line at 1★ +0', () => {
    const { config, state } = setup();
    expect(state.equipment.berries.length).toBeGreaterThan(0);
    const { state: s, id } = add(config, state, 'berry-pear-berry');
    const b = s.equipment.berries.find((x) => x.id === id)!;
    expect(b.star).toBe(1);
    expect(b.stage).toBe(0);
    expect(b.lines).toHaveLength(1);
    const lum = add(config, s, 'berry-lum-berry').state.equipment.berries.at(-1)!;
    expect(lum.star).toBe(0);
    expect(lum.lines).toHaveLength(0);
  });

  it('carries two berries, never two of one type', () => {
    const { config, state, wildId } = setup();
    let s = state;
    const a = add(config, s, 'berry-petaya-berry');
    s = a.state;
    const b = add(config, s, 'berry-strong-dragon-fire-fruit'); // same type (8)
    s = b.state;
    const c = add(config, s, 'berry-spelon-berry');
    s = c.state;
    const one = equipBerryAction(config, s, wildId, 0, a.id);
    expect(one.ok).toBe(true);
    if (!one.ok) return;
    const clash = equipBerryAction(config, one.value, wildId, 1, b.id);
    expect(clash.ok).toBe(false);
    const two = equipBerryAction(config, one.value, wildId, 1, c.id);
    expect(two.ok).toBe(true);
    if (!two.ok) return;
    const view = berriesView(config, two.value, wildId);
    if (!view.ok) throw new Error(view.message);
    expect(view.value.slots).toEqual([a.id, c.id]);
  });

  it('cultivates for Berry Essence up to the cap, breaks through (new line), and reforges a line', () => {
    const { config, state } = setup();
    let { state: s, id } = add(config, state, 'berry-pear-berry');
    const rng = mulberry32(7);
    for (let n = 0; n < 20; n += 1) {
      const r = cultivateBerryAction(config, s, id, 10, rng);
      if (!r.ok) break;
      s = r.value;
    }
    let b = s.equipment.berries.find((x) => x.id === id)!;
    const cap = config.equipment.berries.elements.find((e) => e.id === b.lines[0]!.element)!.caps[0]!;
    expect(b.lines[0]!.value).toBe(cap);
    expect(cultivateBerryAction(config, s, id, 1, rng).ok).toBe(false); // full: break through first
    const br = breakthroughBerryAction(config, s, id, rng);
    expect(br.ok).toBe(true);
    if (!br.ok) return;
    s = br.value;
    b = s.equipment.berries.find((x) => x.id === id)!;
    expect(b.stage).toBe(1);
    expect(b.lines).toHaveLength(2);
    expect(s.currencies.berryMulchBlue).toBe(90);
    const before = b.lines[0]!.element;
    const rf = reforgeBerryAction(config, s, id, 0, rng);
    expect(rf.ok).toBe(true);
    if (!rf.ok) return;
    expect(rf.value.equipment.berries.find((x) => x.id === id)!.lines[0]!.element).not.toBe(before);
    expect(rf.value.currencies.reforgePotion).toBe(990);
  });

  it('elevates with spare uncultivated 1★ berries and Gold; dismantles only uncultivated free berries', () => {
    const { config, state } = setup();
    let s = state;
    const target = add(config, s, 'berry-cirio-berry', 1);
    s = target.state;
    s = add(config, s, 'berry-cirio-berry', 2).state; // 1 same copy
    s = add(config, s, 'berry-nanab-berry', 3).state; // 2 any copies
    s = add(config, s, 'berry-peach-berry', 4).state;
    const up = elevateBerryAction(config, s, target.id);
    expect(up.ok).toBe(true);
    if (!up.ok) return;
    expect(up.value.equipment.berries.find((x) => x.id === target.id)!.star).toBe(2);
    expect(up.value.equipment.berries.length).toBe(s.equipment.berries.length - 3);

    const spare = add(config, up.value, 'berry-bergamot-berry', 5);
    const essence = spare.state.currencies.berryEssence;
    const gone = dismantleBerriesAction(config, spare.state, [spare.id]);
    expect(gone.ok).toBe(true);
    if (gone.ok) expect(gone.value.currencies.berryEssence).toBe(essence + 40);
    const grown = cultivateBerryAction(config, spare.state, spare.id, 1, mulberry32(9));
    if (!grown.ok) throw new Error(grown.message);
    expect(dismantleBerriesAction(config, grown.value, [spare.id]).ok).toBe(false);
  });

  it('gates breakthrough by trainer level', () => {
    const { config, state } = setup();
    const { state: s, id } = add(config, { ...state, profile: { ...state.profile, level: 30 } }, 'berry-pear-berry');
    const r = breakthroughBerryAction(config, s, id, mulberry32(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('resource_locked');
  });
});
