import { describe, expect, it } from 'vitest';
import { equippedSheet } from './battle';
import { buildConfig } from './config';
import {
  ascendFashionPieceAction,
  buildFashionView,
  fashionLines,
  grantFashionShards,
  levelFashionAction,
  wearFashionPieceAction,
} from './fashion';
import { createInitialState } from './save';

function makeState() {
  const config = buildConfig();
  const state = createInitialState(config);
  return { config, state };
}
const noTitles = () => false;

describe('R8 Mount / Back Decor / Follower / Outfits', () => {
  it('copies the source pieces and sets, and fits the made-up curve to the screen readings', () => {
    const { config } = makeState();
    const count = (slot: string) => config.fashion.pieces.filter((p) => p.slot === slot).length;
    expect([count('outfit'), count('follower'), count('mount'), count('backDecor')]).toEqual([37, 38, 40, 41]);
    expect(config.fashion.pieces.filter((p) => p.free).map((p) => p.name)).toEqual(['Hero', 'Heroine', 'Pikachu', 'Arcanine', 'Schoolbag']);
    expect(config.fashion.sets[0]).toMatchObject({ name: 'Nurse Unit', title: '601' });
    const l = config.fashion.ladder;
    expect([l[173]!.tier, l[173]!.star, l[173]!.exp, l[173]!.hp, l[173]!.atk, l[173]!.pct]).toEqual([18, 3, 16_500, 146_481, 21_701, 0.205]);
    expect([l[200]!.tier, l[200]!.star, l[200]!.hp, l[200]!.atk, l[200]!.pct, l[200]!.exp]).toEqual([20, 10, 195_000, 28_890, 0.26, 0]);
  });

  it('levels a ladder with its own stone at 10 stones per 100 exp', () => {
    const { config, state } = makeState();
    const rich = { ...state, currencies: { ...state.currencies, mountStone: 1000 } };
    const up = levelFashionAction(config, rich, 'mount', 5);
    if (!up.ok) throw new Error(up.message);
    const spent = [0, 1, 2, 3, 4].reduce((s, lv) => s + Math.ceil(config.fashion.ladder[lv]!.exp / 100) * 10, 0);
    expect(up.value.fashion.levels.mount).toEqual({ level: 5, exp: 0 });
    expect(up.value.currencies.mountStone).toBe(1000 - spent);
    expect(levelFashionAction(config, state, 'follower', 1).ok).toBe(false);
    const view = buildFashionView(config, up.value, noTitles);
    expect(view.ladders.find((x) => x.slot === 'mount')?.level).toBe(5);
  });

  it('activates and ascends a piece with its own shards, and only owned pieces can be worn', () => {
    const { config, state } = makeState();
    expect(wearFashionPieceAction(config, state, 'mount', 2).ok).toBe(false);
    const one = ascendFashionPieceAction(config, grantFashionShards(state, 'mount', 2, 3), 'mount', 2);
    if (!one.ok) throw new Error(one.message);
    expect(one.value.fashion.stars['mount:2']).toBe(1);
    const two = ascendFashionPieceAction(config, one.value, 'mount', 2); // 1★ → 2★ costs 2
    if (!two.ok) throw new Error(two.message);
    expect(two.value.fashion.stars['mount:2']).toBe(2);
    expect(two.value.fashion.shards['mount:2']).toBeUndefined();
    expect(wearFashionPieceAction(config, two.value, 'mount', 2).ok).toBe(true);
    expect(ascendFashionPieceAction(config, state, 'mount', 1).ok).toBe(false); // the free Arcanine
  });

  it('adds ladder, piece and set lines to every Pokémon', () => {
    const { config, state } = makeState();
    expect(fashionLines(config, state, noTitles)).toEqual([]);
    const set = config.fashion.sets[0]!;
    let s = { ...state, fashion: { ...state.fashion, levels: { follower: { level: 10, exp: 0 } } } };
    for (const p of set.pieces.slice(0, 2)) s = { ...s, fashion: { ...s.fashion, stars: { ...s.fashion.stars, [`${p.slot}:${p.index}`]: 1 } } };
    const view = buildFashionView(config, s, noTitles);
    expect(view.sets[0]).toMatchObject({ count: 2, reached: 2 });
    expect(buildFashionView(config, s, (id) => id === set.title).sets[0]).toMatchObject({ count: 3, reached: 3 });
    const wild = s.roster[0]!;
    const before = equippedSheet(wild, config, state)!;
    const after = equippedSheet(wild, config, s)!;
    expect(after.sheet.hp).toBeGreaterThan(before.sheet.hp);
    expect(after.sheet.pAtk).toBeGreaterThan(before.sheet.pAtk);
  });
});
