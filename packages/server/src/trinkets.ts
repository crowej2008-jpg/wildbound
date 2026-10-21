import type { AccountState } from '@wildbound/engine';
import type { GameConfig } from './config';
import { pay } from './equipment';
import { statLineText } from './gear-text';
import { fail, ok, type Result } from './index';

/**
 * M11.8 species-signature trinkets. One per species, levels 0–40, paid with
 * Star Shards. The level is keyed by species id, so every copy of a species
 * shares the same trinket. Shiny variants are cosmetic and deferred.
 */

export interface TrinketView {
  name: string;
  speciesId: string;
  level: number;
  maxLevel: number;
  /** The level whose lines are shown (current, or the next one). */
  shownLevel: number;
  linesText: string[];
  /** True when the lines describe the next level instead of the current one. */
  linesAreNext: boolean;
  /** Star Shards for the next level; null at the cap. */
  cost: number | null;
}

export function trinketLevel(state: AccountState, speciesId: string): number {
  return Math.max(0, Math.floor(state.trinkets[speciesId] ?? 0));
}

/** Star Shards for the next trinket level. */
export function trinketCost(level: number, collection: GameConfig['collection']): number {
  const { shardBase, shardPerLevel } = collection.trinkets;
  return shardBase + Math.max(0, level) * shardPerLevel;
}

export function buildTrinketView(
  config: GameConfig,
  state: AccountState,
  wild: { speciesId: string },
): TrinketView {
  const def = config.equipment.trinkets.find((t) => t.speciesId === wild.speciesId);
  const level = trinketLevel(state, wild.speciesId);
  const maxLevel = config.collection.trinkets.maxLevel;
  const atMax = level >= maxLevel;
  const shownLevel = atMax ? maxLevel : level + 1;
  return {
    name: def?.name ?? `${wild.speciesId} Keepsake`,
    speciesId: wild.speciesId,
    level,
    maxLevel,
    shownLevel,
    linesText: (def?.lines ?? []).map((line) => statLineText(line, shownLevel)),
    linesAreNext: !atMax,
    cost: atMax ? null : trinketCost(level, config.collection),
  };
}

export function upgradeTrinketAction(
  config: GameConfig,
  state: AccountState,
  wildId: string,
): Result<AccountState> {
  const wild = state.roster.find((w) => w.id === wildId);
  if (!wild) return fail('not_found', `no Wild ${wildId}`);
  if (!config.equipment.trinkets.some((t) => t.speciesId === wild.speciesId)) {
    return fail('not_found', `no trinket for species ${wild.speciesId}`);
  }
  const level = trinketLevel(state, wild.speciesId);
  if (level >= config.collection.trinkets.maxLevel) return fail('at_level_cap', 'max trinket level');
  const paid = pay(state, { starShard: trinketCost(level, config.collection) });
  if (!paid) return fail('insufficient_items', 'not enough Star Shards');
  return ok({
    ...paid,
    trinkets: { ...state.trinkets, [wild.speciesId]: level + 1 },
  });
}
