import { arenaRank, type AccountState } from '@wildbound/engine';
import type { GameConfig } from './config';
import { arenaTuning, arenaUnlocked, rankedPhase, rankedTuning, rankedUnlocked } from './pvp';
import { rolledRanked } from './pvp/ranked';

/**
 * The PvP hub (M10.5): one card per PvP entry point with its live status. The
 * cards carry structured numbers, never prose — the client owns every label, so
 * the view stays localisable. See docs/design/pvp.md.
 */

export type PvpHubId = 'arena' | 'ranked' | 'clash' | 'championship' | 'temple' | 'shop';

/** The numbers each live card shows; `locked`/`comingLater` carry none. */
export type PvpHubStatus =
  | { kind: 'arena'; credits: number; place: number; attemptsLeft: number; attemptsPerDay: number }
  | { kind: 'ranked'; region: string; tier: string; score: number; attemptsLeft: number; attemptsPerDay: number }
  | { kind: 'shop'; tokens: number }
  | { kind: 'locked'; chapter: number }
  | { kind: 'comingLater' };

export interface PvpHubCardView {
  id: PvpHubId;
  /** The client route, or null for a declared "coming later" mode. */
  route: string | null;
  /** False for a declared "coming later" mode (listed in docs/SCOPE.md). */
  live: boolean;
  unlocked: boolean;
  status: PvpHubStatus;
}

export interface PvpHubView {
  cards: PvpHubCardView[];
}

/** Modes the reference ships that are still pending (M17) — honest, not dead. */
const PENDING: readonly PvpHubId[] = ['clash', 'championship', 'temple'];

export function buildPvpHubView(config: GameConfig, state: AccountState, now: number): PvpHubView {
  const arena = state.pvp.arena;
  const ranked = rolledRanked(config, state, now);
  const arenaOpen = arenaUnlocked(config, state);
  const rankedOpen = rankedUnlocked(config, state);
  const arenaRules = arenaTuning(config);
  const rankedRules = rankedTuning(config);
  const tier = rankedRules.tiers[ranked.tier]?.name ?? '';
  const phase = rankedPhase(config, ranked);

  const cards: PvpHubCardView[] = [
    {
      id: 'arena',
      route: '/arena',
      live: true,
      unlocked: arenaOpen,
      status: arenaOpen
        ? {
            kind: 'arena',
            credits: arena.credits,
            place: arenaRank(arena.credits, arenaRules.bands),
            attemptsLeft: Math.max(0, arenaRules.freeAttemptsPerDay + arena.bought - arena.attempts),
            attemptsPerDay: arenaRules.freeAttemptsPerDay,
          }
        : { kind: 'locked', chapter: config.pvp.arenaChapter },
    },
    {
      id: 'ranked',
      route: '/ranked',
      live: true,
      unlocked: rankedOpen,
      status: rankedOpen
        ? {
            kind: 'ranked',
            region: phase.name,
            tier,
            score: ranked.score,
            attemptsLeft: Math.max(0, rankedRules.freeAttemptsPerDay + ranked.bought - ranked.attempts),
            attemptsPerDay: rankedRules.freeAttemptsPerDay,
          }
        : { kind: 'locked', chapter: config.pvp.rankedChapter },
    },
    ...PENDING.map(
      (id): PvpHubCardView => ({ id, route: null, live: false, unlocked: false, status: { kind: 'comingLater' } }),
    ),
    {
      id: 'shop',
      route: '/shop',
      live: true,
      unlocked: true,
      status: { kind: 'shop', tokens: state.currencies.arenaToken },
    },
  ];
  return { cards };
}
