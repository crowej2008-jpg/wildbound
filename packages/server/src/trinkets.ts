import type { AccountState, TrinketDef } from '@wildbound/engine';
import type { GameConfig } from './config';
import { pay } from './equipment';
import { statLineText } from './gear-text';
import { fail, ok, type Result } from './index';

/**
 * R6b: the source's exclusive trinkets (hero_weapon / hero_weapon_cost). One per holder species, levels
 * 0–40; the level is keyed by species, so every copy shares it. Each level costs Star Shards, and levels
 * 9 / 19 / 29 / 39 also the holder's own item. Opens when the account has 6 Pokémon at Lv 220 and this
 * Pokémon is at 7★ (kb/exclusive-trinkets.md). Starmie, Ninetales and the Origins have none here (the
 * Origins' trinket follows its synergy Pokémon — it waits for the synergy system). Skills: R6b part 2.
 */

export interface TrinketCostView {
  starShard: number;
  item: number;
  itemName: string;
  haveItem: number;
}

export interface TrinketView {
  /** False when the species has no trinket in the source. */
  available: boolean;
  name: string;
  speciesId: string;
  level: number;
  maxLevel: number;
  /** The level whose lines are shown (current, or the next one). */
  shownLevel: number;
  linesText: string[];
  /** True when the lines describe the next level instead of the current one. */
  linesAreNext: boolean;
  /** Price of the next level; null at the cap. */
  cost: TrinketCostView | null;
  /** Why it cannot be levelled yet (null = open). */
  locked: { reason: 'roster'; count: number; level: number } | { reason: 'stars'; stars: number } | null;
}

export function trinketLevel(state: AccountState, speciesId: string): number {
  return Math.max(0, Math.floor(state.trinkets[speciesId] ?? 0));
}

export function trinketOf(config: GameConfig, speciesId: string): TrinketDef | undefined {
  return config.equipment.trinkets.find((t) => t.speciesId === speciesId);
}

/** Price of `level` → `level + 1`, or null at the cap. */
export function trinketCost(def: TrinketDef, level: number): { starShard: number; item: number } | null {
  return def.levels[level]?.cost ?? null;
}

export function trinketLock(config: GameConfig, state: AccountState, wild: { stars: number }): TrinketView['locked'] {
  const { rosterCount, rosterLevel, stars } = config.equipment.trinketRules.unlock;
  if (state.roster.filter((w) => w.level >= rosterLevel).length < rosterCount) {
    return { reason: 'roster', count: rosterCount, level: rosterLevel };
  }
  if (wild.stars < stars) return { reason: 'stars', stars };
  return null;
}

export function buildTrinketView(
  config: GameConfig,
  state: AccountState,
  wild: { speciesId: string; stars: number },
): TrinketView {
  const def = trinketOf(config, wild.speciesId);
  const maxLevel = def ? def.levels.length - 1 : config.equipment.trinketRules.maxLevel;
  const level = Math.min(trinketLevel(state, wild.speciesId), maxLevel);
  const atMax = level >= maxLevel;
  const shownLevel = atMax ? maxLevel : level + 1;
  const cost = def ? trinketCost(def, level) : null;
  return {
    available: !!def,
    name: def?.name ?? '',
    speciesId: wild.speciesId,
    level,
    maxLevel,
    shownLevel,
    linesText: (def?.levels[shownLevel]?.lines ?? []).map((line) => statLineText(line, 1)),
    linesAreNext: !atMax,
    cost:
      def && cost
        ? { ...cost, itemName: def.item.name, haveItem: state.trinketItems?.[wild.speciesId] ?? 0 }
        : null,
    locked: def ? trinketLock(config, state, wild) : null,
  };
}

export function upgradeTrinketAction(
  config: GameConfig,
  state: AccountState,
  wildId: string,
): Result<AccountState> {
  const wild = state.roster.find((w) => w.id === wildId);
  if (!wild) return fail('not_found', `no Wild ${wildId}`);
  const def = trinketOf(config, wild.speciesId);
  if (!def) return fail('not_found', `no trinket for species ${wild.speciesId}`);
  const lock = trinketLock(config, state, wild);
  if (lock) {
    return fail(
      'resource_locked',
      lock.reason === 'roster'
        ? `needs ${lock.count} Pokémon at Lv ${lock.level}`
        : `needs this Pokémon at ${lock.stars}★`,
    );
  }
  const level = trinketLevel(state, wild.speciesId);
  const cost = trinketCost(def, level);
  if (!cost) return fail('at_level_cap', 'max trinket level');
  const have = state.trinketItems?.[wild.speciesId] ?? 0;
  if (have < cost.item) return fail('insufficient_items', `not enough ${def.item.name}`);
  const paid = pay(state, { starShard: cost.starShard });
  if (!paid) return fail('insufficient_items', 'not enough Star Shards');
  return ok({
    ...paid,
    trinketItems: cost.item ? { ...state.trinketItems, [wild.speciesId]: have - cost.item } : state.trinketItems,
    trinkets: { ...state.trinkets, [wild.speciesId]: level + 1 },
  });
}

/** Debug / reward grant of a holder's own trinket item. */
export function grantTrinketItem(state: AccountState, speciesId: string, amount: number): AccountState {
  return { ...state, trinketItems: { ...state.trinketItems, [speciesId]: (state.trinketItems?.[speciesId] ?? 0) + amount } };
}
