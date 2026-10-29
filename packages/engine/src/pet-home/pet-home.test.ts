import { describe, expect, it } from 'vitest';
import {
  boardIncomePerFiveSeconds,
  claimLevelReward,
  homeIncomePerMinute,
  homeLevelForXp,
  initialPetHome,
  mergeCapFor,
  mergePets,
  openPet,
  settlePetHome,
  shopOffers,
  shopRefreshCost,
  summonCost,
  summonPet,
  tileActive,
  unlockTile,
  type PetHomeOfferRule,
  type PetHomeRules,
} from './index';

const DAY = '2026-10-28';
const NOW = Date.UTC(2026, 9, 28);

const xpRows = [0, 200, 550, 1000, 2500, 6000, 10000, 15000, 22000, 32000, 45000, 60000, 80000, 105000, 135000, 170000, 220000];
const tileCounts = [6, 6, 7, 8, 10, 11, 11, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21];
const mergeCaps = [8, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 12, 13, 14, 15, 16];
const unlockLevels = [0, 0, 0, 0, 0, 0, 2, 3, 4, 4, 5, 8, 9, 10, 11, 12, 13, 14, 14, 15, 16];

function offer(shop: string, index: number): PetHomeOfferRule {
  return {
    id: `${shop}-${index}`,
    name: `Offer ${index}`,
    description: 'A test offer.',
    price: 100 + index,
    grants: { homeCoin: 1 },
  };
}

const rules: PetHomeRules = {
  albumNote: 'test',
  home: {
    offlineHours: 8,
    tickSeconds: 300,
    freeSummonsPerDay: 50,
    summonCosts: [
      { afterPaid: 0, gems: 10 },
      { afterPaid: 50, gems: 30 },
      { afterPaid: 100, gems: 80 },
    ],
  },
  levels: xpRows.map((xp, level) => ({
    level,
    xp,
    tiles: tileCounts[level]!,
    mergeCap: mergeCaps[level]!,
    unlockGems: level < 5 ? 20 : 60,
    reward: level > 0 ? { gems: 10 } : {},
  })),
  tiles: unlockLevels.map((unlockLevel, id) => ({
    id,
    row: Math.floor(id / 5),
    col: id % 5,
    unlockLevel,
    locked: id >= 6 && id !== 8 && id !== 9,
  })),
  income: Array.from({ length: 16 }, (_, index) => ({ level: index + 1, coinsPerFiveSeconds: index + 3 })),
  shops: {
    home: {
      id: 'home',
      name: 'Home',
      currency: 'homeCoin',
      unlockLevel: 0,
      offersPerPage: 9,
      refresh: { maxPerDay: 30, costs: [{ afterRefreshes: 0, gems: 40 }, { afterRefreshes: 10, gems: 80 }] },
      bands: [{ minLevel: 0, offers: Array.from({ length: 12 }, (_, index) => offer('home', index)) }],
    },
    deluxe: {
      id: 'deluxe',
      name: 'Deluxe',
      currency: 'orbEssence',
      unlockLevel: 10,
      offersPerPage: 9,
      refresh: { maxPerDay: 30, costs: [{ afterRefreshes: 0, gems: 40 }, { afterRefreshes: 10, gems: 80 }] },
      bands: [{ minLevel: 10, offers: Array.from({ length: 12 }, (_, index) => offer('deluxe', index)) }],
    },
  },
};

function state() {
  return initialPetHome(NOW, DAY);
}

