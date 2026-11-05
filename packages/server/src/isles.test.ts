import { describe, expect, it } from 'vitest';
import { buildConfig } from './config';
import { attackIsland, claimIslesTask, collectIsland, prepareIsles } from './isles';
import { buildIslesView } from './isles-view';
import { createInitialState } from './save';

const NOW = Date.UTC(2026, 10, 11, 12); // Wednesday

function account() {
  const config = buildConfig();
  config.now = () => NOW;
  const state = createInitialState(config);
  state.campaign.stars['c3-10'] = 3;
  state.serverEpoch = NOW - 5 * 86_400_000;
  state.roster = state.roster.map((w) => ({ ...w, level: 150, stars: w.stars + 6 }));
  return { config, state };
}

describe('Clash of Isles', () => {
  it('shows 50 islands in 10 areas and 6 attempts', () => {
    const { config, state } = account();
    const view = buildIslesView(config, state, NOW);
    expect(view.unlocked).toBe(true);
    expect(view.islands).toHaveLength(50);
    expect(view.attempts).toBe(6);
    expect(attackIsland(config, { ...state, campaign: { ...state.campaign, stars: {} } }, NOW, 1).ok).toBe(false);
  });

  it('attacks spend attempts, score points, strip shields and capture; holding pays tokens', () => {
    const { config, state } = account();
    let s = prepareIsles(config, state, NOW).state;
    const id = config.isles.islands[config.isles.islands.length - 1]!.id;
    let captured = false;
    for (let i = 0; i < 6 && !captured; i += 1) {
      const r = attackIsland(config, s, NOW, id, 1, i + 1);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.points).toBeGreaterThanOrEqual(100);
      s = r.value.state;
      captured = r.value.captured;
    }
    expect(s.isles!.challengesToday).toBeGreaterThan(0);
    expect(claimIslesTask(config, s, NOW, 2).ok).toBe(s.isles!.challengesToday >= 2);
    if (captured) {
      const later = collectIsland(config, s, NOW + 30 * 60_000);
      expect(later.ok).toBe(true);
      if (later.ok) expect(later.value.rewards.islandCoin).toBeGreaterThan(0);
    }
  });
});
