import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng';
import { activeOrbSets, canSocket, foldOrbs, orbDismantleEssence, orbFlat, orbLevelGold, rollOrb, socketOpen, type OrbInstance } from './orbs';
import { ORB_TABLES as T } from './orbs.fixture';

const orb = (id: string, kind: string, level: number, colour: OrbInstance['colour'] = 'red', lines: OrbInstance['lines'] = []): OrbInstance => ({ id, kind, colour, level, lines });

describe('R3 orbs', () => {
  it('rolls 1 % line on green and 2 distinct lines on red, each in the 80–100 % band', () => {
    const g = rollOrb(T, 'a', 'sharp', 'green', mulberry32(1));
    const r = rollOrb(T, 'b', 'sharp', 'red', mulberry32(2));
    expect(g.lines).toHaveLength(1);
    expect(r.lines).toHaveLength(2);
    expect(new Set(r.lines.map((l) => l.field)).size).toBe(2);
    for (const l of [...g.lines, ...r.lines]) expect(l.roll >= 0.8 && l.roll <= 1).toBe(true);
  });

  it('flat lines: red has both (scaled to +10), green only the attack line at its colour share', () => {
    expect(orbFlat(T, orb('a', 'sharp', 7))).toEqual({ pAtk: 4152, hp: 39317 });
    expect(orbFlat(T, orb('a', 'sharp', 10))).toEqual({ pAtk: 14013, hp: 132696 });
    expect(orbFlat(T, orb('a', 'sharp', 1, 'green'))).toEqual({ pAtk: Math.round(221 * 0.176) });
  });

  it('sockets follow the family rules; row 2 needs Lv 240 unless Origin', () => {
    expect(canSocket(T, orb('a', 'sharp', 1), 0)).toBe(true); // piece 1 row 1: either
    expect(canSocket(T, orb('a', 'leisure', 1), 1)).toBe(false); // piece 2 row 1: defensive
    expect(canSocket(T, orb('a', 'leisure', 1), 5)).toBe(true); // piece 2 row 2: offensive
    expect(socketOpen(T, 0, 8, 300, false)).toBe(false);
    expect(socketOpen(T, 4, 9, 239, false)).toBe(false);
    expect(socketOpen(T, 4, 9, 100, true)).toBe(true);
  });

  it('a set needs every kind, counts each orb once and takes its lowest level', () => {
    const sets = activeOrbSets(T, [orb('1', 'sharp', 7), orb('2', 'placating', 5), orb('3', 'mystique', 9)]);
    expect(sets.map((s) => [s.set.id, s.level])).toEqual([['dmg-down', 5]]);
    expect(activeOrbSets(T, [orb('1', 'sharp', 7), orb('2', 'sharp', 7), orb('3', 'placating', 5)])).toEqual([]);
  });

  it('fold: tiers stack up to the set level; class reductions become defend damage mods', () => {
    const f = foldOrbs(T, [orb('1', 'placating', 5), orb('2', 'erudite', 5), orb('3', 'mystique', 5)]);
    expect(f.damageMods).toEqual([{ tag: 'orbset-attack-res', role: 'defend', dmg: 0.15, condition: { targetClass: 'striker' } }]);
    expect(f.delta.core.pAtk).toBe(Math.round((1846 + 1846) * 1.15)); // Erudite's 2nd line + Mystique
  });

  it('level gold stops at the colour cap; red cannot be dismantled', () => {
    expect(orbLevelGold(T, orb('a', 'sharp', 1))).toBe(10000);
    expect(orbLevelGold(T, orb('a', 'sharp', 9))).toBe(1000000);
    expect(orbLevelGold(T, orb('a', 'sharp', 10))).toBeNull();
    expect(orbLevelGold(T, orb('a', 'sharp', 3, 'green'))).toBeNull();
    expect(orbDismantleEssence(T, orb('a', 'sharp', 10, 'orange'))).toBe(1458000);
    expect(orbDismantleEssence(T, orb('a', 'sharp', 1, 'red'))).toBeNull();
  });
});
