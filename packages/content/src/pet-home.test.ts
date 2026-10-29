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

  it('keeps the source shop shape with original rows', () => {
    const homeRows = PET_HOME.shops.home.bands.flatMap((band) => band.offers);
    const deluxeRows = PET_HOME.shops.deluxe.bands.flatMap((band) => band.offers);
    expect(homeRows).toHaveLength(84);
    expect(deluxeRows).toHaveLength(48);
    expect(PET_HOME.shops.home.bands.map((band) => band.offers.length)).toEqual([12, 12, 12, 36, 12]);
    expect(PET_HOME.shops.deluxe.bands[0]?.offers).toHaveLength(48);
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
