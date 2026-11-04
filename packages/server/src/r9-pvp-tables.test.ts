import { describe, expect, it } from 'vitest';
import { buildConfig } from './config';

describe('R9 Arena and Ranked tables from the source', () => {
  it('copies the Arena prices, battle chests and best-rank brackets', () => {
    const { arena } = buildConfig().pvp;
    expect(arena.freeAttemptsPerDay).toBe(5);
    expect(arena.attemptPrices.slice(0, 7)).toEqual([10, 20, 20, 20, 30, 30, 40]);
    expect(arena.attemptPrices).toHaveLength(25);
    expect(arena.chestTiers[3]).toEqual({ battles: 4, reward: { gold: 15000, pokemonShard3: 10, pokemonShard5: 2 } });
    expect(arena.bestRankTiers.map((t) => t.place)).toEqual([10, 50, 100, 200, 300, 400, 500, 600, 800, 1000, 1200, 2000, 5000]);
    expect(arena.bestRankTiers[2]!.reward).toEqual({ pokemonShard5: 50 });
  });

  it('copies each Ranked phase\'s coins and match gifts', () => {
    const { ranked } = buildConfig().pvp;
    expect(ranked.phases[1]!.coins.slice(0, 5)).toEqual([160, 160, 320, 320, 960]);
    expect(ranked.phases[7]!.coins.at(-1)).toBe(5000);
    expect(ranked.phases[0]!.gifts![0]).toEqual({ plateBottle: 30, berryEssence: 200 });
    expect(ranked.phases[7]!.gifts!.at(-1)).toEqual({ plateBottle: 30, plateFragment: 60, berryEssence: 500 });
    expect(ranked.giftTrack.map((g) => g.matches)).toEqual([5, 10, 15, 20, 25, 30, 40]);
  });
});
