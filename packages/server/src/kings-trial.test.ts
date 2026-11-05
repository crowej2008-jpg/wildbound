import { describe, expect, it } from 'vitest';
import { buildConfig } from './config';
import { buildKingsTrialView, challengeTrial, claimAllTrialAchievements, claimTrialChest, trainerUnlocked } from './kings-trial';
import { createInitialState } from './save';

const NOW = Date.UTC(2026, 10, 8, 12);

function account() {
  const config = buildConfig();
  config.now = () => NOW;
  const state = createInitialState(config);
  return { config, state };
}

describe("King's Trial", () => {
  it('lists 36 trainers in 7 regions and keeps Lance shut until the Kanto gyms are beaten', () => {
    const { config, state } = account();
    expect(config.kingsTrial.trainers).toHaveLength(36);
    const lance = config.kingsTrial.trainers[0]!;
    expect(trainerUnlocked(state, lance)).toBe(false);
    expect(challengeTrial(config, state, lance.index, 1).ok).toBe(false);
    const view = buildKingsTrialView(config, state, NOW);
    expect(view.areas).toHaveLength(7);
    expect(view.areas.flatMap((a) => a.trainers)).toHaveLength(36);
  });

  it('turns claimed Champion Points into progress, chests and a fight at 100', () => {
    const { config, state } = account();
    const lance = config.kingsTrial.trainers[0]!;
    const gyms = Object.fromEntries(lance.gyms.map((g) => [`gym-${g}`, true]));
    const ready = { ...state, campaign: { ...state.campaign, gyms: { ...state.campaign.gyms, ...gyms } }, kingsTrial: { ...state.kingsTrial, points: lance.points } };
    expect(trainerUnlocked(ready, lance)).toBe(true);
    const chest = claimTrialChest(config, ready, lance.index, 30);
    expect(chest.ok).toBe(true);
    if (chest.ok) expect(chest.value.rewards).toEqual({ gems: 1000 });
    const fight = challengeTrial(config, ready, lance.index, 3);
    expect(fight.ok).toBe(true);
  });

  it('pays achievement tasks the account has met (login days)', () => {
    const { config, state } = account();
    const login = config.kingsTrial.achTasks.filter((t) => t.event === 'login_day_a').sort((a, b) => a.value - b.value)[0]!;
    const s = { ...state, counters: { ...state.counters, loginDays: login.value } };
    const out = claimAllTrialAchievements(config, s);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value.state.kingsTrial.points).toBeGreaterThanOrEqual(login.points);
  });
});
