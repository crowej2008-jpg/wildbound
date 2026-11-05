import { describe, expect, it } from 'vitest';
import { buildConfig } from './config';
import { bestIdleRate } from './economy';
import { equippedSheet } from './battle';
import { badgePerk, buildVictoryRoadView, claimBadgeDaily, claimVictoryChest, claimVictoryTask, gymProgress } from './victory-road';
import { createInitialState } from './save';

const NOW = Date.UTC(2026, 10, 8, 12);

function account() {
  const config = buildConfig();
  config.now = () => NOW;
  const state = createInitialState(config);
  return { config, state };
}

describe('Victory Road', () => {
  it('lists 8 regions and 60 gyms with their source badges', () => {
    const { config, state } = account();
    const view = buildVictoryRoadView(config, state, NOW);
    expect(view.areas).toHaveLength(8);
    expect(view.areas.flatMap((a) => a.gyms)).toHaveLength(60);
    expect(view.areas[0]!.gyms[0]!.badge).toBe('Boulder Badge');
  });

  it('reaches a gym at 30, its task makes 60, a win makes 100; chests pay once each', () => {
    const { config, state } = account();
    for (let i = 1; i <= 10; i += 1) state.campaign.stars[`c2-${i}`] = 3;
    for (let c = 1; c <= 1; c += 1) for (let i = 1; i <= 10; i += 1) state.campaign.stars[`c${c}-${i}`] = 3;
    const gym = config.victoryRoad.gyms[0]!;
    state.profile.level = 1;
    expect(gymProgress(config, state, gym)).toMatchObject({ status: 'reached', progress: 30 });
    const chest = claimVictoryChest(config, state, 1, 30);
    expect(chest.ok).toBe(true);
    if (!chest.ok) return;
    expect(chest.value.state.currencies.gems).toBe(state.currencies.gems + 20);
    expect(claimVictoryChest(config, chest.value.state, 1, 30).ok).toBe(false);
    expect(claimVictoryChest(config, chest.value.state, 1, 60).ok).toBe(false);
    expect(claimVictoryTask(config, state, 1).ok).toBe(false);
    const leveled = { ...chest.value.state, profile: { ...chest.value.state.profile, level: 5 } };
    expect(gymProgress(config, leveled, gym).progress).toBe(60);
    expect(claimVictoryTask(config, leveled, 1).ok).toBe(true);
    const beaten = { ...leveled, campaign: { ...leveled.campaign, gyms: { 'gym-1': true } } };
    expect(gymProgress(config, beaten, gym).progress).toBe(100);
    expect(claimVictoryChest(config, beaten, 1, 100).ok).toBe(true);
  });

  it('badges: the top AFK badge raises idle income, stat badges raise their class / faction, the top badge pays daily', () => {
    const { config, state } = account();
    state.campaign.stars['c1-1'] = 3;
    const before = bestIdleRate(config, state);
    const gyms: Record<string, boolean> = {};
    for (let i = 1; i <= 11; i += 1) gyms[`gym-${i}`] = true;
    const s = { ...state, campaign: { ...state.campaign, gyms } };
    expect(badgePerk(config, s, 'afk')).toBe(0.12);
    expect(bestIdleRate(config, s).gold).toBeCloseTo((before.gold ?? 0) * 1.12);
    const striker = s.roster.find((w) => config.species.get(w.speciesId)?.className === 'striker');
    if (striker) expect(equippedSheet(striker, config, s)!.sheet.pAtk).toBeGreaterThan(equippedSheet(striker, config, state)!.sheet.pAtk);
    const daily = claimBadgeDaily(config, s, NOW);
    expect(daily.ok).toBe(true);
    if (daily.ok) expect(daily.value.rewards).toEqual({ gems: 150 });
    if (daily.ok) expect(claimBadgeDaily(config, daily.value.state, NOW).ok).toBe(false);
  });
});
