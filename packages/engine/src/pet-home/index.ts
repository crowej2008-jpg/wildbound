import type { Rewards } from '../economy/rewards';
import type {
  PetHomeOfferRule,
  PetHomePetState,
  PetHomeRules,
  PetHomeShopRule,
  PetHomeState,
  PetHomeTileRule,
} from './types';

export * from './types';

/**
 * Pet Home rules (M13.1). Pure functions over the save slice + content rules;
 * the server owns persistence, currency spending and species randomness. See
 * docs/design/pet-home.md.
 */

export type PetHomeError = 'not_found' | 'invalid_state' | 'level_cap' | 'tile_locked' | 'already_claimed';

export function homeLevelForXp(rules: PetHomeRules, xp: number): number {
  let level = 0;
  for (const row of rules.levels) {
    if (xp >= row.xp) level = Math.max(level, row.level);
  }
  return level;
}

export function levelRule(rules: PetHomeRules, level: number): PetHomeRules['levels'][number] {
  return rules.levels.find((row) => row.level === level) ?? rules.levels[0]!;
}

export function mergeCapFor(rules: PetHomeRules, level: number): number {
  return levelRule(rules, level).mergeCap;
}

export function tileRevealed(tile: PetHomeTileRule, level: number): boolean {
  return tile.unlockLevel <= level;
}

export function tileActive(tile: PetHomeTileRule, level: number, unlockedTiles: readonly number[]): boolean {
  if (!tileRevealed(tile, level)) return false;
  return !tile.locked || unlockedTiles.includes(tile.id);
}

export function revealedTiles(rules: PetHomeRules, level: number): PetHomeTileRule[] {
  return rules.tiles.filter((tile) => tileRevealed(tile, level));
}

export function boardIncomePerFiveSeconds(rules: PetHomeRules, pets: readonly PetHomePetState[]): number {
  const byLevel = new Map(rules.income.map((row) => [row.level, row.coinsPerFiveSeconds]));
  return pets.reduce((sum, pet) => (pet.opened ? sum + (byLevel.get(pet.level) ?? 0) : sum), 0);
}

export function homeIncomePerMinute(rules: PetHomeRules, pets: readonly PetHomePetState[]): number {
  // The income tables are per 5 seconds; the board settles every 5 minutes.
  return boardIncomePerFiveSeconds(rules, pets) * 12;
}

export function summonCost(rules: PetHomeRules, freeUsed: number, paidUsed: number): number {
  if (freeUsed < rules.home.freeSummonsPerDay) return 0;
  let cost = rules.home.summonCosts[0]?.gems ?? 0;
  for (const bracket of rules.home.summonCosts) {
    if (paidUsed >= bracket.afterPaid) cost = bracket.gems;
  }
  return cost;
}

export function shopRule(rules: PetHomeRules, id: 'home' | 'deluxe'): PetHomeShopRule {
  return rules.shops[id];
}

export function shopBand(shop: PetHomeShopRule, level: number): PetHomeShopRule['bands'][number] | null {
  if (level < shop.unlockLevel) return null;
  let chosen: PetHomeShopRule['bands'][number] | null = null;
  for (const band of shop.bands) {
    if (level >= band.minLevel) chosen = band;
  }
  return chosen;
}

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** The nine offers shown for a Home level/day/refresh count. Deterministic. */
export function shopOffers(
  shop: PetHomeShopRule,
  level: number,
  day: string,
  refreshes: number,
): PetHomeOfferRule[] {
  const band = shopBand(shop, level);
  if (!band) return [];
  const pool = band.offers;
  if (pool.length === 0) return [];
  const count = Math.min(shop.offersPerPage, pool.length);
  const offset = stableHash(`${shop.id}:${day}:${refreshes}`) % pool.length;
  return Array.from({ length: count }, (_, index) => pool[(offset + index) % pool.length]!);
}

export function shopRefreshCost(shop: PetHomeShopRule, refreshes: number): number {
  let cost = shop.refresh.costs[0]?.gems ?? 0;
  for (const bracket of shop.refresh.costs) {
    if (refreshes >= bracket.afterRefreshes) cost = bracket.gems;
  }
  return cost;
}

export function resetPetHomeDay(state: PetHomeState, day: string): PetHomeState {
  let next = state;
  if (state.summonDay !== day) {
    next = { ...next, summonDay: day, freeSummonsUsed: 0, paidSummonsUsed: 0 };
  }
  if (state.shopDay !== day) {
    next = { ...next, shopDay: day, shopRefreshes: 0, shopBought: [] };
  }
  return next;
}

export interface PetHomeSettlement {
  state: PetHomeState;
  coins: number;
}

/**
 * Credit whole settlement ticks since `lastSettledAt`, capped at the offline
 * window. Any partial tick is preserved; time beyond the cap is dropped.
 */