describe('Pet Home rules', () => {
  it('derives the Home level and merge cap from XP', () => {
    expect(homeLevelForXp(rules, 0)).toBe(0);
    expect(homeLevelForXp(rules, 200)).toBe(1);
    expect(homeLevelForXp(rules, 219_999)).toBe(15);
    expect(homeLevelForXp(rules, 220_000)).toBe(16);
    expect(mergeCapFor(rules, 0)).toBe(8);
    expect(mergeCapFor(rules, 16)).toBe(16);
  });

  it('summons a hidden ball, opens it for XP, and merges equal levels', () => {
    const summoned = summonPet(state(), 'ninetales', 0, NOW);
    expect(summoned.pet.opened).toBe(false);
    const opened = openPet(summoned.state, summoned.pet.id);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.state.xp).toBe(10);
    expect(opened.state.album).toEqual(['ninetales']);

    const second = summonPet(opened.state, 'charizard', 1, NOW);
    const secondOpen = openPet(second.state, second.pet.id);
    expect(secondOpen.ok).toBe(true);
    if (!secondOpen.ok) return;
    const merged = mergePets(rules, secondOpen.state, summoned.pet.id, second.pet.id);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.state.pets).toHaveLength(1);
    expect(merged.state.pets[0]?.level).toBe(2);
    expect(merged.state.xp).toBe(30);
  });

  it('refuses merges above the current Home cap', () => {
    const capped = {
      ...state(),
      pets: [
        { id: 'a', speciesId: 'ninetales', level: 8, tileId: 0, opened: true, createdAt: NOW },
        { id: 'b', speciesId: 'charizard', level: 8, tileId: 1, opened: true, createdAt: NOW },
      ],
    };
    expect(mergePets(rules, capped, 'a', 'b').ok).toBe(false);

    const uncapped = { ...capped, xp: rules.levels[4]!.xp };
    const merged = mergePets(rules, uncapped, 'a', 'b');
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.state.pets[0]?.level).toBe(9);
  });

  it('settles whole five-minute ticks, preserves remainders and caps offline time', () => {
    const summoned = summonPet(state(), 'ninetales', 0, NOW);
    const opened = openPet(summoned.state, summoned.pet.id);
    if (!opened.ok) throw new Error('open failed');
    const before = boardIncomePerFiveSeconds(rules, opened.state.pets);
    expect(before).toBeGreaterThan(0);
    expect(homeIncomePerMinute(rules, opened.state.pets)).toBe(before * 12);

    const partial = settlePetHome(rules, opened.state, NOW + 4 * 60_000);
    expect(partial.coins).toBe(0);
    const perTick = before * (rules.home.tickSeconds / 5);
    const tick = settlePetHome(rules, opened.state, NOW + 5 * 60_000);
    expect(tick.coins).toBe(perTick);
    expect(tick.state.lastSettledAt).toBe(NOW + 5 * 60_000);

    const capped = settlePetHome(rules, opened.state, NOW + 20 * 60 * 60_000);
    expect(capped.coins).toBe(perTick * 96);

    // Time beyond the 8h cap is dropped, not carried into the next tick.
    const late = settlePetHome(rules, opened.state, NOW + 20 * 60 * 60_000 + 4 * 60_000);
    expect(late.coins).toBe(perTick * 96);
    expect(settlePetHome(rules, late.state, NOW + 20 * 60 * 60_000 + 5 * 60_000).coins).toBe(0);
  });

  it('unlocks revealed padlocks, claims level rewards once, and prices paid summons', () => {
    const locked = rules.tiles.find((tile) => tile.locked)!;
    const early = unlockTile(rules, state(), locked.id);
    expect(early.ok).toBe(false);

    const atLevel = { ...state(), xp: rules.levels.find((row) => row.level === locked.unlockLevel)!.xp };
    const unlocked = unlockTile(rules, atLevel, locked.id);
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) return;
    expect(tileActive(locked, locked.unlockLevel, unlocked.state.unlockedTiles)).toBe(true);
    expect(unlocked.cost).toBe(rules.levels[locked.unlockLevel]!.unlockGems);

    expect(claimLevelReward(rules, atLevel, 0).ok).toBe(false);
    const claimed = claimLevelReward(rules, atLevel, locked.unlockLevel);
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    const again = claimLevelReward(rules, claimed.state, locked.unlockLevel);
    expect(again.ok).toBe(false);

    expect(summonCost(rules, 0, 0)).toBe(0);
    expect(summonCost(rules, 50, 0)).toBe(rules.home.summonCosts[0]!.gems);
    expect(summonCost(rules, 50, 50)).toBe(rules.home.summonCosts[1]!.gems);
  });

  it('shows nine deterministic shop offers and moves the page on refresh', () => {
    const shop = rules.shops.home;
    const first = shopOffers(shop, 0, DAY, 0);
    const again = shopOffers(shop, 0, DAY, 0);
    const refreshed = shopOffers(shop, 0, DAY, 1);
    expect(first).toHaveLength(9);
    expect(first.map((offer) => offer.id)).toEqual(again.map((offer) => offer.id));
    expect(first.map((offer) => offer.id)).not.toEqual(refreshed.map((offer) => offer.id));
    expect(shopOffers(rules.shops.deluxe, 9, DAY, 0)).toHaveLength(0);
    expect(shopOffers(rules.shops.deluxe, 10, DAY, 0)).toHaveLength(9);
    expect(shopRefreshCost(shop, 0)).toBe(40);
    expect(shopRefreshCost(shop, 10)).toBe(80);
  });
});
