import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng';
import {
  heldDelta,
  heldDismantleShards,
  heldLevelCost,
  heldLevelGate,
  heldRefineCost,
  mainValue,
  refineBlock,
  rollHeldItem,
  rollRefine,
  settleRefine,
} from './held';
import type { HeldTables, RelicDef, RelicInstance } from './types';

const DEF: RelicDef = {
  id: '105101',
  name: 'Shell Bell',
  className: 'striker',
  tier: 'mythic',
  mainPool: 5,
  linePool: 15,
  lineCount: 6,
  refineSlots: 3,
  dismantle: 20,
  skill: null,
};

const TABLES: HeldTables = {
  mainPool: [
    { index: 501, pool: 5, group: 1, weight: 100, name: 'HP', kind: 'core', field: 'hp', value: 269420, every: 1, step: 2694 },
    { index: 502, pool: 5, group: 2, weight: 100, name: 'P.ATK', kind: 'core', field: 'pAtk', value: 38515, every: 1, step: 385 },
    { index: 504, pool: 5, group: 1, weight: 100, name: 'Total HP', kind: 'percent', field: 'hpPct', value: 1200, every: 5, step: 120 },
  ],
  linePool: [
    { index: 1501, pool: 15, weight: 100, name: 'Water Ult DMG↑', kind: 'percent', field: 'ultBoost', faction: 'water', min: 600, max: 1500 },
    { index: 1521, pool: 15, weight: 100, name: 'Critical', kind: 'percent', field: 'crit', min: 800, max: 2000 },
    { index: 1529, pool: 15, weight: 100, name: 'Absorb HP Rate', kind: 'lifesteal', field: 'lifesteal', min: 320, max: 800 },
  ],
  levelCost: [20, 20, 20, 25],
  levelGates: [{ level: 3, resonance: 250 }],
  refineLadder: [0, 1, 1, 2],
  resetterCompound: 20,
};

const item = (over: Partial<RelicInstance> = {}): RelicInstance => ({
  id: 're1',
  defId: DEF.id,
  level: 0,
  group: 1,
  lines: Array.from({ length: 6 }, () => ({ index: 1521, value: 1000, refines: 0 })),
  refines: 0,
  pending: null,
  locked: false,
  ...over,
});

describe('held items (R5, source rules)', () => {
  it('rolls the same item from the same seed, with every line inside its range', () => {
    const a = rollHeldItem(DEF, TABLES, mulberry32(7), 're1');
    const b = rollHeldItem(DEF, TABLES, mulberry32(7), 're1');
    expect(a).toEqual(b);
    expect(a.level).toBe(0);
    expect(a.lines).toHaveLength(6);
    for (const line of a.lines) {
      const row = TABLES.linePool.find((r) => r.index === line.index)!;
      expect(line.value).toBeGreaterThanOrEqual(row.min);
      expect(line.value).toBeLessThanOrEqual(row.max);
    }
  });

  it('grows the main stat by the source stren_value (Mythic Lv160: HP 700,460 and Total HP 50.40%)', () => {
    expect(mainValue(TABLES.mainPool[0]!, 160)).toBe(700460);
    expect(mainValue(TABLES.mainPool[2]!, 160)).toBe(5040);
    const { delta } = heldDelta(item({ level: 160 }), DEF, TABLES, 'fire');
    expect(delta.core.hp).toBe(700460);
    expect(delta.percent.hpPct).toBeCloseTo(0.504);
  });

  it('counts a faction line only on that faction, and Absorb as lifesteal', () => {
    const inst = item({
      lines: [
        { index: 1501, value: 1000, refines: 0 },
        { index: 1529, value: 500, refines: 0 },
      ],
    });
    expect(heldDelta(inst, DEF, TABLES, 'water').delta.percent.ultBoost).toBeCloseTo(0.1);
    expect(heldDelta(inst, DEF, TABLES, 'fire').delta.percent.ultBoost).toBeUndefined();
    expect(heldDelta(inst, DEF, TABLES, 'fire').lifesteal).toBeCloseTo(0.05);
  });

  it('prices levels from the table, gates them on resonance and pays back levels on dismantle', () => {
    expect(heldLevelCost(0, TABLES)).toBe(20);
    expect(heldLevelCost(4, TABLES)).toBeNull();
    expect(heldLevelGate(1, TABLES)).toBe(0);
    expect(heldLevelGate(2, TABLES)).toBe(250);
    expect(heldDismantleShards(item({ level: 3 }), DEF, TABLES)).toBe(20 + 60);
  });

  it('refines on the ladder: first free, only refineSlots distinct slots, keep or drop', () => {
    let inst = item();
    expect(heldRefineCost(inst, TABLES)).toBe(0);
    for (const slot of [0, 1, 2]) {
      expect(refineBlock(inst, DEF, TABLES, slot)).toBeNull();
      inst = settleRefine(rollRefine(inst, DEF, TABLES, slot, mulberry32(slot)), false);
    }
    expect(inst.refines).toBe(3);
    expect(heldRefineCost(inst, TABLES)).toBe(2);
    // three slots used: the other three are locked for good, the refined ones stay open
    expect(refineBlock(inst, DEF, TABLES, 3)).toBe('slot_limit');
    expect(refineBlock(inst, DEF, TABLES, 0)).toBeNull();
    expect(refineBlock(inst, DEF, TABLES, 6)).toBe('main_stat');

    const rolled = rollRefine(inst, DEF, TABLES, 0, mulberry32(99));
    expect(rolled.pending?.slot).toBe(0);
    const dropped = settleRefine(rolled, false);
    expect(dropped.lines[0]).toEqual({ ...inst.lines[0], refines: 2 });
    const kept = settleRefine(rolled, true);
    expect(kept.lines[0]!.index).toBe(rolled.pending!.index);
    expect(kept.lines[0]!.value).toBe(rolled.pending!.value);
    expect(kept.pending).toBeNull();
    expect(refineBlock(kept, DEF, TABLES, 0)).toBe('max_refine');
    expect(heldRefineCost(kept, TABLES)).toBeNull();
  });

  it('has no refinable slot below Supreme', () => {
    expect(refineBlock(item(), { ...DEF, refineSlots: 0 }, TABLES, 0)).toBe('no_slots');
  });
});
