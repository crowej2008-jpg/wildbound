import { describe, expect, it } from 'vitest';
import {
  applyWeeklySettlement,
  arenaAttemptPrice,
  arenaBand,
  arenaBandIndex,
  arenaRank,
  buyArenaAttempt,
  canChallengeArena,
  claimAchievement,
  claimArenaChest,
  claimableAchievements,
  claimableArenaChests,
  creditsAfter,
  initialArenaState,
  recordArenaBattle,
  reachedArenaChests,
  refreshArena,
  rollArenaDay,
  settlementFor,
} from './arena';
import {
  buyRankedAttempt,
  canChallengeRanked,
  claimGift,
  claimTier,
  claimableGifts,
  claimableTiers,
  danId,
  decodeDan,
  inDailyPause,
  initialRankedState,
  isSeasonOpen,
  rankedAttemptPrice,
  rankedDayKey,
  recordRankedMatch,
  rollRankedDay,
  rollRankedSeason,
  scoreAfter,
  seasonClosedAt,
  seasonKey,
  seasonOpenAt,
  tierProgress,
} from './ranked';
import { weatherFor, weatherRule } from './weather';
import { initialPvp } from '../roster/types';
import type { ArenaTuning, RankedTuning } from './types';

const BANDS = [
  { minCredits: 0, startPlace: 5000, resetCredits: 0, reward: { gold: 100 } },
  { minCredits: 300, startPlace: 501, resetCredits: 300, reward: { gold: 200, arenaToken: 5 } },
  { minCredits: 600, startPlace: 1, resetCredits: 600, reward: { gems: 10 } },
];

const ARENA: ArenaTuning = {
  freeAttemptsPerDay: 5,
  attemptPrices: [10, 20, 30],
  opponentCount: 3,
  creditsPerWin: 30,
  creditsPerLoss: 15,
  creditCap: 1000,
  bands: BANDS,
  chestTiers: [
    { battles: 1, reward: { gold: 15000 } },
    { battles: 2, reward: { gold: 15000 } },
    { battles: 3, reward: { gold: 15000, shard: 20 } },
  ],
  bestRankTiers: [
    { place: 100, reward: { gems: 300 } },
    { place: 1000, reward: { shard: 50 } },
  ],
};

// The reference's 12 thresholds; neutral names (names are content, not engine).
const TIERS = [0, 100, 200, 300, 420, 540, 660, 810, 960, 1110, 1310, 1510].map((score) => ({
  name: `T${score}`,
  score,
}));

const RANKED: RankedTuning = {
  freeAttemptsPerDay: 6,
  attemptPrices: [10, 20, 30, 40],
  winScore: 35,
  lossScore: 20,
  bestOf: 3,
  weatherDmg: 0.3,
  tiers: TIERS,
  giftTrack: [
    { matches: 5, reward: { gold: 20000 } },
    { matches: 10, reward: { gold: 25000, shard: 30 } },
  ],
  phases: [
    { id: 'p1', name: 'P1', teams: 2, teamSize: 4, coins: TIERS.map((_, i) => 100 + i), weather: ['grove', 'tide'] },
    { id: 'p2', name: 'P2', teams: 3, teamSize: 6, coins: TIERS.map((_, i) => 200 + i), weather: ['ember', 'frost'] },
  ],
};

