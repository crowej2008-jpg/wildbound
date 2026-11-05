import { describe, expect, it } from 'vitest';
import { bumpCounter } from './counters';
import { buildConfig } from './config';
import { createInitialState } from './save';
import { bingoKey, buildWeekendView, buyElven, buySauce, claimBingoLine, claimFlowerMilestone, claimFlowerRank, drawBingo, elvenKey, flipElven, flowersThisWeek, resetBingo } from './weekend-events';

const DAY = 86_400_000;
const WED = Date.UTC(2026, 10, 11, 12);
const SAT = Date.UTC(2026, 10, 14, 12);

function account(now = WED) {
  const config = buildConfig();
  config.now = () => now;
  const state = createInitialState(config);
  state.currencies = { ...state.currencies, gems: 100_000, elvenTreasure: 400, strawberrySauce: 300 } as typeof state.currencies;
  return { config, state };
}

describe('Weekend Bash', () => {
  it('Elven Treasure runs Mon–Thu, Bingo Fri–Sun; each keyed by its first day', () => {
    const { config } = account();
    expect(elvenKey(config, WED)).toBe('2026-11-09');
    expect(bingoKey(config, WED)).toBeNull();
    expect(bingoKey(config, SAT)).toBe('2026-11-13');
    expect(elvenKey(config, SAT)).toBeNull();
  });

  it('Elven Treasure: the grand prize is in one of the last 4 tiles; rounds advance; cashback; Gem prices', () => {
    const { config, state } = account();
    let s = state;
    let grands = 0;
    for (let i = 0; i < 60; i += 1) {
      const r = flipElven(config, s, WED + i);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      if (r.value.grand) {
        grands += 1;
        expect(s.weekend!.elven.flips + 1).toBeGreaterThanOrEqual(22);
      }
      s = r.value.state;
    }
    expect(grands).toBeGreaterThanOrEqual(2);
    expect(s.weekend!.elven.cashback).toContain(60);
    const b = buyElven(config, s, WED, 11);
    expect(b.ok).toBe(true);
    if (b.ok) expect(b.value.currencies.gems).toBe(100_000 - 10 * 24 - 35 + 10); // round 1's grand prize pays 10 Gems
  });

  it('Bingo: sauce opens numbers; complete lines pay; wildcards need a pick; full cards reset', () => {
    const { config, state } = account(SAT);
    let s = state;
    for (let i = 0; i < 60 && s.weekend?.bingo.marked.length !== 16; i += 1) {
      const r = drawBingo(config, s, SAT + i * 1000, 5);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.value.state;
    }
    expect(s.weekend!.bingo.marked).toHaveLength(16);
    expect(resetBingo(config, s, SAT).ok).toBe(false);
    expect(claimBingoLine(config, s, SAT, 'd1').ok).toBe(false);
    for (const l of config.weekendEvents.bingo.lines) {
      const r = claimBingoLine(config, s, SAT, l.id, l.wildcard ? config.weekendEvents.bingo.wildcards[l.wildcard - 1]![0]!.id : undefined);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.value.state;
    }
    expect(s.currencies.strawberryCake).toBe(2000);
    expect(resetBingo(config, s, SAT).ok).toBe(true);
    expect(buySauce(config, s, SAT, 0, 41).ok).toBe(false);
    expect(buySauce(config, s, SAT, 0, 40).ok).toBe(true);
  });
});

describe('Flower Event', () => {
  it('flowers come from this week’s activity; milestones; last week ranks', () => {
    const { config, state } = account();
    let s = bumpCounter(state, WED, 'q:dailyDungeon', 40);
    s = bumpCounter(s, WED, 'commonDraws', 30);
    s = bumpCounter(s, WED, 'mistyWins', 65);
    s = bumpCounter(s, WED, 'q:arenaChallenge', 25);
    const f = flowersThisWeek(config, s, WED);
    expect(f).toBe(550 + 600 + 1500 + 500);
    expect(claimFlowerMilestone(config, s, WED, 2000).ok).toBe(true);
    expect(claimFlowerMilestone(config, s, WED, 5000).ok).toBe(false);
    const next = WED + 7 * DAY;
    const rolled = bumpCounter(s, next, 'commonDraws', 1);
    expect(buildWeekendView(config, rolled, next).flower.lastWeek?.flowers).toBe(f);
    const r = claimFlowerRank(config, rolled, next);
    expect(r.ok).toBe(true);
    if (r.ok) expect(claimFlowerRank(config, r.value.state, next).ok).toBe(false);
  });
});