export function settlePetHome(rules: PetHomeRules, state: PetHomeState, now: number): PetHomeSettlement {
  if (!Number.isFinite(now)) return { state, coins: 0 };
  const elapsed = Math.max(0, now - state.lastSettledAt);
  const tickMs = Math.max(1, rules.home.tickSeconds * 1000);
  const capMs = Math.max(0, rules.home.offlineHours * 3_600_000);
  const credited = Math.min(elapsed, capMs);
  const ticks = Math.floor(credited / tickMs);
  if (ticks <= 0) return { state, coins: 0 };
  // Each 5-minute settlement pays the 5-second income sixty times over.
  const perTick = boardIncomePerFiveSeconds(rules, state.pets) * (rules.home.tickSeconds / 5);
  const coins = Math.floor(ticks * perTick);
  return {
    state: { ...state, lastSettledAt: now - (credited % tickMs) },
    coins,
  };
}

export function summonPet(
  state: PetHomeState,
  speciesId: string,
  tileId: number,
  now: number,
): { state: PetHomeState; pet: PetHomePetState } {
  const pet: PetHomePetState = {
    id: `p${state.nextPetSeq}`,
    speciesId,
    level: 1,
    tileId,
    opened: false,
    createdAt: now,
  };
  return {
    state: {
      ...state,
      pets: [...state.pets, pet],
      nextPetSeq: state.nextPetSeq + 1,
    },
    pet,
  };
}

export function openPet(
  state: PetHomeState,
  petId: string,
): { ok: true; state: PetHomeState; pet: PetHomePetState } | { ok: false; error: PetHomeError } {
  const pet = state.pets.find((candidate) => candidate.id === petId);
  if (!pet) return { ok: false, error: 'not_found' };
  if (pet.opened) return { ok: false, error: 'invalid_state' };
  const opened = { ...pet, opened: true };
  return {
    ok: true,
    pet: opened,
    state: {
      ...state,
      pets: state.pets.map((candidate) => (candidate.id === petId ? opened : candidate)),
      xp: state.xp + 10,
      album: state.album.includes(pet.speciesId) ? state.album : [...state.album, pet.speciesId],
    },
  };
}

export function mergePets(
  rules: PetHomeRules,
  state: PetHomeState,
  sourceId: string,
  targetId: string,
): { ok: true; state: PetHomeState } | { ok: false; error: PetHomeError } {
  if (sourceId === targetId) return { ok: false, error: 'invalid_state' };
  const source = state.pets.find((pet) => pet.id === sourceId);
  const target = state.pets.find((pet) => pet.id === targetId);
  if (!source || !target) return { ok: false, error: 'not_found' };
  if (!source.opened || !target.opened || source.level !== target.level) {
    return { ok: false, error: 'invalid_state' };
  }
  const cap = mergeCapFor(rules, homeLevelForXp(rules, state.xp));
  if (target.level >= cap) return { ok: false, error: 'level_cap' };
  const merged = { ...target, level: target.level + 1 };
  return {
    ok: true,
    state: {
      ...state,
      pets: state.pets
        .filter((pet) => pet.id !== sourceId)
        .map((pet) => (pet.id === targetId ? merged : pet)),
      xp: state.xp + 10,
    },
  };
}

export function releasePet(
  state: PetHomeState,
  petId: string,
): { ok: true; state: PetHomeState } | { ok: false; error: PetHomeError } {
  if (!state.pets.some((pet) => pet.id === petId)) return { ok: false, error: 'not_found' };
  return { ok: true, state: { ...state, pets: state.pets.filter((pet) => pet.id !== petId) } };
}

export function unlockTile(
  rules: PetHomeRules,
  state: PetHomeState,
  tileId: number,
): { ok: true; state: PetHomeState; cost: number } | { ok: false; error: PetHomeError } {
  const tile = rules.tiles.find((candidate) => candidate.id === tileId);
  if (!tile) return { ok: false, error: 'not_found' };
  if (!tile.locked) return { ok: false, error: 'invalid_state' };
  const level = homeLevelForXp(rules, state.xp);
  if (!tileRevealed(tile, level)) return { ok: false, error: 'tile_locked' };
  if (state.unlockedTiles.includes(tile.id)) return { ok: false, error: 'invalid_state' };
  return {
    ok: true,
    cost: levelRule(rules, level).unlockGems,
    state: { ...state, unlockedTiles: [...state.unlockedTiles, tile.id] },
  };
}

export function claimLevelReward(
  rules: PetHomeRules,
  state: PetHomeState,
  level: number,
): { ok: true; state: PetHomeState; reward: Rewards } | { ok: false; error: PetHomeError } {
  const current = homeLevelForXp(rules, state.xp);
  if (level < 1 || level > current) return { ok: false, error: 'invalid_state' };
  if (state.levelClaims.includes(level)) return { ok: false, error: 'already_claimed' };
  return {
    ok: true,
    reward: levelRule(rules, level).reward,
    state: { ...state, levelClaims: [...state.levelClaims, level] },
  };
}
