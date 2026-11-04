import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng';
import { boxOdds, chooseRow, composable, MAX_BAG_BATCH, rollBox, rollBoxes, type BoxDef } from './bag';

/** R9: the Bag's generic shards and Pokémon boxes, copied from the source (docs/design/bag.md). */

const box5: BoxDef = {
  id: 'box5Star',
  kind: 'random',
  autoOpen: true,
  rows: [
    { species: 'starmie', star: 5, weight: 7776 },
    { species: 'raikou', star: 5, weight: 666 },
  ],
};
const ld: BoxDef = { id: 'boxLD', kind: 'chooseSpecies', autoOpen: false, rows: [{ species: 'mew', star: null, weight: 1 }] };

describe('Bag compose', () => {
  it('makes one box per full recipe, capped at 999 a press', () => {
    const recipe = { from: 'pokemonShard3', count: 40, box: 'box3Star' };
    expect(composable(recipe, 39)).toBe(0);
    expect(composable(recipe, 40)).toBe(1);
    expect(composable(recipe, 119)).toBe(2);
    expect(composable(recipe, 40 * 5000)).toBe(MAX_BAG_BATCH);
  });
});

describe('Bag boxes', () => {
  it('a random box picks rows by weight', () => {
    const rolls = rollBoxes(mulberry32(7), box5, 4000);
    const raikou = rolls.filter((r) => r.species === 'raikou').length / rolls.length;
    expect(raikou).toBeGreaterThan(0.05);
    expect(raikou).toBeLessThan(0.11);
  });

  it('is deterministic for a seed', () => {
    expect(rollBoxes(mulberry32(3), box5, 20)).toEqual(rollBoxes(mulberry32(3), box5, 20));
  });

  it('a choice box cannot be rolled, and offers only its own rows', () => {
    expect(() => rollBox(mulberry32(1), ld)).toThrow();
    expect(chooseRow(ld, 'mew')).toEqual({ species: 'mew', star: null, weight: 1 });
    expect(chooseRow(ld, 'lugia')).toBeUndefined();
    expect(chooseRow(box5, 'starmie')).toBeUndefined();
  });

  it('odds sum to one', () => {
    const odds = boxOdds(box5);
    expect(odds.reduce((s, o) => s + o.probability, 0)).toBeCloseTo(1, 9);
    expect(odds[1]!.probability).toBeCloseTo(666 / 8442, 9);
  });
});
