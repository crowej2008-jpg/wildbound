import { describe, expect, it } from 'vitest';
import { leveledUp, respawnRefund, respawned, starredUp } from './actions';
import { autoFormation, type SquadCandidate } from './squad';
import { SQUAD_SIZE, type ProgressTables, type WildInstance } from './types';

const tables: ProgressTables = {
  levelUp: { candyBase: 48, candyExponent: 1.2, goldPerCandy: 3 },
  respawn: { gemCost: 20, refundRate: 0.8 },
};

function instance(over: Partial<WildInstance> = {}): WildInstance {
  return { id: 'w1', speciesId: 'twigleaf', level: 1, stars: 5, locked: false, acquiredAt: 0, ...over };
}

describe('actions', () => {
  it('leveledUp gains levels and clamps to the star card cap', () => {
    expect(leveledUp(instance({ level: 10 }), 5, 100).level).toBe(15);
    expect(leveledUp(instance({ level: 98 }), 10, 100).level).toBe(100);
    expect(leveledUp(instance({ level: 5 }), -3, 100).level).toBe(5);
  });

  it("starredUp raises one star and clamps to the species' last star", () => {
    expect(starredUp(instance({ stars: 5 }), 23).stars).toBe(6);
    expect(starredUp(instance({ stars: 23 }), 23).stars).toBe(23);
  });

  it('respawnRefund returns most of the level investment', () => {
    const refund = respawnRefund(instance({ level: 20 }), tables);
    expect(refund.candy).toBeGreaterThan(0);
    expect(refund.gold).toBeGreaterThanOrEqual(refund.candy);
  });

  it('respawned resets level and keeps stars', () => {
    const out = respawned(instance({ level: 30, stars: 8 }));
    expect(out.level).toBe(1);
    expect(out.stars).toBe(8);
  });
});

describe('autoFormation', () => {
  const cand = (id: string, speciesId: string, className: SquadCandidate['className'], power: number, stars = 1, level = 1): SquadCandidate => ({
    id,
    speciesId,
    className,
    power,
    stars,
    level,
  });

  it('fills all six slots and respects one-per-species', () => {
    const candidates = [
      cand('a', 's1', 'striker', 100),
      cand('a2', 's1', 'striker', 90),
      cand('b', 's2', 'guardian', 80),
      cand('c', 's3', 'adept', 70),
      cand('d', 's4', 'striker', 60),
      cand('e', 's5', 'adept', 50),
      cand('f', 's6', 'guardian', 40),
      cand('g', 's7', 'striker', 30),
    ];
    const squad = autoFormation(candidates, Array.from({ length: SQUAD_SIZE }, () => null));
    const filled = squad.filter((x): x is string => x !== null);
    expect(filled).toHaveLength(6);
    expect(filled).toContain('a');
    expect(filled).not.toContain('a2'); // species s1 already taken
    expect(filled).not.toContain('g'); // lowest power dropped
  });

  it('places Guardians in the front row (slots 0-2)', () => {
    const candidates = [
      cand('s', 's2', 'striker', 100),
      cand('g', 's1', 'guardian', 10),
    ];
    const squad = autoFormation(candidates, Array.from({ length: SQUAD_SIZE }, () => null));
    expect(squad[0]).toBe('g');
  });

  it('is deterministic', () => {
    const candidates = [cand('a', 's1', 'striker', 100), cand('b', 's2', 'guardian', 100)];
    const empty = Array.from({ length: SQUAD_SIZE }, () => null);
    expect(autoFormation(candidates, empty)).toEqual(autoFormation(candidates, empty));
  });
});
