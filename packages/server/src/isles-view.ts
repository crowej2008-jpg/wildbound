import type { AccountState, Rewards } from '@wildbound/engine';
import type { GameConfig } from './config';
import { islesOpen, islesRank, islesSeasonDay, prepareIsles } from './isles';

/** Display-ready Clash of Isles view (M14.5). */
export interface IslesView {
  unlocked: boolean;
  seasonDay: boolean;
  attempts: number;
  vouchers: number;
  power: number;
  fatigue: number;
  points: number;
  rank: number;
  held: { id: number; tier: string; tokens: number; pendingMinutes: number } | null;
  islands: { id: number; area: number; tier: string; tokens: number; shields: number; held: boolean }[];
  tasks: { challenges: number; rewards: Rewards; claimed: boolean; ready: boolean }[];
  lastRank: number | null;
  tokens: number;
}

export function buildIslesView(config: GameConfig, state: AccountState, now: number): IslesView {
  const t = config.isles;
  const s = prepareIsles(config, state, now).state;
  const isl = s.isles!;
  const heldIsland = t.islands.find((i) => i.id === isl.held);
  return {
    unlocked: islesOpen(config, state, now),
    seasonDay: islesSeasonDay(now),
    attempts: isl.attempts,
    vouchers: s.currencies.islandVoucher ?? 0,
    power: isl.power,
    fatigue: isl.fatigue,
    points: isl.points,
    rank: islesRank(isl.points, isl.week),
    held: heldIsland ? { id: heldIsland.id, tier: t.tiers[String(heldIsland.tier)] ?? '', tokens: heldIsland.tokens, pendingMinutes: Math.min(Math.floor((now - isl.heldAt) / 60_000), isl.power) } : null,
    islands: t.islands.map((i) => ({ id: i.id, area: i.area, tier: t.tiers[String(i.tier)] ?? '', tokens: i.tokens, shields: isl.shields[String(i.id)] ?? t.cpuShields, held: isl.held === i.id })),
    tasks: t.tasks.map((x) => ({ challenges: x.challenges, rewards: x.rewards as Rewards, claimed: isl.claimed.includes(`task:${x.challenges}`), ready: isl.challengesToday >= x.challenges })),
    lastRank: isl.lastRank,
    tokens: s.currencies.islandCoin ?? 0,
  };
}
