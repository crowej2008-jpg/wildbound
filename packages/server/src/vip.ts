import type { AccountState } from '@wildbound/engine';
import type { GameConfig } from './config';

/**
 * R8: VIP from the source (packages/content/tuning/vip.json, from vip_priv_json). The level comes from Privilege
 * XP (`privilegeXp`): the source counts top-up Diamonds, but Wildbound sells nothing, so the only Privilege XP is
 * the source's free one — daily activity's top chest pays 60 a day. Perks wired to Wildbound systems: the idle
 * cap and XP Candy / Gold bonus, Quick Combat (quick-collect) a day, and Arena attempt buys. The others (daily
 * dungeon buys, Daily Shop refreshes, bag, Golden Touch, Exclusive Packs) are shown and wait for their systems.
 */

export type VipLevel = GameConfig['vip']['levels'][number];

export interface VipView {
  level: number;
  xp: number;
  next: { level: number; xp: number; remaining: number; progress: number } | null;
  perks: VipLevel;
  /** The highest level this account can browse (source show_over_lev). */
  browseTo: number;
  levels: VipLevel[];
  dailyActivityXp: number;
}

export function vipLevelFor(xp: number, levels: readonly VipLevel[]): VipLevel {
  let found = levels[0]!;
  for (const l of levels) if (xp >= l.xp) found = l;
  return found;
}

export function vipPerks(config: GameConfig, state: AccountState): VipLevel {
  return vipLevelFor(state.currencies.privilegeXp ?? 0, config.vip.levels);
}

/** The idle cap: the VIP level's hours (8 at VIP 0 … 24 at VIP 39+). */
export function vipIdleCapMinutes(config: GameConfig, state: AccountState): number {
  return vipPerks(config, state).idleCapHours * 60;
}

export function buildVipView(config: GameConfig, state: AccountState): VipView {
  const levels = config.vip.levels;
  const xp = state.currencies.privilegeXp ?? 0;
  const current = vipLevelFor(xp, levels);
  const following = levels.find((l) => l.level > current.level && l.xp > xp);
  const span = following ? following.xp - current.xp : 0;
  const browseTo = Math.max(...levels.filter((l) => l.showFrom <= current.level).map((l) => l.level));
  return {
    level: current.level,
    xp,
    next: following
      ? {
          level: following.level,
          xp: following.xp,
          remaining: Math.max(0, following.xp - xp),
          progress: span > 0 ? Math.min(1, Math.max(0, (xp - current.xp) / span)) : 0,
        }
      : null,
    perks: current,
    browseTo,
    levels: levels.filter((l) => l.level <= browseTo),
    dailyActivityXp: config.vip.dailyActivityXp,
  };
}
