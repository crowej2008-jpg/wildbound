import { describe, expect, it } from 'vitest';
import {
  accruedMinutes,
  addRewards,
  applyRewards,
  idleReward,
  levelForXp,
  levelProgress,
  pendingIdle,
  quickCollect,
  scaleRewards,
  xpForLevel,
} from './index';

describe('rewards', () => {
  it('adds and scales bundles, dropping zero keys', () => {
    expect(addRewards({ gold: 10, xp: 5 }, { gold: 2, candy: 3 })).toEqual({ gold: 12, xp: 5, candy: 3 });
    expect(scaleRewards({ gold: 10, candy: 3 }, 2)).toEqual({ gold: 20, candy: 6 });
  });

  it('applies currency bundles floored at zero and ignores xp', () => {
    const out = applyRewards({ gold: 5, gems: 1, candy: 0, shard: 0, stone: 0 }, { gold: -50, candy: 7, xp: 99 });
    expect(out.gold).toBe(0);
    expect(out.candy).toBe(7);
    expect(out.xp).toBeUndefined();
  });
});

describe('idle', () => {
  const rate = { gold: 10, candy: 2 };
  const now = 1_000_000_000;

  it('accrues whole minutes, capped', () => {
    expect(accruedMinutes(now - 90_000, now, 720)).toBe(1);
    expect(accruedMinutes(now - 1_000_000 * 60, now, 720)).toBe(720);
    expect(accruedMinutes(now + 1000, now, 720)).toBe(0);
  });

  it('scales the per-minute rate and tops up to the cap', () => {
    expect(idleReward(rate, 5)).toEqual({ gold: 50, candy: 10 });
    const last = now - 100 * 60_000;
    expect(pendingIdle(rate, last, now, 720)).toEqual({ gold: 1000, candy: 200 });
    // 120 minutes quick-collect is bounded by the 720-cap minus the 100 already accrued.
    expect(quickCollect(rate, last, now, 720, 120)).toEqual({ gold: 1200, candy: 240 });
  });
});

describe('trainer xp', () => {
  const curve = { base: 100, exponent: 2, maxLevel: 5 };

  it('derives level from cumulative xp', () => {
    expect(levelForXp(0, curve)).toBe(1);
    expect(levelForXp(99, curve)).toBe(1);
    expect(levelForXp(100, curve)).toBe(2);
    expect(levelForXp(xpForLevel(4, curve), curve)).toBe(4);
    expect(levelForXp(1e9, curve)).toBe(5);
  });

  it('reports progress within the current level', () => {
    const p = levelProgress(150, curve);
    expect(p.level).toBe(2);
    expect(p.into).toBe(50);
    expect(p.need).toBe(400);
  });
});
