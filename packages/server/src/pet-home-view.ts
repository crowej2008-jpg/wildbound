import {
  dayKey,
  exploreAccess,
  homeIncomePerMinute,
  homeLevelForXp,
  levelRule,
  mergeCapFor,
  nextUtcMidnight,
  shopOffers,
  shopRefreshCost,
  shopRule,
  summonCost,
  tileActive,
  type AccountState,
  type ExploreGateStatus,
  type PetHomeOfferRule,
  type PetHomePetState,
  type Rewards,
} from '@wildbound/engine';
import type { GameConfig } from './config';

/** Display-ready Pet Home view (M13.1). Pure reads; no reward claims happen here. */

export interface PetHomePetView {
  id: string;
  /** Hidden until the ball is opened. */
  speciesId: string | null;
  name: string | null;
  level: number;
  tileId: number;
  opened: boolean;
}

export interface PetHomeTileView {
  id: number;
  row: number;
  col: number;
  unlockLevel: number;
  locked: boolean;
  revealed: boolean;
  active: boolean;
  /** Gems to open a revealed padlock; 0 when no payment is needed. */
  unlockGems: number;
  pet: PetHomePetView | null;
}

export interface PetHomeLevelRewardView {
  level: number;
  reward: Rewards;
  claimed: boolean;
  claimable: boolean;
}

export interface PetHomeShopOfferView {
  id: string;
  name: string;
  description: string;
  price: number;
  grants: Rewards;
  bought: boolean;
  affordable: boolean;
}

export interface PetHomeShopView {
  id: 'home' | 'deluxe';
  name: string;
  currency: 'homeCoin' | 'orbEssence';
  unlockLevel: number;
  unlocked: boolean;
  balance: number;
  offers: PetHomeShopOfferView[];
  refreshesLeft: number;
  refreshCost: number | null;
  nextResetMs: number;
}

export interface PetHomeAlbumEntryView {
  id: string;
  name: string;
  seen: boolean;
}

export interface PetHomeView {
  unlocked: boolean;
  gates: ExploreGateStatus[];
  homeLevel: number;
  homeXp: number;
  xpIntoLevel: number;
  xpForNext: number | null;
  progress: number;
  tiles: PetHomeTileView[];
  pets: PetHomePetView[];
  freeTiles: number;
  mergeCap: number;
  incomePerMinute: number;
  settlementMinutes: number;
  offlineHours: number;
  homeCoin: number;
  freeSummonsLeft: number;
  paidSummonsUsed: number;
  nextSummonCost: number;
  levelRewards: PetHomeLevelRewardView[];
  albumNote: string;
  album: PetHomeAlbumEntryView[];
  shops: PetHomeShopView[];
  nextResetMs: number;
}

function petView(config: GameConfig, pet: PetHomePetState): PetHomePetView {
  const meta = config.species.get(pet.speciesId);
  return {
    id: pet.id,
    speciesId: pet.opened ? pet.speciesId : null,
    name: pet.opened ? (meta?.name ?? pet.speciesId) : null,
    level: pet.level,
    tileId: pet.tileId,
    opened: pet.opened,
  };
}

function shopView(
  config: GameConfig,
  state: AccountState,
  now: number,
  shopId: 'home' | 'deluxe',
  level: number,
): PetHomeShopView {
  const shop = shopRule(config.petHome, shopId);
  const unlocked = level >= shop.unlockLevel;
  const offers: PetHomeOfferRule[] = unlocked
    ? shopOffers(shop, level, state.petHome.shopDay, state.petHome.shopRefreshes)
    : [];
  const bought = new Set(state.petHome.shopBought);
  const refreshesLeft = Math.max(0, shop.refresh.maxPerDay - state.petHome.shopRefreshes);
  const balance = state.currencies[shop.currency] ?? 0;
  return {
    id: shop.id,
    name: shop.name,
    currency: shop.currency,
    unlockLevel: shop.unlockLevel,
    unlocked,
    balance,
    offers: offers.map((offer) => ({
      id: offer.id,
      name: offer.name,
      description: offer.description,
      price: offer.price,
      grants: offer.grants,
      bought: bought.has(offer.id),
      affordable: balance >= offer.price,
    })),
    refreshesLeft,
    refreshCost: refreshesLeft > 0 ? shopRefreshCost(shop, state.petHome.shopRefreshes) : null,
    nextResetMs: nextUtcMidnight(now) - now,
  };
}

