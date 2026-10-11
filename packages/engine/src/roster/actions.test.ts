import { describe, expect, it } from 'vitest';
import { evolved, leveledUp, respawnRefund, respawned, starredUp } from './actions';
import { autoFormation, type SquadCandidate } from './squad';
import { SQUAD_SIZE, type ProgressTables, type WildInstance } from './types';

const tables: ProgressTables = {
  levelUp: { candyBase: 48, candyExponent: 1.2, goldPerCandy: 3 },
  starUp: { shardsPerStar: 10, goldPerStar: 200 },
  evolve: [{ minLevel: 1, minStars: 1, candy: 0, gold: 0, stones: 0 }, { minLevel: 20, minStars: 1, candy: 300, gold: 900, stones: 1 }],
  respawn: { gemCost: 20, refundRate: 0.8 },
  maxLevelByStage: [60, 80],
  maxStars: 10,
};

function instance(over: Partial<WildInstance> = {}): WildInstance {
  return { id: 'w1', speciesId: 'twigleaf', level: 1, stars: 1, evolutionStage: 0, locked: false, acquiredAt: 0, ...over };
}

describe('actions', () => {
  it('leveledUp gains levels and clamps to the stage cap', () => {
    expect(leveledUp(instance({ level: 10 }), 5, tables).level).toBe(15);
    expect(leveledUp(instance({ level: 58 }), 10, tables).level).toBe(60);
    expect(leveledUp(instance({ level: 5 }), -3, tables).level).toBe(5);
  });

  it('starredUp clamps to maxStars', () => {
    expect(starredUp(instance({ stars: 3 }), 2, tables).stars).toBe(5);
    expect(starredUp(instance({ stars: 9 }), 5, tables).stars).toBe(10);
  });

  it('evolved advances one stage and clamps at the last form', () => {
    expect(evolved(instance(), 2, tables).evolutionStage).toBe(1);
    expect(evolved(instance({ evolutionStage: 1 }), 2, tables).evolutionStage).toBe(1);
  });

  it('respawnRefund returns most of the level investment', () => {
    const refund = respawnRefund(instance({ level: 20 }), tables);
    expect(refund.candy).toBeGreaterThan(0);
    expect(refund.gold).toBeGreaterThanOrEqual(refund.candy);
  });

  it('respawned resets level and keeps stars/stage', () => {
    const out = respawned(instance({ level: 30, stars: 4, evolutionStage: 1 }));
    expect(out.level).toBe(1);
    expect(out.stars).toBe(4);
    expect(out.evolutionStage).toBe(1);
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
