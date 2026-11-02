import { describe, expect, it } from 'vitest';
import pool from '../species/summon-pool.json';
import { kitById } from './kits';
import { wildById, WILDS } from './species';

/** R9 (owner, 2026-11-02): the 14 summon-pool Pokémon (source heroes 101–110, 112–115). */

describe('summon-pool Pokémon', () => {
  it('adds 14 Pokémon to the 84, each with a kit, on the source hero ids', () => {
    expect(WILDS).toHaveLength(98);
    expect(pool).toHaveLength(14);
    expect(pool.map((s) => s.sourceId).sort((a, b) => a - b)).toEqual([101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 112, 113, 114, 115]);
    for (const s of pool) expect(kitById(s.id)?.tier).toBe(s.tier);
  });

  it('Normal Pokémon run 1–3★ and Uncommon 3–5★, with the source card names', () => {
    for (const s of pool) {
      const stars = s.stars.map((c) => c.star);
      expect(stars).toEqual(s.tier === 'common' ? [1, 2, 3] : [3, 4, 5]);
      expect(s.stars.at(-1)?.fodder).toBeUndefined();
    }
    expect(wildById('caterpie')?.stars.map((c) => c.name)).toEqual(['Caterpie', 'Butterfree', 'Butterfree']);
    expect(wildById('onix')?.stars.map((c) => c.name)).toEqual(['Onix', 'Steelix', 'Omega Steelix']);
  });

  it('only Caterpie carries lethal hits, and no text mentions it', () => {
    const lethal = pool.filter((s) => kitById(s.id)?.talents?.lethalHits === true).map((s) => s.id);
    expect(lethal).toEqual(['caterpie']);
    expect(wildById('caterpie')?.description).not.toMatch(/lethal|one[- ]?shot|one hit/i);
  });
});
