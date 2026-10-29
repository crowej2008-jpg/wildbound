import {
  dayKey,
  homeLevelForXp,
  mergePets as mergeHomePets,
  mulberry32,
  openPet as openHomePet,
  releasePet as releaseHomePet,
  resetPetHomeDay,
  settlePetHome,
  shopOffers,
  shopRefreshCost,
  shopRule,
  summonCost,
  summonPet as createHomePet,
  tileActive,
  unlockTile as unlockHomeTile,
  claimLevelReward,
  type AccountState,
  type PetHomeState,
  type Rewards,
} from '@wildbound/engine';
import type { GameConfig } from './config';
import { applyGrant } from './economy';
import { fail, ok } from './index';
import type { Outcome } from './outcome';
import { petHomeGate } from './pet-home-view';

/**
 * Pet Home server glue (M13.1). The engine owns the merge/income rules; these
 * helpers validate the gate, spend currencies and return a new account state
 * for LocalServer to persist.
 */

export interface PreparedPetHome {
  state: AccountState;
  /** True when the daily reset or passive settlement changed the save. */
  changed: boolean;
  coins: number;
}

/** Reset the daily counters, settle passive Home Coins, and return the new state. */
export function preparePetHome(config: GameConfig, state: AccountState, now: number): PreparedPetHome {
  const day = dayKey(now);
  const reset = resetPetHomeDay(state.petHome, day);
  const settled = settlePetHome(config.petHome, reset, now);
  const coins = settled.coins;
  const changed = settled.state !== state.petHome || coins > 0;
  return {
    state: {
      ...state,
      petHome: settled.state,
      currencies: coins > 0 ? { ...state.currencies, homeCoin: state.currencies.homeCoin + coins } : state.currencies,
    },
    changed,
    coins,
  };
}

function locked(config: GameConfig, state: AccountState, now: number): string | null {
  if (petHomeGate(config, state, now)) return null;
  return 'Pet Home is locked; clear campaign 1-10 first';
}

function withHome(state: AccountState, petHome: PetHomeState, extra?: Partial<AccountState>): AccountState {
  return { ...state, ...extra, petHome };
}

export interface SummonPetOutcome {
  state: AccountState;
  petId: string;
  cost: number;
  free: boolean;
}

export function summonPetAction(
  config: GameConfig,
  state: AccountState,
  now: number,
  tileId?: number,
  seed?: number,
): Outcome<SummonPetOutcome> {
  const prepared = preparePetHome(config, state, now);
  const block = locked(config, prepared.state, now);
  if (block) return fail('resource_locked', block);
  const home = prepared.state.petHome;
  const level = homeLevelForXp(config.petHome, home.xp);
  const active = config.petHome.tiles.filter((tile) => tileActive(tile, level, home.unlockedTiles));
  const occupied = new Set(home.pets.map((pet) => pet.tileId));
  const freeTiles = active.filter((tile) => !occupied.has(tile.id));
  if (freeTiles.length === 0) return fail('invalid_input', 'the Home board is full');

  let tile = freeTiles[0]!;
  if (tileId !== undefined) {
    const chosen = active.find((candidate) => candidate.id === tileId);
    if (!chosen) return fail('invalid_input', 'that tile is not active');
    if (occupied.has(chosen.id)) return fail('invalid_input', 'that tile already holds a Wild');
    tile = chosen;
  }

  const free = home.freeSummonsUsed < config.petHome.home.freeSummonsPerDay;
  const cost = summonCost(config.petHome, home.freeSummonsUsed, home.paidSummonsUsed);
  if (!free && prepared.state.currencies.gems < cost) {
    return fail('insufficient_items', `not enough gems for another summon (${cost})`);
  }
  const ids = [...config.species.keys()].sort();
  if (ids.length === 0) return fail('not_found', 'no species available');
  const rng = typeof seed === 'number' ? mulberry32(seed) : config.rng;
  const speciesId = ids[Math.floor(rng() * ids.length)] ?? ids[0]!;
  const created = createHomePet(home, speciesId, tile.id, now);
  const nextHome: PetHomeState = {
    ...created.state,
    freeSummonsUsed: free ? created.state.freeSummonsUsed + 1 : created.state.freeSummonsUsed,
    paidSummonsUsed: free ? created.state.paidSummonsUsed : created.state.paidSummonsUsed + 1,
  };
  const currencies = free
    ? prepared.state.currencies
    : { ...prepared.state.currencies, gems: prepared.state.currencies.gems - cost };
  return ok({
    state: withHome(prepared.state, nextHome, { currencies }),
    petId: created.pet.id,
    cost: free ? 0 : cost,
    free,
  });
}

function mapError(error: 'not_found' | 'invalid_state' | 'level_cap' | 'tile_locked' | 'already_claimed'): string {
  switch (error) {
    case 'not_found':
      return 'that Pet Home item does not exist';
    case 'level_cap':
      return 'the Home level cap is blocking that merge';
    case 'tile_locked':
      return 'that tile is not available yet';
    case 'already_claimed':
      return 'that level reward was already claimed';
    default:
      return 'that Pet Home action is not valid';
  }
}

export function openPetAction(
  config: GameConfig,
  state: AccountState,
  now: number,
  petId: string,
): Outcome<AccountState> {
  const prepared = preparePetHome(config, state, now);
  const block = locked(config, prepared.state, now);
  if (block) return fail('resource_locked', block);
  const opened = openHomePet(prepared.state.petHome, petId);
  if (!opened.ok) return fail('invalid_input', mapError(opened.error));
  return ok(withHome(prepared.state, opened.state));
}