describe('arena credits and rank', () => {
  it('moves credits on a win/loss and clamps to [0, cap]', () => {
    expect(creditsAfter(100, true, ARENA)).toBe(130);
    expect(creditsAfter(100, false, ARENA)).toBe(85);
    expect(creditsAfter(5, false, ARENA)).toBe(0);
    expect(creditsAfter(995, true, ARENA)).toBe(1000);
  });

  it('picks the band a credit value falls in', () => {
    expect(arenaBandIndex(0, BANDS)).toBe(0);
    expect(arenaBandIndex(299, BANDS)).toBe(0);
    expect(arenaBandIndex(300, BANDS)).toBe(1);
    expect(arenaBandIndex(9999, BANDS)).toBe(2);
    expect(arenaBand(650, BANDS).startPlace).toBe(1);
  });

  it('derives a place that improves with credits (1 is best)', () => {
    expect(arenaRank(0, BANDS)).toBe(5000);
    expect(arenaRank(100, BANDS)).toBe(4900);
    expect(arenaRank(300, BANDS)).toBe(501);
    expect(arenaRank(600, BANDS)).toBe(1);
    // Beyond the best band's floor the place floors at 1.
    expect(arenaRank(900, BANDS)).toBe(1);
  });

  it('rolls the day counters but keeps credits', () => {
    const state = { ...initialArenaState('2026-01-01', 'w1'), credits: 400, attempts: 3, bought: 1, battleCount: 4 };
    const rolled = rollArenaDay(state, '2026-01-02');
    expect(rolled.credits).toBe(400);
    expect(rolled.attempts).toBe(0);
    expect(rolled.bought).toBe(0);
    expect(rolled.battleCount).toBe(0);
    expect(rolled.day).toBe('2026-01-02');
    // Same day: identity.
    expect(rollArenaDay(rolled, '2026-01-02')).toBe(rolled);
  });

  it('counts attempts against free + bought and prices the next buy', () => {
    let state = initialArenaState('d', 'w1');
    expect(canChallengeArena(state, ARENA)).toBe(true);
    state = { ...state, attempts: 5 };
    expect(canChallengeArena(state, ARENA)).toBe(false);
    state = buyArenaAttempt(state);
    expect(canChallengeArena(state, ARENA)).toBe(true);
    expect(arenaAttemptPrice(state, ARENA)).toBe(20);
    expect(arenaAttemptPrice({ ...state, bought: 99 }, ARENA)).toBe(30); // last repeats
  });

  it('records a battle: credits, best place, attempts and chest progress', () => {
    let state = initialArenaState('d', 'w1');
    state = recordArenaBattle(state, true, ARENA);
    expect(state.credits).toBe(30);
    expect(state.bestCredits).toBe(30);
    expect(state.attempts).toBe(1);
    expect(state.battleCount).toBe(1);
    expect(state.bestPlace).toBe(arenaRank(30, BANDS));
    state = recordArenaBattle(state, false, ARENA);
    expect(state.credits).toBe(15);
    expect(state.bestPlace).toBe(arenaRank(30, BANDS)); // best-ever place is kept
  });

  it('reaches and claims chests one at a time, idempotently', () => {
    let state = { ...initialArenaState('d', 'w1'), battleCount: 2 };
    expect(reachedArenaChests(state, ARENA)).toEqual([0, 1]);
    expect(claimableArenaChests(state, ARENA)).toEqual([0, 1]);
    state = claimArenaChest(state, 0);
    expect(claimableArenaChests(state, ARENA)).toEqual([1]);
    expect(claimArenaChest(state, 0)).toBe(state); // idempotent
  });

  it('unlocks best-rank achievements by best-ever place', () => {
    let state = { ...initialArenaState('d', 'w1'), bestPlace: 900 };
    expect(claimableAchievements(state, ARENA)).toEqual([1]);
    state = { ...state, bestPlace: 50 };
    expect(claimableAchievements(state, ARENA)).toEqual([0, 1]);
    state = claimAchievement(state, 0);
    expect(claimableAchievements(state, ARENA)).toEqual([1]);
    expect(claimableAchievements({ ...state, bestPlace: 0 }, ARENA)).toEqual([]);
  });

  it('settles weekly: pays the band and resets credits to the band floor', () => {
    const state = { ...initialArenaState('d', 'w1'), credits: 450, attempts: 4, battleCount: 3 };
    expect(applyWeeklySettlement(state, 'w1', BANDS).settlement).toBeNull();
    const { state: settled, settlement } = applyWeeklySettlement(state, 'w2', BANDS);
    expect(settlement).not.toBeNull();
    expect(settlement!.bandIndex).toBe(1);
    expect(settlement!.reward).toEqual({ gold: 200, arenaToken: 5 });
    expect(settled.credits).toBe(300);
    expect(settled.weekKey).toBe('w2');
    expect(settled.battleCount).toBe(0);
    expect(settlementFor(650, BANDS).reward).toEqual({ gems: 10 });
  });

  it('rerolls opponents by bumping the seed', () => {
    const state = initialArenaState('d', 'w1');
    const next = refreshArena(state);
    expect(next.opponentSeed).toBe(1);
    expect(state.opponentSeed).toBe(0);
  });
});

