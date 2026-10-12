import { describe, expect, it } from 'vitest';
import { UTC_DAY_MS, dayKey, isSameDay, msUntilNextUtcMidnight, nextRestock, nextUtcMidnight } from './index';

const at = (iso: string) => Date.parse(iso);

describe('time (UTC)', () => {
  it('formats and compares day keys in UTC', () => {
    expect(dayKey(at('2026-10-11T23:59:59Z'))).toBe('2026-10-11');
    expect(dayKey(at('2026-10-12T00:00:00Z'))).toBe('2026-10-12');
    expect(isSameDay(at('2026-10-11T00:00:00Z'), at('2026-10-11T23:59:59Z'))).toBe(true);
    expect(isSameDay(at('2026-10-11T23:59:59Z'), at('2026-10-12T00:00:00Z'))).toBe(false);
  });

  it('finds the next UTC midnight', () => {
    expect(nextUtcMidnight(at('2026-10-11T08:30:00Z'))).toBe(at('2026-10-12T00:00:00Z'));
    expect(msUntilNextUtcMidnight(at('2026-10-11T23:00:00Z'))).toBe(3_600_000);
    expect(msUntilNextUtcMidnight(at('2026-10-11T00:00:00Z'))).toBe(UTC_DAY_MS);
  });

  it('finds the next restock boundary across hours and days', () => {
    const hours = [0, 12, 18];
    expect(nextRestock(at('2026-10-11T05:00:00Z'), hours)).toBe(at('2026-10-11T12:00:00Z'));
    expect(nextRestock(at('2026-10-11T13:00:00Z'), hours)).toBe(at('2026-10-11T18:00:00Z'));
    expect(nextRestock(at('2026-10-11T20:00:00Z'), hours)).toBe(at('2026-10-12T00:00:00Z'));
  });
});
