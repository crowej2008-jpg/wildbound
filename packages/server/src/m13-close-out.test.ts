import { describe, expect, it } from 'vitest';
import { mistyCycleEndsIn, xpForLevel, type MistyRules } from '@wildbound/engine';
import { buildConfig } from './config';
import { buildExploreView } from './explore-view';
import { LocalServer } from './local-server';
import { createInitialState } from './save';
import { MemoryStore } from './storage';
import { SAVE_VERSION } from './save';

/**
 * M13.10 close-out: every Explore mode is live, opens once its gates are met, and its own screen loads through the
 * server boundary on a fresh account that has met every gate; the hub's countdowns match each mode's cycle.
 */

const NOW = Date.UTC(2026, 10, 8, 12);

function opened() {
  const config = buildConfig();
  config.now = () => NOW;
  const state = createInitialState(config);
  for (const id of ['c1-10', 'c3-10', 'c7-1', 'c10-10', 'c28-10']) state.campaign.stars[id] = 3;
  state.profile.level = 50;
  state.profile.xp = xpForLevel(50, config.xpCurve);
  state.serverEpoch = NOW - 30 * 86_400_000;
  return { config, state };
}

describe('M13 close-out', () => {
  it('has eight live Explore modes, all open once every gate is met', () => {
    const { config, state } = opened();
    const view = buildExploreView(config, state, NOW);
    expect(view.modes).toHaveLength(8);
    for (const m of view.modes) {
      expect(m.status).toBe('live');
      expect(m.unlocked).toBe(true);
    }
    const misty = view.modes.find((m) => m.id === 'misty-woods')!;
    expect(misty.nextResetMs).toBe(mistyCycleEndsIn(config.misty as unknown as MistyRules, NOW));
    expect(view.modes.find((m) => m.id === 'dig-site')!.nextResetMs).toBeNull();
  });

  it("loads every mode's screen through the server boundary", async () => {
    const { config, state } = opened();
    const server = new LocalServer(new MemoryStore(), config);
    const imported = await server.importSave(JSON.stringify({ version: SAVE_VERSION, state }));
    expect(imported.ok).toBe(true);
    const views = await Promise.all([
      server.getHoopaVault(),
      server.getRift(),
      server.getSkyPillar(),
      server.getFactionTower(),
      server.getMisty(),
      server.getPetHome(),
      server.getBerryGrove(),
      server.getDigSite(),
    ]);
    for (const v of views) {
      expect(v.ok).toBe(true);
      if (v.ok) expect((v.value as { unlocked?: boolean }).unlocked ?? true).toBe(true);
    }
  });
});
