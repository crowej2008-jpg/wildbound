import { UTC_DAY_MS } from '../time';

/**
 * Reset cadence helpers (M8, PROMPT §7.9/§7.6). Pure functions over a millisecond
 * epoch; the clock is injected everywhere else. See docs/design/pve-modes.md.
 */

/** Day of week in UTC: 0 = Sunday … 6 = Saturday. */
export function weekdayUtc(ms: number): number {
  return new Date(ms).getUTCDay();
}

/**
 * ISO-8601 week key `"YYYY-Www"` (weeks start Monday; week 1 holds the first
 * Thursday of the year). Two timestamps share a key exactly when they fall in the
 * same Monday-to-Sunday week — the tower's weekly reset boundary.
 */
export function weekKey(ms: number): string {
  const d = new Date(ms);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Shift to the Thursday of this week (ISO: week belongs to the year of its Thursday).
  const dayNum = (date.getUTCDay() + 6) % 7; // Monday = 0 … Sunday = 6
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const year = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * UTC_DAY_MS));
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function isSameUtcWeek(a: number, b: number): boolean {
  return weekKey(a) === weekKey(b);
}

/** The epoch of the next 00:00 UTC strictly after `ms`. */
export function nextWeekStart(ms: number): number {
  const day = Math.floor(ms / UTC_DAY_MS) * UTC_DAY_MS;
  const dayNum = weekdayUtc(ms); // 0=Sun
  const daysToMonday = dayNum === 0 ? 1 : 8 - dayNum;
  return day + daysToMonday * UTC_DAY_MS;
}
