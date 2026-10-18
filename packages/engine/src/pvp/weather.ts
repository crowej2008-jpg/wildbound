import type { Faction } from '../model';
import type { WeatherPick, WeatherRule } from './types';

/**
 * Ranked weather (M10, PROMPT §7.7). One faction a phase carries the season's
 * damage bonus; it is a pure function of the season key so the screen and the
 * battle agree. The rotation itself is content (each phase lists its factions).
 * See docs/design/pvp.md.
 */

/** FNV-1a over the season key, so a season always lands on the same slot. */
function seasonSlot(season: string): number {
  let h = 2166136261;
  for (let i = 0; i < season.length; i += 1) {
    h ^= season.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The current and next weather faction for a phase's rotation and a season. */
export function weatherFor(rotation: readonly Faction[], season: string): WeatherPick {
  if (rotation.length === 0) throw new Error('weather rotation is empty');
  const index = seasonSlot(season) % rotation.length;
  return {
    current: rotation[index]!,
    next: rotation[(index + 1) % rotation.length]!,
  };
}

/** The `BattleRules.weather` value for a pick and the mode's damage bonus. */
export function weatherRule(pick: WeatherPick, dmg: number): WeatherRule {
  return { factions: [pick.current], dmg };
}
