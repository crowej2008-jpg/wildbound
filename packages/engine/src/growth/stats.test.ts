import { describe, expect, it } from 'vitest';
import { formIndex, formNames, resolveCoreStats, starCardFor, starRange } from './stats';
import type { StarCard } from './types';

/** Darkrai's 5★ card, copied from the source (hero_evolution_json, hero 151). */
const DARKRAI_5: StarCard = {
  star: 5,
  name: 'Darkrai',
  maxLevel: 100,
  basic: { hp: 7894, atk: 1702, spd: 20 },
  growth: { hp: 633.04, atk: 135.94, pDef: 122.72, sDef: 61.36 },
  factionBoost: { faction: 'light', value: 0.25 },
  fodder: [{ own: true, star: 5, count: 1 }],
};

const ladder: StarCard[] = [
  { ...DARKRAI_5, star: 5, name: 'Beldum', maxLevel: 100 },
  { ...DARKRAI_5, star: 6, name: 'Metang', maxLevel: 140 },
  { ...DARKRAI_5, star: 7, name: 'Metang', maxLevel: 180 },
  { ...DARKRAI_5, star: 8, name: 'Metagross', maxLevel: 220 },
];

describe('source stat formula (R1)', () => {
  it('HP / ATK are basic + level × growth, P.ATK = S.ATK, DEF is level × growth only', () => {
    const stats = resolveCoreStats(DARKRAI_5, 10);
    expect(stats.hp).toBe(Math.round(7894 + 10 * 633.04));
    expect(stats.pAtk).toBe(Math.round(1702 + 10 * 135.94));
    expect(stats.sAtk).toBe(stats.pAtk);
    expect(stats.pDef).toBe(Math.round(10 * 122.72));
    expect(stats.sDef).toBe(Math.floor(10 * 61.36));
    expect(stats.spd).toBe(20);
  });

  it('adds the 19★+ extras flat and per level', () => {
    const awakened: StarCard = {
      ...DARKRAI_5,
      extraBasic: { hp: 35837, atk: 7733 },
      extraGrowth: { hp: 200, atk: 100 },
    };
    const plain = resolveCoreStats(DARKRAI_5, 340);
    const extra = resolveCoreStats(awakened, 340);
    expect(extra.hp - plain.hp).toBe(35837 + 340 * 200);
    expect(extra.pAtk - plain.pAtk).toBe(7733 + 340 * 100);
    expect(extra.pDef).toBe(plain.pDef);
  });

  it('picks and clamps star cards and names the forms', () => {
    expect(starCardFor(ladder, 6).name).toBe('Metang');
    expect(starCardFor(ladder, 3).star).toBe(5);
    expect(starCardFor(ladder, 30).star).toBe(8);
    expect(starRange(ladder)).toEqual({ min: 5, max: 8 });
    expect(formNames(ladder)).toEqual(['Beldum', 'Metang', 'Metagross']);
    expect(formIndex(ladder, 5)).toBe(0);
    expect(formIndex(ladder, 7)).toBe(1);
    expect(formIndex(ladder, 8)).toBe(2);
  });
});
