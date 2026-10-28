import { describe, expect, it } from 'vitest';
import { createInitialState } from './save';
import { buildConfig } from './config';
import { buildExploreView } from './explore-view';

const NOW = Date.UTC(2026, 0, 21, 12);
const DAY = 86_400_000;

function state(ageDays = 20) {
  const config = buildConfig();
  const account = createInitialState(config);
  account.serverEpoch = NOW - ageDays * DAY;
  return { config, account };
}

describe('Explore hub view', () => {
  it('shows all eight modes locked on a fresh account', () => {
    const { config, account } = state(0);
    const view = buildExploreView(config, account, NOW);
    expect(view.modes).toHaveLength(8);
    expect(view.serverDay).toBe(1);
    expect(view.serverDayNote.length).toBeGreaterThan(0);
    expect(view.modes.every((mode) => !mode.unlocked)).toBe(true);
    expect(view.modes.find((mode) => mode.id === 'pet-home')?.gates[0]?.stageId).toBe('c1-10');
  });

  it('opens modes when every gate is met but leaves later modes locked', () => {
    const { config, account } = state();
    for (const id of ['c1-10', 'c3-10', 'c10-10']) account.campaign.stars[id] = 3;
    account.profile.level = 50;
    const view = buildExploreView(config, account, NOW);
    const byId = new Map(view.modes.map((mode) => [mode.id, mode]));
    expect(byId.get('pet-home')?.unlocked).toBe(true);
    expect(byId.get('misty-woods')?.unlocked).toBe(true);
    expect(byId.get('island-challenge')?.unlocked).toBe(true);
    expect(byId.get('rift-arena')?.unlocked).toBe(true);
    expect(byId.get('ultra-wormhole')?.unlocked).toBe(true);
    expect(byId.get('hoopa-vault')?.unlocked).toBe(true);
    expect(byId.get('sky-pillar')?.unlocked).toBe(false);
    expect(byId.get('faction-tower')?.unlocked).toBe(false);
    expect(byId.get('sky-pillar')?.gates[0]?.stageId).toBe('c7-1');
    expect(byId.get('faction-tower')?.gates[0]?.stageId).toBe('c28-10');
  });

  it('carries daily and weekly reset countdowns', () => {
    const { config, account } = state();
    const view = buildExploreView(config, account, NOW);
    const byId = new Map(view.modes.map((mode) => [mode.id, mode]));
    expect(byId.get('pet-home')?.nextResetMs).toBeGreaterThan(0);
    expect(byId.get('pet-home')?.nextResetMs).toBeLessThanOrEqual(DAY);
    expect(byId.get('faction-tower')?.nextResetMs).toBeGreaterThan(DAY);
    expect(byId.get('faction-tower')?.nextResetMs).toBeLessThanOrEqual(7 * DAY);
  });
});
