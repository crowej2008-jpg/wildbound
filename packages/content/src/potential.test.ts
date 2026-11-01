import { describe, expect, it } from 'vitest';
import { POTENTIAL } from './potential';
import { WILDS } from './species';

describe('R4 Potential content', () => {
  it('copies the source: 67 options, 62 trees, tier stars 7–15, 8,370,000 shards to max', () => {
    expect(POTENTIAL.options).toHaveLength(67);
    expect(Object.keys(POTENTIAL.species)).toHaveLength(62);
    expect(POTENTIAL.unlockStars).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(POTENTIAL.costs.flat().reduce((a, b) => a + b, 0)).toBe(8_370_000);
    expect(POTENTIAL.costs.reduce((a, c) => a + c[0]!, 0)).toBe(465_000);
  });

  it('gives a tree to every Legendary and higher Pokémon and none to Rare or Epic', () => {
    for (const w of WILDS) {
      const has = POTENTIAL.species[w.id] !== undefined;
      expect(has, w.id).toBe(!['rare', 'epic'].includes(w.tier));
    }
  });

  it('every tree option exists and sits on its own tier', () => {
    const byId = new Map(POTENTIAL.options.map((o) => [o.id, o]));
    for (const [id, sp] of Object.entries(POTENTIAL.species)) {
      sp.tiers.forEach((ids, t) => ids.forEach((o) => expect(byId.get(o)?.tier, `${id} tier ${t + 1}`).toBe(t + 1)));
    }
  });

  it('matches kb trees: Wobbuffet tier 4 is the SKILL-ally set; Mythics take own copies from tier 5', () => {
    const name = (id: number) => POTENTIAL.options.find((o) => o.id === id)!.name;
    expect(POTENTIAL.species['wobbuffet']!.tiers[3]!.map(name)).toEqual(['Synchronized Attack', 'Numerical Strength', 'Analyze']);
    expect(POTENTIAL.species['wobbuffet']!.tiers[3]![0]).toBe(50413);
    expect(POTENTIAL.species['darkrai']!.fodder[4]).toEqual([{ own: true, star: 5, count: 1 }]);
    expect(POTENTIAL.species['darkrai']!.core).toBe(true);
    expect(POTENTIAL.species['shiny-darkrai']!.core).toBe(false);
  });
});