export function mergePetsAction(
  config: GameConfig,
  state: AccountState,
  now: number,
  sourceId: string,
  targetId: string,
): Outcome<AccountState> {
  const prepared = preparePetHome(config, state, now);
  const block = locked(config, prepared.state, now);
  if (block) return fail('resource_locked', block);
  const merged = mergeHomePets(config.petHome, prepared.state.petHome, sourceId, targetId);
  if (!merged.ok) return fail('invalid_input', mapError(merged.error));
  return ok(withHome(prepared.state, merged.state));
}

export function releasePetAction(
  config: GameConfig,
  state: AccountState,
  now: number,
  petId: string,
): Outcome<AccountState> {
  const prepared = preparePetHome(config, state, now);
  const block = locked(config, prepared.state, now);
  if (block) return fail('resource_locked', block);
  const released = releaseHomePet(prepared.state.petHome, petId);
  if (!released.ok) return fail('invalid_input', mapError(released.error));
  return ok(withHome(prepared.state, released.state));
}

export function unlockTileAction(
  config: GameConfig,
  state: AccountState,
  now: number,
  tileId: number,
): Outcome<{ state: AccountState; cost: number }> {
  const prepared = preparePetHome(config, state, now);
  const block = locked(config, prepared.state, now);
  if (block) return fail('resource_locked', block);
  const unlocked = unlockHomeTile(config.petHome, prepared.state.petHome, tileId);
  if (!unlocked.ok) return fail('invalid_input', mapError(unlocked.error));
  if (prepared.state.currencies.gems < unlocked.cost) {
    return fail('insufficient_items', `not enough gems to open that tile (${unlocked.cost})`);
  }
  return ok({
    state: withHome(prepared.state, unlocked.state, {
      currencies: { ...prepared.state.currencies, gems: prepared.state.currencies.gems - unlocked.cost },
    }),
    cost: unlocked.cost,
  });
}

export function claimLevelAction(
  config: GameConfig,
  state: AccountState,
  now: number,
  level: number,
): Outcome<{ state: AccountState; reward: Rewards }> {
  const prepared = preparePetHome(config, state, now);
  const block = locked(config, prepared.state, now);
  if (block) return fail('resource_locked', block);
  const claimed = claimLevelReward(config.petHome, prepared.state.petHome, level);
  if (!claimed.ok) return fail('invalid_input', mapError(claimed.error));
  const next = applyGrant(config, withHome(prepared.state, claimed.state), claimed.reward);
  return ok({ state: next, reward: claimed.reward });
}

export function buyShopOfferAction(
  config: GameConfig,
  state: AccountState,
  now: number,
  shopId: 'home' | 'deluxe',
  offerId: string,
): Outcome<{ state: AccountState; granted: Rewards }> {
  const prepared = preparePetHome(config, state, now);
  const block = locked(config, prepared.state, now);
  if (block) return fail('resource_locked', block);
  const shop = shopRule(config.petHome, shopId);
  const level = homeLevelForXp(config.petHome, prepared.state.petHome.xp);
  if (level < shop.unlockLevel) return fail('resource_locked', 'that shop is not open yet');
  const offers = shopOffers(shop, level, prepared.state.petHome.shopDay, prepared.state.petHome.shopRefreshes);
  const offer = offers.find((candidate) => candidate.id === offerId);
  if (!offer) return fail('not_found', 'that offer is not on this page');
  if (prepared.state.petHome.shopBought.includes(offer.id)) {
    return fail('invalid_input', 'that offer was already bought');
  }
  if ((prepared.state.currencies[shop.currency] ?? 0) < offer.price) {
    return fail('insufficient_items', `not enough ${shop.currency === 'homeCoin' ? 'Home Coins' : 'Orb Essence'}`);
  }
  const nextHome: PetHomeState = {
    ...prepared.state.petHome,
    shopBought: [...prepared.state.petHome.shopBought, offer.id],
  };
  const paid: AccountState = {
    ...prepared.state,
    currencies: {
      ...prepared.state.currencies,
      [shop.currency]: prepared.state.currencies[shop.currency] - offer.price,
    },
    petHome: nextHome,
  };
  return ok({ state: applyGrant(config, paid, offer.grants), granted: offer.grants });
}

export function refreshShopAction(
  config: GameConfig,
  state: AccountState,
  now: number,
  shopId: 'home' | 'deluxe',
): Outcome<AccountState> {
  const prepared = preparePetHome(config, state, now);
  const block = locked(config, prepared.state, now);
  if (block) return fail('resource_locked', block);
  const shop = shopRule(config.petHome, shopId);
  const level = homeLevelForXp(config.petHome, prepared.state.petHome.xp);
  if (level < shop.unlockLevel) return fail('resource_locked', 'that shop is not open yet');
  const home = prepared.state.petHome;
  if (home.shopRefreshes >= shop.refresh.maxPerDay) {
    return fail('daily_limit', 'no shop refreshes left today');
  }
  const cost = shopRefreshCost(shop, home.shopRefreshes);
  if (prepared.state.currencies.gems < cost) {
    return fail('insufficient_items', `not enough gems to refresh (${cost})`);
  }
  const nextHome: PetHomeState = {
    ...home,
    shopRefreshes: home.shopRefreshes + 1,
    shopBought: home.shopBought.filter((id) => !id.startsWith(`${shop.id}-`)),
  };
  return ok(
    withHome(prepared.state, nextHome, {
      currencies: { ...prepared.state.currencies, gems: prepared.state.currencies.gems - cost },
    }),
  );
}
