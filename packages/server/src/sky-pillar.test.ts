import { describe, expect, it } from 'vitest';
import { buildConfig, type GameConfig } from './config';
import { challengeSkyPillar, claimSkyPillarChest, sweepSkyPillar } from './sky-pillar';
import { buildSkyPillarView } from './sky-pillar-view';
import { createInitialState } from './save';

const START = Date.UTC(2026, 9, 29, 12);

function account(): { config: GameConfig; state: ReturnType<typeof createInitialState> } {
  const config = buildConfig();
  config.now = () => START;
  const state = createInitialState(config);
  state.campaign.stars['c7-1'] = 3;
  state.roster = state.roster.map((wild) => ({ ...wild, level: 80, stars: 6 }));
  return { config, state };
}

function allFloorStars(state: ReturnType<typeof createInitialState>, floor: number, stars: number) {
  const next = { ...state.skyPillar.stars };
  for (let stage = 1; stage <= 10; stage += 1) next[`${floor}:${stage}`] = stars;
  return { ...state, skyPillar: { ...state.skyPillar, stars: next } };
}

describe('Sky Pillar server rules', () => {
  it('refuses the mode until campaign 7-1 is cleared', () => {
    const { config, state } = account();
    state.campaign.stars = {};
    const locked = challengeSkyPillar(config, state, START, 1, 1);
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.error).toBe('resource_locked');

    state.campaign.stars['c7-1'] = 3;
    const view = buildSkyPillarView(config, state, START);
    expect(view.unlocked).toBe(true);
    expect(view.floors).toHaveLength(180);
    expect(view.floors[0]?.wingName).toBe('Ashen Steps');
  });

  it('spends one proof on a first clear, pays the pass, and re-challenges free', () => {
    const { config, state } = account();
    const first = challengeSkyPillar(config, state, START, 1, 1, 7);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.win).toBe(true);
    expect(first.value.extra.firstClear).toBe(true);
    expect(first.value.state.skyPillar.proofs).toBe(5);
    expect(first.value.rewards.potentialShard).toBe(160);
    expect(first.value.extra.bestStars).toBeGreaterThanOrEqual(1);

    const replay = challengeSkyPillar(config, first.value.state, START, 1, 1, 7);
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value.state.skyPillar.proofs).toBe(5);
    expect(replay.value.extra.firstClear).toBe(false);
    expect(replay.value.rewards.potentialShard ?? 0).toBe(0);
  });

  it('sweeps the highest 3-star record and pays half its pass', () => {
    const { config, state } = account();
    const three = {
      ...state,
      skyPillar: {
        ...state.skyPillar,
        proofs: 2,
        stars: { '1:1': 3 },
      },
    };
    const swept = sweepSkyPillar(config, three, START);
    expect(swept.ok).toBe(true);
    if (!swept.ok) return;
    expect(swept.value.floor).toBe(1);
    expect(swept.value.stage).toBe(1);
    expect(swept.value.granted.potentialShard).toBe(80);
    expect(swept.value.state.skyPillar.proofs).toBe(1);

    const none = sweepSkyPillar(config, { ...three, skyPillar: { ...three.skyPillar, stars: {} } }, START);
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.error).toBe('not_ready');
  });

  it('claims each floor chest once when its star target is reached', () => {
    const { config, state } = account();
    const ten = allFloorStars(state, 1, 1);
    const claim = claimSkyPillarChest(config, ten, 1, 10);
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(claim.value.reward.gems).toBe(20);
    expect(claim.value.state.skyPillar.claimedChests).toContain('1:10');
    expect(claim.value.state.currencies.gems).toBe((state.currencies.gems ?? 0) + 20);

    const again = claimSkyPillarChest(config, claim.value.state, 1, 10);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toBe('not_ready');
  });

  it('shows the selected floor with its stage conditions and chest states', () => {
    const { config, state } = account();
    const view = buildSkyPillarView(config, allFloorStars(state, 1, 1), START, 2);
    expect(view.selectedFloor).toBe(2);
    expect(view.detail?.floor).toBe(2);
    expect(view.detail?.stages).toHaveLength(10);
    expect(view.detail?.stages[0]?.conditions).toHaveLength(2);
    expect(view.detail?.stages[0]?.unlocked).toBe(true);
    expect(view.detail?.stages[1]?.unlocked).toBe(false);
    expect(view.floors[0]?.stars).toBe(10);
    expect(view.floors[0]?.chests[0]?.claimable).toBe(true);
    expect(view.totalStars).toBeGreaterThanOrEqual(10);
  });
});