describe('ranked ladder', () => {
  it('encodes and decodes dan ids with the reference layout', () => {
    expect(danId(0, 0)).toBe(1101); // phase 1, Vanguard I
    expect(danId(7, 6)).toBe(8301); // phase 8, Commander I
    expect(decodeDan(8302)).toMatchObject({ phase: 8, group: 3, tier: 2 });
    expect(decodeDan(8302).tierIndex).toBe(7); // Commander II is the 8th tier
    for (let i = 0; i < 12; i += 1) {
      expect(decodeDan(danId(0, i)).tierIndex).toBe(i);
    }
  });

  it('climbs on a win and on a loss below the threshold', () => {
    expect(scoreAfter(0, 0, RANKED, true)).toMatchObject({ score: 35, tier: 0, promoted: false });
    expect(scoreAfter(0, 0, RANKED, false)).toMatchObject({ score: 20, tier: 0, promoted: false });
  });

  it('stops the points at the next threshold', () => {
    // 90 + 35 would be 125, but the next threshold is 100.
    expect(scoreAfter(90, 0, RANKED, true).score).toBe(100);
    expect(scoreAfter(95, 0, RANKED, false).score).toBe(100);
  });

  it('promotes on a win at the stop and deducts on a loss', () => {
    const win = scoreAfter(100, 0, RANKED, true);
    expect(win.promoted).toBe(true);
    expect(win.tier).toBe(1);
    expect(win.score).toBe(135); // threshold + winScore
    const loss = scoreAfter(100, 0, RANKED, false);
    expect(loss.promoted).toBe(false);
    expect(loss.tier).toBe(0);
    expect(loss.score).toBe(80); // the reference's 100 -> 80
  });

  it('reaches Overlord, not King, on 42 straight wins (the reference parity)', () => {
    let state = initialRankedState(0, 'd', 'w1');
    for (let i = 0; i < 42; i += 1) state = recordRankedMatch(state, true, RANKED);
    expect(state.score).toBe(1310);
    expect(state.tier).toBe(9); // Legend, the tier whose threshold is 1110
    const fortyThird = recordRankedMatch(state, true, RANKED);
    expect(fortyThird.tier).toBe(10); // Overlord
    expect(fortyThird.score).toBe(1345);
  });

  it('records a match into the season and day counters and the streak', () => {
    let state = initialRankedState(0, 'd', 'w1');
    state = recordRankedMatch(state, true, RANKED);
    state = recordRankedMatch(state, true, RANKED);
    state = recordRankedMatch(state, false, RANKED);
    expect(state.matches).toBe(3);
    expect(state.wins).toBe(2);
    expect(state.losses).toBe(1);
    expect(state.dayWins).toBe(2);
    expect(state.dayBattles).toBe(3);
    expect(state.streak).toBe(0);
    expect(state.bestStreak).toBe(2);
    expect(state.attempts).toBe(3);
  });

  it('rolls the day (attempts) and the season (the whole track)', () => {
    const state = { ...initialRankedState(0, 'd', 'w1'), attempts: 4, bought: 2, score: 500, tier: 5, matches: 9, dayWins: 3, dayBattles: 4, claimedTiers: [0, 1], claimedGifts: [0] };
    const day = rollRankedDay(state, 'd2');
    expect(day.attempts).toBe(0);
    expect(day.bought).toBe(0);
    expect(day.score).toBe(500); // day roll keeps the ladder position
    expect(rollRankedDay(day, 'd2')).toBe(day);
    const season = rollRankedSeason(state, 'w2');
    expect(season.tier).toBe(0);
    expect(season.score).toBe(0);
    expect(season.matches).toBe(0);
    expect(season.claimedTiers).toEqual([]);
    expect(season.claimedGifts).toEqual([]);
    expect(season.season).toBe('w2');
    expect(rollRankedSeason(season, 'w2')).toBe(season);
  });

  it('advances the region each season when the phase count is known', () => {
    const state = { ...initialRankedState(2, 'd', 'w1'), score: 400, tier: 4 };
    const next = rollRankedSeason(state, 'w2', 8);
    expect(next.phase).toBe(3);
    expect(next.tier).toBe(0);
    // The regions cycle rather than running off the end of the table.
    const wrapped = rollRankedSeason({ ...state, phase: 7 }, 'w2', 8);
    expect(wrapped.phase).toBe(0);
    // Without a phase count the region is left alone (the engine stays content-free).
    expect(rollRankedSeason(state, 'w2').phase).toBe(2);
  });

  it('names the season window (Mon 03:00 -> Sun 22:00 UTC)', () => {
    const wed = Date.UTC(2026, 0, 7, 12, 0, 0); // Wed 7 Jan 2026
    expect(new Date(seasonOpenAt(wed)).toISOString()).toBe('2026-01-05T03:00:00.000Z');
    expect(new Date(seasonClosedAt(wed)).toISOString()).toBe('2026-01-11T22:00:00.000Z');
    expect(isSeasonOpen(wed)).toBe(true);
    expect(isSeasonOpen(Date.UTC(2026, 0, 5, 1, 0, 0))).toBe(false); // before Monday 03:00
    expect(isSeasonOpen(Date.UTC(2026, 0, 11, 23, 0, 0))).toBe(false); // after Sunday 22:00
    expect(seasonKey(wed)).toBe('2026-W02');
  });

  it('resets the day at 03:00 UTC and pauses matching 03:00-05:00', () => {
    expect(rankedDayKey(Date.UTC(2026, 0, 7, 2, 0, 0))).toBe('2026-01-06');
    expect(rankedDayKey(Date.UTC(2026, 0, 7, 4, 0, 0))).toBe('2026-01-07');
    expect(inDailyPause(Date.UTC(2026, 0, 7, 3, 30, 0))).toBe(true);
    expect(inDailyPause(Date.UTC(2026, 0, 7, 2, 59, 0))).toBe(false);
    expect(inDailyPause(Date.UTC(2026, 0, 7, 5, 0, 0))).toBe(false);
  });

  it('prices bought attempts and gates challenges', () => {
    let state = initialRankedState(0, 'd', 'w1');
    expect(canChallengeRanked(state, RANKED)).toBe(true);
    state = { ...state, attempts: 6 };
    expect(canChallengeRanked(state, RANKED)).toBe(false);
    state = buyRankedAttempt(state);
    expect(canChallengeRanked(state, RANKED)).toBe(true);
    expect(rankedAttemptPrice(state, RANKED)).toBe(20);
    expect(rankedAttemptPrice({ ...state, bought: 99 }, RANKED)).toBe(40);
  });

  it('claims tier and gift rewards', () => {
    let state = { ...initialRankedState(0, 'd', 'w1'), tier: 2, matches: 10 };
    expect(claimableTiers(state)).toEqual([0, 1, 2]);
    state = claimTier(state, 0);
    expect(claimableTiers(state)).toEqual([1, 2]);
    expect(claimTier(state, 0)).toBe(state);
    expect(claimableGifts(state, RANKED)).toEqual([0, 1]);
    state = claimGift(state, 1);
    expect(claimableGifts(state, RANKED)).toEqual([0]);
    expect(claimGift(state, 1)).toBe(state);
  });

  it('reports the current floor and next tier', () => {
    const state = { ...initialRankedState(0, 'd', 'w1'), tier: 0 };
    expect(tierProgress(state, RANKED)).toEqual({ floor: 0, nextIndex: 1, nextScore: 100 });
    expect(tierProgress({ ...state, tier: 11 }, RANKED)).toEqual({ floor: 1510, nextIndex: null, nextScore: null });
  });
});

