import { describe, expect, it } from 'vitest';
import { orderStages, seasonKey, type AccountState } from '@wildbound/engine';
import { buildConfig } from './config';
import { LocalServer } from './local-server';
import { MemoryStore } from './storage';
import { createInitialState, SAVE_KEY, serializeSave } from './save';
import {
  buyRankedAttempts,
  claimRankedGift,
  claimRankedTier,
  rankedOpponentSquads,
  rankedPhase,
  rankedTuning,
  rolledRanked,
  seriesWinsNeeded,
  startRankedMatch,
} from './pvp';
import { buildRankedView } from './pvp-ranked-view';

/** A fixed Saturday (UTC): a stable ladder day + ISO week. */
const NOW = Date.UTC(2026, 9, 17, 12, 0, 0);

function config() {
  return { ...buildConfig(), now: () => NOW };
}

/** Mark the last stage of `chapter` cleared so the ladder's gate opens. */
function clearChapter(state: AccountState, cfg: ReturnType<typeof config>, chapter: number): AccountState {
  const stages = orderStages(cfg.stages).filter((s) => s.chapter === chapter);
  const last = stages[stages.length - 1];
  if (!last) return state;
  return { ...state, campaign: { stars: { ...state.campaign.stars, [last.id]: 3 } } };
}

/** A fixture whose six Wilds are grown past the first rung's rivals (a clear win). */
function grownState(cfg: ReturnType<typeof config>): AccountState {
  const base = createInitialState(cfg);
  const roster = base.roster.map((w) => ({ ...w, level: 200, stars: 10 }));
  const ids = roster.map((w) => w.id);
  const unlocked = clearChapter(base, cfg, cfg.pvp.rankedChapter);
  return { ...unlocked, roster, squads: { ...unlocked.squads, arenaAttack: ids } };
}