export function buildPetHomeView(config: GameConfig, state: AccountState, now: number): PetHomeView {
  const home = state.petHome;
  const level = homeLevelForXp(config.petHome, home.xp);
  const current = levelRule(config.petHome, level);
  const next = config.petHome.levels.find((row) => row.level === level + 1) ?? null;
  const pets = home.pets.map((pet) => petView(config, pet));
  const petByTile = new Map(home.pets.map((pet) => [pet.tileId, pet]));
  const tiles: PetHomeTileView[] = config.petHome.tiles.map((tile) => {
    const active = tileActive(tile, level, home.unlockedTiles);
    const pet = petByTile.get(tile.id);
    return {
      id: tile.id,
      row: tile.row,
      col: tile.col,
      unlockLevel: tile.unlockLevel,
      locked: tile.locked,
      revealed: tile.unlockLevel <= level,
      active,
      unlockGems: tile.locked && !active && tile.unlockLevel <= level ? current.unlockGems : 0,
      pet: pet ? petView(config, pet) : null,
    };
  });
  const mode = config.explore.modes.find((candidate) => candidate.id === 'pet-home');
  const access = mode
    ? exploreAccess(mode.gates, {
        campaign: state.campaign,
        level: state.profile.level,
        serverDay: Math.floor((now - state.serverEpoch) / 86_400_000) + 1,
      })
    : { unlocked: false, gates: [] };
  const freeSummonsLeft = Math.max(0, config.petHome.home.freeSummonsPerDay - home.freeSummonsUsed);
  const album = [...config.species.keys()].sort().map((id) => ({
    id,
    name: config.species.get(id)?.name ?? id,
    seen: home.album.includes(id),
  }));
  return {
    unlocked: access.unlocked,
    gates: access.gates,
    homeLevel: level,
    homeXp: home.xp,
    xpIntoLevel: home.xp - current.xp,
    xpForNext: next ? next.xp - current.xp : null,
    progress: next ? Math.min(1, Math.max(0, (home.xp - current.xp) / (next.xp - current.xp))) : 1,
    tiles,
    pets,
    freeTiles: tiles.filter((tile) => tile.active && !tile.pet).length,
    mergeCap: mergeCapFor(config.petHome, level),
    incomePerMinute: homeIncomePerMinute(config.petHome, home.pets),
    settlementMinutes: Math.round(config.petHome.home.tickSeconds / 60),
    offlineHours: config.petHome.home.offlineHours,
    homeCoin: state.currencies.homeCoin,
    freeSummonsLeft,
    paidSummonsUsed: home.paidSummonsUsed,
    nextSummonCost: summonCost(config.petHome, home.freeSummonsUsed, home.paidSummonsUsed),
    levelRewards: config.petHome.levels
      .filter((row) => row.level > 0)
      .map((row) => ({
        level: row.level,
        reward: row.reward,
        claimed: home.levelClaims.includes(row.level),
        claimable: row.level <= level && !home.levelClaims.includes(row.level),
      })),
    albumNote: config.petHome.albumNote,
    album,
    shops: [shopView(config, state, now, 'home', level), shopView(config, state, now, 'deluxe', level)],
    nextResetMs: nextUtcMidnight(now) - now,
  };
}

/** A server-side action helper: the mode must be open before any write. */
export function petHomeGate(config: GameConfig, state: AccountState, now: number): ExploreGateStatus[] | null {
  const mode = config.explore.modes.find((candidate) => candidate.id === 'pet-home');
  if (!mode) return null;
  const access = exploreAccess(mode.gates, {
    campaign: state.campaign,
    level: state.profile.level,
    serverDay: Math.floor((now - state.serverEpoch) / 86_400_000) + 1,
  });
  return access.unlocked ? access.gates : null;
}

export function petHomeDay(state: AccountState, now: number): string {
  return dayKey(now);
}