describe('pvp state slice', () => {
  it('builds a fresh PvP slice for the Arena and the Ranked ladder', () => {
    const pvp = initialPvp('2026-10-18', '2026-W42');
    expect(pvp.arena.credits).toBe(0);
    expect(pvp.arena.weekKey).toBe('2026-W42');
    expect(pvp.arena.day).toBe('2026-10-18');
    expect(pvp.ranked.phase).toBe(0);
    expect(pvp.ranked.tier).toBe(0);
    expect(pvp.ranked.score).toBe(0);
    expect(pvp.ranked.season).toBe('2026-W42');
  });
});

describe('ranked weather', () => {
  it('picks a stable current/next pair from the rotation for a season', () => {
    const a = weatherFor(['grove', 'tide', 'ember'], '2026-W02');
    const b = weatherFor(['grove', 'tide', 'ember'], '2026-W02');
    expect(a).toEqual(b);
    expect(['grove', 'tide', 'ember']).toContain(a.current);
    expect(['grove', 'tide', 'ember']).toContain(a.next);
    expect(a.next).not.toBe(a.current);
  });

  it('builds the BattleRules weather value', () => {
    expect(weatherRule({ current: 'frost', next: 'ember' }, 0.3)).toEqual({ factions: ['frost'], dmg: 0.3 });
  });

  it('throws on an empty rotation', () => {
    expect(() => weatherFor([], 'w')).toThrow();
  });
});
