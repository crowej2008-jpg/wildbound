import { describe, expect, it } from 'vitest';
import { buildConfig } from './config';
import { LocalServer } from './local-server';
import { MemoryStore } from './storage';

/**
 * M13.0a gate flow: a story gate is locked until its gym falls, the gym only
 * opens after the previous chapter's last stage, and the first clear pays once.
 */

const START = Date.parse('2026-01-01T00:00:00Z');

function makeServer() {
  const config = buildConfig();
  config.now = () => START;
  return { config, server: new LocalServer(new MemoryStore(), config) };
}

async function grownSave(): Promise<{ srv: LocalServer; json: string }> {
  const { server: srv } = makeServer();
  await srv.loadAccount();
  await srv.grantCurrency('candy', 400_000);
  await srv.grantCurrency('gold', 1_200_000);
  await srv.grantCurrency('stone', 60);
  await srv.grantCurrency('shard', 400);
  const loaded = await srv.loadAccount();
  if (!loaded.ok) throw new Error('load failed');
  for (const wild of loaded.value.state.roster) {
    await srv.levelUp(wild.id, 26 - wild.level);
  }
  const exported = await srv.exportSave();
  if (!exported.ok) throw new Error('export failed');
  return { srv, json: exported.value };
}

function clearThroughChapter2(json: string, throughStage = 10): string {
  const save = JSON.parse(json) as { state: { campaign: { stars: Record<string, number>; gyms: Record<string, boolean> } } };
  save.state.campaign = { stars: {}, gyms: {} };
  for (let chapter = 1; chapter <= 2; chapter += 1) {
    for (let index = 1; index <= 10; index += 1) {
      if (chapter === 2 && index > throughStage) break;
      save.state.campaign.stars[`c${chapter}-${index}`] = 3;
    }
  }
  return JSON.stringify(save);
}

describe('M13.0a gym gates', () => {
  it('blocks 3-1 until the first gym is cleared, then opens it', async () => {
    const { srv, json } = await grownSave();
    const imported = await srv.importSave(clearThroughChapter2(json));
    expect(imported.ok).toBe(true);

    const blocked = await srv.challengeStage('c3-1', 1);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toBe('stage_locked');
      expect(blocked.message).toContain('Cinderwatch Gym');
    }

    let won = false;
    for (let seed = 1; seed <= 40 && !won; seed += 1) {
      const result = await srv.challengeGym('gym-1', seed);
      if (!result.ok) throw new Error(`challengeGym failed: ${result.error}`);
      if (result.value.win) {
        won = true;
        expect(result.value.firstClear).toBe(true);
        expect(result.value.rewards.gold).toBeGreaterThan(0);
        expect(result.value.snapshot.state.campaign.gyms?.['gym-1']).toBe(true);
      }
    }
    expect(won).toBe(true);

    const opened = await srv.challengeStage('c3-1', 1);
    expect(opened.ok).toBe(true);
  });

  it('does not open a gym before the preceding chapter is complete', async () => {
    const { srv, json } = await grownSave();
    const imported = await srv.importSave(clearThroughChapter2(json, 9));
    expect(imported.ok).toBe(true);
    const result = await srv.challengeGym('gym-1', 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('stage_locked');
  });

  it('pays the gym first clear only once', async () => {
    const { srv, json } = await grownSave();
    await srv.importSave(clearThroughChapter2(json));

    let first = null as Awaited<ReturnType<LocalServer['challengeGym']>> | null;
    for (let seed = 1; seed <= 40 && !first; seed += 1) {
      const result = await srv.challengeGym('gym-1', seed);
      if (result.ok && result.value.win) first = result;
    }
    if (!first?.ok) throw new Error('gym did not fall within 40 seeds');
    expect(first.value.firstClear).toBe(true);
    expect(first.value.rewards.gems).toBeGreaterThan(0);

    let replay = null as Awaited<ReturnType<LocalServer['challengeGym']>> | null;
    for (let seed = 41; seed <= 80 && !replay; seed += 1) {
      const result = await srv.challengeGym('gym-1', seed);
      if (result.ok && result.value.win) replay = result;
    }
    if (!replay?.ok) throw new Error('gym replay did not win within 40 seeds');
    expect(replay.value.firstClear).toBe(false);
    expect(replay.value.rewards).toEqual({});
  });
});
