import { describe, expect, it } from 'vitest';
import {
  claimRiftChest,
  initialRift,
  isBossFloor,
  riftChallengeBlock,
  riftDifficultyFor,
  riftDrops,
  riftSeasonCountdown,
  riftSeasonOpen,
  rollRift,
  settleRift,
  type RiftRules,
} from './index';

const rules: RiftRules = {
  floors: 250,
  easyFloors: 100,
  livesPerDay: 5,
  bossEvery: 5,
  season: { openDay: 2, openHour: 7, endDay: 7, endHour: 22 },
  coinToGold: 100,
  difficulties: [
    { difficulty: 1, minResonance: 0, syncLevel: 100, floorRewards: [{ floor: 20, rewards: { gold: 192000, candy: 64000 } }] },
    { difficulty: 2, minResonance: 100, syncLevel: 125, floorRewards: [{ floor: 20, rewards: { gold: 210000, candy: 70000 } }] },
  ],
  drops: {
    easy: { timeCredit: 1, timeCoin: 10 },
    easyBoss: { timeCredit: 3, timeCoin: 30 },
    advanced: { timeCoin: 50 },
    advancedBoss: { timeCoin: 250 },
  },
  chests: [{ challenges: 3, rewards: { pokemonShard5: 25 } }],
  enemy: { factions: [], tiers: [], count: 6, baseLevel: 5, levelSlope: 1.014, starsEvery: 12, maxStars: 20, stageEvery: 25, maxStage: 3 },
  bossMult: 1.5,
};

// 2026-11-03 is a Tuesday.
const TUE_06 = Date.UTC(2026, 10, 3, 6);
const TUE_07 = Date.UTC(2026, 10, 3, 7);
const SUN_21 = Date.UTC(2026, 10, 8, 21);
const SUN_22 = Date.UTC(2026, 10, 8, 22);
const MON_12 = Date.UTC(2026, 10, 9, 12);

describe('Rift Barriers rules', () => {
  it('opens Tuesday 07:00 and closes Sunday 22:00 UTC', () => {
    expect(riftSeasonOpen(rules, TUE_06)).toBe(false);
    expect(riftSeasonOpen(rules, TUE_07)).toBe(true);
    expect(riftSeasonOpen(rules, SUN_21)).toBe(true);
    expect(riftSeasonOpen(rules, SUN_22)).toBe(false);
    expect(riftSeasonOpen(rules, MON_12)).toBe(false);
    expect(riftSeasonCountdown(rules, TUE_06)).toBe(3_600_000);
    expect(riftSeasonCountdown(rules, SUN_21)).toBe(3_600_000);
  });

  it('locks a difficulty from resonance at the season start and refills 5 lives a day', () => {
    expect(riftDifficultyFor(rules, 50).difficulty).toBe(1);
    expect(riftDifficultyFor(rules, 150).difficulty).toBe(2);
    const first = rollRift(rules, initialRift(), TUE_07, 150);
    expect(first.state.difficulty).toBe(2);
    expect(first.state.lives).toBe(5);
    expect(first.newSeason).toBe(false);
    const spent = { ...first.state, lives: 0, highest: 12 };
    const nextDay = rollRift(rules, spent, TUE_07 + 86_400_000, 150);
    expect(nextDay.state.lives).toBe(5);
    expect(nextDay.state.highest).toBe(12);
    const nextWeek = rollRift(rules, spent, TUE_07 + 7 * 86_400_000, 0);
    expect(nextWeek.newSeason).toBe(true);
    expect(nextWeek.state.highest).toBe(0);
    expect(nextWeek.state.difficulty).toBe(1);
  });

  it('a win clears the floor with its drops and floor reward; a loss costs a life', () => {
    const state = { ...rollRift(rules, initialRift(), TUE_07, 0).state, highest: 19 };
    const won = settleRift(rules, state, true);
    expect(won.floor).toBe(20);
    expect(won.state.highest).toBe(20);
    expect(won.rewards).toEqual({ timeCredit: 3, timeCoin: 30, gold: 192000, candy: 64000 });
    const lost = settleRift(rules, state, false);
    expect(lost.state.highest).toBe(19);
    expect(lost.state.lives).toBe(4);
    expect(lost.state.challenges).toBe(1);
    expect(riftChallengeBlock(rules, { ...state, lives: 0 }, TUE_07)).toBe('no_lives');
    expect(riftChallengeBlock(rules, state, MON_12)).toBe('season_closed');
  });

  it('pays the source Advanced drops past floor 100 and finds bosses every 5th floor', () => {
    expect(isBossFloor(rules, 105)).toBe(true);
    expect(isBossFloor(rules, 101)).toBe(false);
    expect(riftDrops(rules, 101)).toEqual({ timeCoin: 50 });
    expect(riftDrops(rules, 105)).toEqual({ timeCoin: 250 });
    expect(riftDrops(rules, 3)).toEqual({ timeCredit: 1, timeCoin: 10 });
  });

  it('opens a chest after its challenge count, once', () => {
    const state = { ...rollRift(rules, initialRift(), TUE_07, 0).state, challenges: 2 };
    expect(claimRiftChest(rules, state, 3).ok).toBe(false);
    const ready = { ...state, challenges: 3 };
    const claimed = claimRiftChest(rules, ready, 3);
    expect(claimed.ok && claimed.rewards).toEqual({ pokemonShard5: 25 });
    if (!claimed.ok) return;
    expect(claimRiftChest(rules, claimed.state, 3).ok).toBe(false);
  });
});
