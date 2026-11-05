import { describe, expect, it } from 'vitest';
import { orderStages, type AccountState } from '@wildbound/engine';
import { buildClashView, claimBets, claimGuessCoins, featuredMatch, placeBet, playClashRound, prepareClash, sundayQualified } from './clash';
import { buildConfig } from './config';
import { createInitialState } from './save';

const TUE = Date.UTC(2026, 10, 10, 21, 30); // Tuesday after every round opened
const TUE_MORNING = Date.UTC(2026, 10, 10, 9);
const WED = Date.UTC(2026, 10, 11, 12);

function account(credits = 1_000_000) {
  const config = { ...buildConfig(), now: () => TUE };
  const base = createInitialState(config);
  const stages = orderStages(config.stages).filter((s) => s.chapter === config.pvp.arenaChapter);
  const roster = base.roster.map((w) => ({ ...w, level: 220, stars: w.stars + 9 }));
  const ids = roster.slice(0, 6).map((w) => w.id);
  const state: AccountState = {
    ...base,
    roster,
    serverEpoch: TUE - 10 * 86_400_000,
    profile: { ...base.profile, level: 30, xp: 60_000 },
    campaign: { ...base.campaign, stars: { ...base.campaign.stars, 'c3-10': 3, [stages[stages.length - 1]!.id]: 3 } },
    squads: { ...base.squads, clash: [...ids, ...Array(6).fill(null)].slice(0, 6) },
    pvp: { ...base.pvp, arena: { ...base.pvp.arena, credits } },
  };
  return { config, state };
}

describe('Cross-Server Clash', () => {
  it('opens Tue/Thu/Sat/Sun; Wednesday has no cup', () => {
    const { config, state } = account();
    expect(buildClashView(config, state, TUE).rounds).toHaveLength(6);
    expect(buildClashView(config, state, WED).rounds).toHaveLength(0);
    expect(playClashRound(config, state, WED).ok).toBe(false);
  });

  it('rounds wait for their battle time; outside the Arena top 64 you only predict', () => {
    const { config, state } = account();
    expect(playClashRound(config, state, TUE_MORNING).ok).toBe(false);
    const low = account(0);
    const r = playClashRound(low.config, low.state, TUE);
    expect(r.ok).toBe(false);
  });

  it('a score contest of 3 battles, then knockouts; wins pay the source rewards', () => {
    const { config, state } = account();
    let s = state;
    for (let i = 0; i < 9; i += 1) {
      const r = playClashRound(config, s, TUE, i + 1);
      if (!r.ok) break;
      s = r.value.state;
      if (r.value.out) break;
    }
    const d = s.clash!.days['2']!;
    expect(d.contest).toBe(3);
    if (d.won.includes(1)) expect(s.currencies.arenaToken).toBeGreaterThanOrEqual(state.currencies.arenaToken + 10000);
    expect(sundayQualified(s.clash!)).toBe(d.won.includes(2));
  });

  it('Guess Coins once a cup day; bets close at the round time and pay ×2 or ×0.5', () => {
    const { config, state } = account();
    const c = claimGuessCoins(config, state, TUE_MORNING);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(claimGuessCoins(config, c.value.state, TUE_MORNING).ok).toBe(false);
    const coins = c.value.state.currencies.predictionCoin!;
    const b = placeBet(config, c.value.state, TUE_MORNING, 2, 0, 1000);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(placeBet(config, b.value, TUE, 3, 0, 100).ok).toBe(false);
    const m = featuredMatch(config, b.value.clash!.week, 2, 2);
    const paid = claimBets(config, b.value, TUE);
    expect(paid.ok).toBe(true);
    if (paid.ok) expect(paid.value.state.currencies.predictionCoin).toBe(coins - 1000 + (m.winner === 0 ? 2000 : 500));
  });

  it('left-over Prediction Coins become Arena Tokens at the week roll', () => {
    const { config, state } = account();
    const s = prepareClash(config, { ...state, currencies: { ...state.currencies, predictionCoin: 700 } }, TUE);
    const next = prepareClash(config, s, TUE + 7 * 86_400_000);
    expect(next.currencies.predictionCoin).toBe(0);
    expect(next.currencies.arenaToken).toBe(s.currencies.arenaToken + 700);
  });
});
