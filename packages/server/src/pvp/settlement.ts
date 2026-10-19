import {
  applyWeeklySettlement,
  createMail,
  dayKey,
  rankedDayKey,
  rollArenaDay,
  rollRankedDay,
  rollRankedSeason,
  seasonKey,
  weekKey,
  type AccountState,
  type ArenaSettlement,
  type MailItem,
} from '@wildbound/engine';
import type { GameConfig } from '../config';
import { arenaTuning, rankedTuning } from './shared';

/**
 * The PvP clocks (M10.4): the Arena's UTC day + ISO week (settling the band by
 * Mail) and Ranked's 03:00 day + season (which also advances the region). Lazy —
 * there is no cron, so `LocalServer.normalize` rolls them on every load and the
 * starter save is settled the first time it is opened in a new week.
 * See docs/design/pvp.md.
 */

export interface PvpRollover {
  state: AccountState;
  /** The Arena Rewards letter written on a week turn (null when nothing turned). */
  letter: MailItem | null;
  /** What the settlement paid (null when the week had not turned). */
  settlement: ArenaSettlement | null;
}

/** The Arena Rewards letter for the week that just ended. */
function settlementMail(config: GameConfig, weekKeyEnded: string, settlement: ArenaSettlement, now: number): MailItem {
  return createMail({
    id: `mail_arena_${weekKeyEnded}`,
    subjectKey: 'mail.arena.subject',
    bodyKey: 'mail.arena.body',
    grants: settlement.reward,
    createdAt: now,
    ttlMs: Math.round(config.economy.mailTtlHours * 3_600_000),
  });
}

/**
 * Roll every PvP clock to `now`. Returns the input state unchanged (same object)
 * when nothing turned, so callers can treat identity as "no write needed".
 */
export function rollPvp(config: GameConfig, state: AccountState, now: number): PvpRollover {
  const day = dayKey(now);
  const week = weekKey(now);
  const arena = rollArenaDay(state.pvp.arena, day);
  const settled = applyWeeklySettlement(arena, week, arenaTuning(config).bands);
  const ranked = rollRankedSeason(
    rollRankedDay(state.pvp.ranked, rankedDayKey(now)),
    seasonKey(now),
    rankedTuning(config).phases.length,
  );

  if (settled.state === state.pvp.arena && ranked === state.pvp.ranked) {
    return { state, letter: null, settlement: null };
  }

  const letters: MailItem[] = [];
  if (settled.settlement) {
    // The id carries the week that ended, so re-settling can never duplicate it.
    const letter = settlementMail(config, state.pvp.arena.weekKey, settled.settlement, now);
    if (!state.mail.some((m) => m.id === letter.id)) letters.push(letter);
  }

  return {
    state: {
      ...state,
      pvp: { arena: settled.state, ranked },
      ...(letters.length > 0 ? { mail: [...state.mail, ...letters] } : {}),
    },
    letter: letters[0] ?? null,
    settlement: settled.settlement,
  };
}
