import { describe, expect, it } from 'vitest';
import type { CampaignProgress } from '../campaign/types';
import { exploreAccess, nextResetMs, serverDay } from './index';

const EPOCH = Date.UTC(2026, 0, 1);
const cleared: CampaignProgress = { stars: { 'c3-10': 3 }, gyms: {} };

describe('explore access', () => {
  it('counts server days from the account epoch, day 1 inclusive', () => {
    expect(serverDay(EPOCH, EPOCH)).toBe(1);
    expect(serverDay(EPOCH + 1, EPOCH)).toBe(1);
    expect(serverDay(EPOCH + 14 * 86_400_000, EPOCH)).toBe(15);
    expect(serverDay(EPOCH - 86_400_000, EPOCH)).toBe(1);
  });

  it('requires every campaign, level and server-day gate', () => {
    const context = { campaign: cleared, level: 12, serverDay: 15 };
    const open = exploreAccess(
      [
        { kind: 'campaign', chapter: 3, stage: 10 },
        { kind: 'level', level: 10 },
        { kind: 'serverDay', day: 15 },
      ],
      context,
    );
    expect(open.unlocked).toBe(true);
    expect(open.gates.every((gate) => gate.met)).toBe(true);

    const locked = exploreAccess(
      [
        { kind: 'campaign', chapter: 4, stage: 1 },
        { kind: 'level', level: 50 },
        { kind: 'serverDay', day: 29 },
      ],
      context,
    );
    expect(locked.unlocked).toBe(false);
    expect(locked.gates.map((gate) => gate.met)).toEqual([false, false, false]);
    expect(locked.gates[0]?.stageId).toBe('c4-1');
    expect(locked.gates[1]?.current).toBe(12);
    expect(locked.gates[1]?.required).toBe(50);
    expect(locked.gates[2]?.current).toBe(15);
    expect(locked.gates[2]?.required).toBe(29);
  });

  it('reports the next daily or weekly reset and handles permanent modes', () => {
    const noon = Date.UTC(2026, 0, 1, 12);
    expect(nextResetMs('daily', noon)).toBe(12 * 3_600_000);
    // 2026-01-01 is a Thursday, so the next Monday is 3.5 days away.
    expect(nextResetMs('weekly', noon)).toBe(3.5 * 86_400_000);
    expect(nextResetMs('permanent', noon)).toBeNull();
  });
});