describe('Ranked (server glue)', () => {
  it('gates the ladder behind its campaign chapter', () => {
    const cfg = config();
    const fresh = createInitialState(cfg);
    expect(buildRankedView(cfg, fresh, NOW).unlocked).toBe(false);
    const blocked = startRankedMatch(cfg, fresh, NOW, 7);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toBe('stage_locked');
    expect(buildRankedView(cfg, grownState(cfg), NOW).unlocked).toBe(true);
  });

  it('describes the region, rung, weather, track and lineup', () => {
    const cfg = config();
    const view = buildRankedView(cfg, grownState(cfg), NOW);
    expect(view.phaseName).toBe(cfg.pvp.ranked.phases[0]!.name);
    expect(view.teams).toBe(cfg.pvp.ranked.phases[0]!.teams);
    expect(view.teamSize).toBe(cfg.pvp.ranked.phases[0]!.teamSize);
    expect(view.tierName).toBe(cfg.pvp.ranked.tiers[0]!.name);
    expect(view.dan).toBe(1101); // phase 1, group 1 (Vanguard), tier 1
    expect(view.tiers).toHaveLength(cfg.pvp.ranked.tiers.length);
    expect(view.gifts).toHaveLength(cfg.pvp.ranked.giftTrack.length);
    expect(view.tiers.filter((t) => t.current)).toHaveLength(1);
    expect(view.attemptsTotal).toBe(cfg.pvp.ranked.freeAttemptsPerDay);
    expect(view.atThreshold).toBe(false);
    // The lineup is trimmed to the region's team size.
    expect(view.squad.count).toBe(cfg.pvp.ranked.phases[0]!.teamSize);
    // Weather is a season-stable pair drawn from the region's rotation.
    expect(cfg.pvp.ranked.phases[0]!.weather).toContain(view.weatherCurrent);
    expect(cfg.pvp.ranked.phases[0]!.weather).toContain(view.weatherNext);
  });

  it('fields one region-sized rival lineup per game of the series', () => {
    const cfg = config();
    const ranked = rolledRanked(cfg, grownState(cfg), NOW);
    const squads = rankedOpponentSquads(cfg, ranked);
    expect(squads).toHaveLength(cfg.pvp.ranked.bestOf);
    for (const squad of squads) expect(squad).toHaveLength(rankedPhase(cfg, ranked).teamSize);
    // Deterministic: the same rung meets the same rivals.
    expect(rankedOpponentSquads(cfg, ranked)).toEqual(squads);
  });

  it('plays a real best-of series and moves the ladder', () => {
    const cfg = config();
    const state = grownState(cfg);
    const outcome = startRankedMatch(cfg, state, NOW, 1234);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const value = outcome.value;
    const need = seriesWinsNeeded(cfg.pvp.ranked.bestOf);
    expect(value.battles.length).toBeGreaterThanOrEqual(Math.min(2, cfg.pvp.ranked.bestOf));
    expect(value.battles.length).toBeLessThanOrEqual(cfg.pvp.ranked.bestOf);
    expect(value.wins + value.losses).toBe(value.battles.length);
    expect(value.won).toBe(value.wins > value.losses);
    // A series ends as soon as one side has a majority.
    expect(Math.min(value.wins, value.losses)).toBeLessThan(need);
    for (const battle of value.battles) {
      expect(battle.units.length).toBeGreaterThan(0);
      expect(battle.mode).toBe('rankedMatch');
    }
    // The grown squad beats the first rung's rivals, so the ladder climbs.
    expect(value.won).toBe(true);
    expect(value.scoreAfter).toBeGreaterThan(value.scoreBefore);
    expect(value.state.pvp.ranked.attempts).toBe(1);
    expect(value.state.pvp.ranked.matches).toBe(1);
    expect(value.matches).toBe(1);
    expect(value.attemptsLeft).toBe(cfg.pvp.ranked.freeAttemptsPerDay - 1);
  });

  it('promotes on a win at the tier threshold', () => {
    const cfg = config();
    const state = grownState(cfg);
    const threshold = cfg.pvp.ranked.tiers[1]!.score;
    const atStop: AccountState = {
      ...state,
      pvp: { ...state.pvp, ranked: { ...state.pvp.ranked, score: threshold, tier: 0 } },
    };
    const outcome = startRankedMatch(cfg, atStop, NOW, 99);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.won).toBe(true);
    expect(outcome.value.promoted).toBe(true);
    expect(outcome.value.tierBefore).toBe(0);
    expect(outcome.value.tierAfter).toBe(1);
    expect(outcome.value.scoreAfter).toBe(threshold + cfg.pvp.ranked.winScore);
  });

  it('caps series at the day\'s free + bought attempts', () => {
    const cfg = config();
    const state = grownState(cfg);
    const spent: AccountState = {
      ...state,
      pvp: { ...state.pvp, ranked: { ...state.pvp.ranked, attempts: cfg.pvp.ranked.freeAttemptsPerDay } },
    };
    const capped = startRankedMatch(cfg, spent, NOW, 7);
    expect(capped.ok).toBe(false);
    if (!capped.ok) expect(capped.error).toBe('daily_limit');
  });

  it('buys attempts at the day\'s prices and refuses without gems', () => {
    const cfg = config();
    const state = grownState(cfg);
    const tuning = rankedTuning(cfg);
    const bought = buyRankedAttempts(cfg, state, NOW, 2);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    expect(bought.value.spent).toBe(tuning.attemptPrices[0]! + tuning.attemptPrices[1]!);
    expect(bought.value.state.pvp.ranked.bought).toBe(2);
    const broke: AccountState = { ...state, currencies: { ...state.currencies, gems: 0 } };
    const refused = buyRankedAttempts(cfg, broke, NOW, 1);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toBe('insufficient_items');
  });

  it('claims a tier\'s region coins and a challenge gift once each', () => {
    const cfg = config();
    const state = grownState(cfg);
    const coins = cfg.pvp.ranked.phases[0]!.coins;
    const tier = claimRankedTier(cfg, state, NOW, 0);
    expect(tier.ok).toBe(true);
    if (!tier.ok) return;
    expect(tier.value.granted).toEqual({ arenaToken: coins[0] });
    expect(tier.value.state.currencies.arenaToken).toBe(state.currencies.arenaToken + coins[0]!);
    expect(claimRankedTier(cfg, tier.value.state, NOW, 0).ok).toBe(false);
    // A rung above the current one is not claimable yet.
    expect(claimRankedTier(cfg, state, NOW, 5).ok).toBe(false);

    const matches = state.pvp.ranked.matches;
    const reached = cfg.pvp.ranked.giftTrack.findIndex((g) => g.matches > matches);
    expect(reached).toBe(0);
    expect(claimRankedGift(cfg, state, NOW, 0).ok).toBe(false);
    const withMatches: AccountState = {
      ...state,
      pvp: { ...state.pvp, ranked: { ...state.pvp.ranked, matches: cfg.pvp.ranked.giftTrack[0]!.matches } },
    };
    const gift = claimRankedGift(cfg, withMatches, NOW, 0);
    expect(gift.ok).toBe(true);
    if (!gift.ok) return;
    expect(gift.value.granted).toEqual(cfg.pvp.ranked.giftTrack[0]!.reward);
    expect(claimRankedGift(cfg, gift.value.state, NOW, 0).ok).toBe(false);
  });

  it('advances the region and resets the track when the season turns', () => {
    const cfg = config();
    const state = grownState(cfg);
    const stale: AccountState = {
      ...state,
      pvp: {
        ...state.pvp,
        ranked: { ...state.pvp.ranked, season: '2020-W01', tier: 6, score: 700, matches: 12 },
      },
    };
    const outcome = startRankedMatch(cfg, stale, NOW, 5);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const ranked = outcome.value.state.pvp.ranked;
    expect(ranked.season).toBe(seasonKey(NOW));
    expect(ranked.phase).toBe(1);
    expect(ranked.matches).toBe(1);
    expect(ranked.tier).toBeLessThanOrEqual(1);
  });

  it('drives the ladder through the LocalServer boundary', async () => {
    const cfg = config();
    const store = new MemoryStore();
    await store.write(SAVE_KEY, serializeSave(grownState(cfg)));
    const server = new LocalServer(store, cfg);

    const view = await server.getRanked();
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    expect(view.value.tiers).toHaveLength(cfg.pvp.ranked.tiers.length);

    const match = await server.startRankedMatch(2026);
    expect(match.ok).toBe(true);
    if (!match.ok) return;
    expect(match.value.battles.length).toBeGreaterThan(0);
    expect(match.value.attemptsLeft).toBe(cfg.pvp.ranked.freeAttemptsPerDay - 1);
    expect(match.value.snapshot.state.pvp.ranked.matches).toBe(1);

    const tier = await server.claimRankedTier(0);
    expect(tier.ok).toBe(true);

    const bought = await server.buyRankedAttempts(1);
    expect(bought.ok).toBe(true);

    const gift = await server.claimRankedGift(0);
    expect(gift.ok).toBe(false); // only one match so far

    const after = await server.getRanked();
    expect(after.ok).toBe(true);
    if (after.ok) expect(after.value.matches).toBe(1);
  });
});
