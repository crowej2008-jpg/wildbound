import { describe, expect, it } from 'vitest';
import { buildConfig, type GameConfig } from './config';
import { challengeRift, claimRiftChestAction, prepareRift } from './rift';
import { buildRiftView } from './rift-view';
import { createInitialState } from './save';

// 2026-11-03 is a Tuesday; the season opens at 07:00 UTC.
const TUE = Date.UTC(2026, 10, 3, 12);
const MON = Date.UTC(2026, 10, 9, 12);

function account(): { config: GameConfig; state: ReturnType<typeof createInitialState> } {
  const config = buildConfig();
  config.now = () => TUE;
  const state = createInitialState(config);
  state.campaign.stars['c10-10'] = 3;
  state.profile.level = 20;
  state.roster = state.roster.map((wild) => ({ ...wild, level: 150, stars: 8 }));
  return { config, state };
}

describe('Rift Barriers server rules', () => {
  it('stays locked before story 10-10 and opens with the season', () => {
    const { config, state } = account();
    const locked = challengeRift(config, { ...state, campaign: { ...state.campaign, stars: {} } }, TUE);
    expect(locked.ok).toBe(false);
    const view = buildRiftView(config, state, TUE);
    expect(view.unlocked).toBe(true);
    expect(view.seasonOpen).toBe(true);
    expect(view.floors).toBe(250);
    expect(view.easyFloors).toBe(100);
    expect(view.lives).toBe(5);
    expect(view.nextFloor).toBe(1);
    expect(view.nextFloorReward?.floor).toBe(20);
    expect(buildRiftView(config, state, MON).seasonOpen).toBe(false);
  });

  it('challenges the next floor: a win advances and pays, a loss costs a life', () => {
    const { config, state } = account();
    const fought = challengeRift(config, state, TUE, 7);
    expect(fought.ok).toBe(true);
    if (!fought.ok) return;
    const rift = fought.value.state.rift;
    expect(rift.challenges).toBe(1);
    if (fought.value.win) {
      expect(rift.highest).toBe(1);
      expect(fought.value.state.currencies.timeCoin).toBeGreaterThan(0);
    } else {
      expect(rift.highest).toBe(0);
      expect(rift.lives).toBe(4);
    }
    expect(challengeRift(config, state, MON).ok).toBe(false);
  });

  it('turns leftover Time Coins into Gold when a new season starts and takes back the Time Credits', () => {
    const { config, state } = account();
    const first = prepareRift(config, state, TUE).state;
    const rich = { ...first, currencies: { ...first.currencies, timeCoin: 40, timeCredit: 9 } };
    const nextWeek = prepareRift(config, rich, TUE + 7 * 86_400_000);
    expect(nextWeek.goldFromCoins).toBe(40 * config.rift.coinToGold);
    expect(nextWeek.state.currencies.gold).toBe(rich.currencies.gold + 40 * config.rift.coinToGold);
    expect(nextWeek.state.currencies.timeCoin).toBe(0);
    expect(nextWeek.state.currencies.timeCredit).toBe(0);
  });

  it('pays a challenge chest once the challenges are reached', () => {
    const { config, state } = account();
    const first = prepareRift(config, state, TUE).state;
    expect(claimRiftChestAction(config, first, TUE, 3).ok).toBe(false);
    const ready = { ...first, rift: { ...first.rift, challenges: 3 } };
    const claimed = claimRiftChestAction(config, ready, TUE, 3);
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.value.state.currencies.pokemonShard5).toBe((ready.currencies.pokemonShard5 ?? 0) + 25);
    expect(claimRiftChestAction(config, claimed.value.state, TUE, 3).ok).toBe(false);
  });
});
