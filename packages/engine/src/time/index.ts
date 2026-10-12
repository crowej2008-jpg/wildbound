/**
 * UTC time helpers (M5, PROMPT §7.9). All game time is UTC; these are pure
 * functions over a millisecond epoch so the engine never reads a clock itself.
 */

export const UTC_DAY_MS = 86_400_000;

/** `"YYYY-MM-DD"` in UTC — the daily-reset key. */
export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isSameDay(a: number, b: number): boolean {
  return dayKey(a) === dayKey(b);
}

/** The epoch of the next 00:00 UTC strictly after `ms`. */
export function nextUtcMidnight(ms: number): number {
  const day = Math.floor(ms / UTC_DAY_MS) * UTC_DAY_MS;
  return day + UTC_DAY_MS;
}

export function msUntilNextUtcMidnight(ms: number): number {
  return nextUtcMidnight(ms) - ms;
}

/**
 * The next restock boundary for a shop that restocks at the given UTC hours
 * (PROMPT §7.9: Daily Shop at 00:00/12:00/18:00). Returns the epoch; M6 uses it
 * for countdowns, M5 only declares it.
 */
export function nextRestock(ms: number, hoursUtc: readonly number[]): number {
  const hour = 3_600_000;
  const day = Math.floor(ms / UTC_DAY_MS) * UTC_DAY_MS;
  for (const h of [...hoursUtc].sort((a, b) => a - b)) {
    const at = day + h * hour;
    if (at > ms) return at;
  }
  return day + UTC_DAY_MS + (hoursUtc[0] ?? 0) * hour;
}
