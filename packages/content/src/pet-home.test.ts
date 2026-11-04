import { describe, expect, it } from 'vitest';
import { PET_HOME } from './tuning';

describe('Pet Home content', () => {
  it('ships 17 Home levels, 21 tiles and 16 merge-income rows', () => {
    expect(PET_HOME.levels.map((row) => row.level)).toEqual(
      Array.from({ length: 17 }, (_, index) => index),
    );
    expect(PET_HOME.tiles).toHaveLength(21);
    expect(PET_HOME.income.map((row) => row.level)).toEqual(
      Array.from({ length: 16 }, (_, index) => index + 1),
    );
    expect(PET_HOME.levels[0]?.tiles).toBe(6);
    expect(PET_HOME.levels[16]?.tiles).toBe(21);
    expect(PET_HOME.levels[0]?.mergeCap).toBe(8);
    expect(PET_HOME.levels[16]?.mergeCap).toBe(16);
    for (let index = 1; index < PET_HOME.income.length; index += 1) {
      expect(PET_HOME.income[index]?.coinsPerFiveSeconds).toBe(
        PET_HOME.income[index - 1]!.coinsPerFiveSeconds * 2,
      );
    }
  });

  it('reveals exactly the tile count at every Home level', () => {
    for (const level of PET_HOME.levels) {
      const revealed = PET_HOME.tiles.filter((tile) => tile.unlockLevel <= level.level).length;
      expect(revealed).toBe(level.tiles);
    }
    const positions = new Set(PET_HOME.tiles.map((tile) => `${tile.row}:${tile.col}`));
    expect(positions.size).toBe(PET_HOME.tiles.length);
    for (const tile of PET_HOME.tiles) {
      expect(tile.row).toBeGreaterThanOrEqual(0);
      expect(tile.row).toBeLessThanOrEqual(4);
      expect(tile.col).toBeGreaterThanOrEqual(0);
      expect(tile.col).toBeLessThanOrEqual(4);
    }
  });

  it('copies the source Home levels and income (R9)', () => {
    expect(PET_HOME.levels.map((row) => row.xp)).toEqual([
      0, 200, 550, 1000, 3500, 10000, 14500, 16500, 20000, 30000, 35000, 45000, 55000, 65000, 85000, 100000, 145000,
    ]);
    expect(PET_HOME.levels.map((row) => row.unlockGems)).toEqual([
      20, 20, 20, 20, 20, 60, 60, 80, 80, 80, 100, 100, 100, 100, 100, 100, 100,
    ]);
    expect(PET_HOME.levels[1]?.reward).toEqual({ gems: 20 });
    expect(PET_HOME.levels[3]?.orbChests).toBe(1);
    expect(PET_HOME.levels[16]?.orbChests).toBe(2);
    expect(PET_HOME.income[0]?.coinsPerFiveSeconds).toBe(2);
    expect(PET_HOME.income[15]?.coinsPerFiveSeconds).toBe(65536);
    expect(PET_HOME.home.summonCosts.map((row) => row.gems)).toEqual([10, 30, 100, 200, 500]);
    expect(PET_HOME.home.orbChest.weights).toEqual({ green: 6000, blue: 2000, purple: 666, orange: 222 });
  });

  it('copies the source shop rows (R9)', () => {
    const homeRows = PET_HOME.shops.home.bands.flatMap((band) => band.offers);
    const deluxeRows = PET_HOME.shops.deluxe.bands.flatMap((band) => band.offers);
    expect(homeRows).toHaveLength(84);
    expect(deluxeRows).toHaveLength(48);
    expect(PET_HOME.shops.home.bands.map((band) => [band.minLevel, band.maxLevel])).toEqual([
      [0, 5], [4, 7], [6, 8], [7, 12], [7, 12], [7, 12], [8, 16],
    ]);
    expect(homeRows[0]).toMatchObject({ price: 61500000, discount: 90, orb: { kind: 'sharp', colour: 'blue', level: 2 } });
    expect(deluxeRows.at(-1)).toMatchObject({ price: 144000, orb: { kind: 'etiquette', colour: 'orange', level: 6 } });
    expect(PET_HOME.shops.home.offersPerPage).toBe(9);
    expect(PET_HOME.shops.deluxe.offersPerPage).toBe(9);
    expect(PET_HOME.shops.home.currency).toBe('homeCoin');
    expect(PET_HOME.shops.deluxe.currency).toBe('orbEssence');
    expect(PET_HOME.shops.deluxe.unlockLevel).toBe(10);
    expect(new Set([...homeRows, ...deluxeRows].map((offer) => offer.id)).size).toBe(132);
  });

  it('keeps the source daily and offline shape', () => {
    expect(PET_HOME.home.freeSummonsPerDay).toBe(50);
    expect(PET_HOME.home.offlineHours).toBe(8);
    expect(PET_HOME.home.tickSeconds).toBe(300);
    expect(PET_HOME.shops.home.refresh.maxPerDay).toBe(30);
    expect(PET_HOME.shops.home.refresh.costs).toEqual([
      { afterRefreshes: 0, gems: 40 },
      { afterRefreshes: 10, gems: 80 },
    ]);
    for (const level of PET_HOME.levels) {
      expect(level.unlockGems).toBeGreaterThanOrEqual(0);
    }
  });
});
