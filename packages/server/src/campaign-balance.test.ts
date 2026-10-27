import { describe, expect, it } from 'vitest';
import { isCleared, orderStages } from '@wildbound/engine';
import { buildConfig } from './config';
import { LocalServer } from './local-server';
import { MemoryStore } from './storage';

/**
 * Campaign difficulty regression (M5, PROMPT §13 "play from first launch to chapter 3").
 *
 * The starting account is six common Wilds; summoning arrives in M6, so chapters
 * 1-3 must be clearable by growing the starter roster alone. This test pins the
 * authored curve: a squad grown to the chapter-3 target profile (Lv26, 3 stars,
 * stage 1) clears every stage through the end of chapter 3.
 *
 * Resources are granted directly so the test isolates the *combat curve* from the
 * economy. The candy/gold these represent are produced in play by campaign
 * first-clears, idle income and daily quests — each covered by its own tests
 * (engine/economy, engine/campaign, LocalServer M5). See docs/design/balance.md.
 */

const START = Date.parse('2026-01-01T00:00:00Z');

function makeServer() {
  const config = buildConfig();
  config.now = () => START;
  return { config, server: new LocalServer(new MemoryStore(), config) };
}

describe('M5 campaign balance', () => {
  it('a grown starter squad clears through the end of chapter 3', async () => {
    const { config, server: srv } = makeServer();
    const load = await srv.loadAccount();
    if (!load.ok) throw new Error('load failed');

    // Fund growth as if the daily loop had run: enough candy/gold/stones/shards
    // for the documented chapter-3 target profile.
    await srv.grantCurrency('candy', 400_000);
    await srv.grantCurrency('gold', 1_200_000);
    await srv.grantCurrency('stone', 60);
    await srv.grantCurrency('shard', 400);

    const after = await srv.loadAccount();
    if (!after.ok) throw new Error('reload failed');
    for (const wild of after.value.state.roster) {
      await srv.levelUp(wild.id, 26 - wild.level);
      for (let stars = wild.stars; stars < 3; stars++) await srv.starUp(wild.id, 1);
      for (let stage = wild.evolutionStage; stage < 1; stage++) await srv.evolve(wild.id);
    }

    const ordered = orderStages(config.stages).filter((stage) => stage.chapter <= 3);
    for (const stage of ordered) {
      const gymId = stage.gate?.gymId;
      if (gymId) {
        let gymWon = false;
        for (let seed = 1; seed <= 40 && !gymWon; seed++) {
          const result = await srv.challengeGym(gymId, seed);
          if (!result.ok) throw new Error(`challengeGym(${gymId}) failed: ${result.error}`);
          gymWon = result.value.win;
        }
        expect(gymWon, `expected to clear ${gymId} within 40 seeds`).toBe(true);
      }
      let won = false;
      // A stage is retryable in play (a fresh battle seed each attempt); a
      // handful of seeds models a player retrying a close fight.
      for (let seed = 1; seed <= 40 && !won; seed++) {
        const result = await srv.challengeStage(stage.id, seed);
        if (!result.ok) throw new Error(`challengeStage(${stage.id}) failed: ${result.error}`);
        won = result.value.win;
      }
      expect(won, `expected to clear ${stage.id} within 40 seeds`).toBe(true);
    }

    const final = await srv.loadAccount();
    if (!final.ok) throw new Error('final load failed');
    expect(isCleared(final.value.state.campaign, 'c3-10')).toBe(true);
  });
});
