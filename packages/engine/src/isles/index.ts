/**
 * Clash of Isles (M14.5) account state. Rules live in packages/server/src/isles.ts. See docs/design/clash-of-isles.md.
 */
export interface IslesState {
  week: string;
  day: string;
  /** Attempts held (max 6, +1 every 4 h). */
  attempts: number;
  attemptsAt: number;
  /** Island currently held (0 = none) and when production was last settled. */
  held: number;
  heldAt: number;
  /** Development power left today (1 per garrisoned minute). */
  power: number;
  /** Shields left on CPU-held islands (by island id). */
  shields: Record<string, number>;
  /** Wins in a row (fatigue: −5 % per win, max −50 %). */
  fatigue: number;
  /** Season points and today's challenges. */
  points: number;
  challengesToday: number;
  claimed: string[];
  lastRank: number | null;
}
