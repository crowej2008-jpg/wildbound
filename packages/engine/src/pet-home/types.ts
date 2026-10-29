import type { Rewards } from '../economy/rewards';

/** Persistent Pet Home state (M13.1). The source is a merge board; this is ours. */

export interface PetHomePetState {
  id: string;
  speciesId: string;
  /** Merge level, 1-16. A ball's level is hidden until opened. */
  level: number;
  /** Tile id in the 5x5 board layout. */
  tileId: number;
  /** False while the tile still holds an unopened ball. */
  opened: boolean;
  createdAt: number;
}

export interface PetHomeState {
  /** Lifetime Home XP; the Home level is derived from it. */
  xp: number;
  /** Padlocked tiles the player has bought. Free tiles are never stored here. */
  unlockedTiles: number[];
  pets: PetHomePetState[];
  nextPetSeq: number;
  lastSettledAt: number;
  summonDay: string;
  freeSummonsUsed: number;
  paidSummonsUsed: number;
  /** Home-level rewards already claimed. */
  levelClaims: number[];
  /** Species ids ever opened in this Home. */
  album: string[];
  shopDay: string;
  shopRefreshes: number;
  /** Offer ids bought in the current shop page. */
  shopBought: string[];
}

export function initialPetHome(now: number, day: string): PetHomeState {
  return {
    xp: 0,
    unlockedTiles: [],
    pets: [],
    nextPetSeq: 1,
    lastSettledAt: now,
    summonDay: day,
    freeSummonsUsed: 0,
    paidSummonsUsed: 0,
    levelClaims: [],
    album: [],
    shopDay: day,
    shopRefreshes: 0,
    shopBought: [],
  };
}

/** Rules the engine needs; content JSON is structurally compatible. */
export interface PetHomeLevelRule {
  level: number;
  xp: number;
  tiles: number;
  mergeCap: number;
  unlockGems: number;
  reward: Rewards;
}

export interface PetHomeTileRule {
  id: number;
  row: number;
  col: number;
  unlockLevel: number;
  locked: boolean;
}

export interface PetHomeIncomeRule {
  level: number;
  coinsPerFiveSeconds: number;
}

export interface PetHomeOfferRule {
  id: string;
  name: string;
  description: string;
  price: number;
  grants: Rewards;
}

export interface PetHomeShopRule {
  id: 'home' | 'deluxe';
  name: string;
  currency: 'homeCoin' | 'orbEssence';
  unlockLevel: number;
  offersPerPage: number;
  refresh: {
    maxPerDay: number;
    costs: { afterRefreshes: number; gems: number }[];
  };
  bands: { minLevel: number; offers: PetHomeOfferRule[] }[];
}

export interface PetHomeRules {
  albumNote: string;
  home: {
    offlineHours: number;
    tickSeconds: number;
    freeSummonsPerDay: number;
    summonCosts: { afterPaid: number; gems: number }[];
  };
  levels: PetHomeLevelRule[];
  tiles: PetHomeTileRule[];
  income: PetHomeIncomeRule[];
  shops: { home: PetHomeShopRule; deluxe: PetHomeShopRule };
}
