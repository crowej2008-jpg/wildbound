import { describe, expect, it } from 'vitest';
import { buildConfig, type GameConfig } from './config';
import { LocalServer } from './local-server';
import { MemoryStore } from './storage';
import { migrateSave } from './save';

const START = Date.parse('2026-01-01T00:00:00Z');

function make(): { srv: LocalServer; store: MemoryStore; config: GameConfig; advance: (ms: number) => void } {
  const config = buildConfig();
  let clock = START;
  config.now = () => clock;
  const store = new MemoryStore();
  return {
    srv: new LocalServer(store, config),
    store,
    config,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('LocalServer M5 campaign', () => {
  it('seeds M5 slices and a welcome letter on a fresh account', async () => {
    const { srv } = make();
    const load = await srv.loadAccount();
    expect(load.ok).toBe(true);
    if (!load.ok) return;
    const s = load.value.state;
    expect(s.campaign.stars).toEqual({});
    expect(s.quests.progress).toEqual({});
    expect(s.tutorial).toEqual({ step: 0, done: false });
    expect(s.mail.some((m) => m.id === 'mail_welcome' && !m.claimed)).toBe(true);
  });

  it('clears the first stage, grants rewards and records stars', async () => {
    const { srv } = make();
    const result = await srv.challengeStage('c1-1', 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.win).toBe(true);
    expect(result.value.firstClear).toBe(true);
    expect(result.value.stars).toBeGreaterThanOrEqual(1);
    const s = result.value.snapshot.state;
    expect(s.campaign.stars['c1-1']).toBe(result.value.stars);
    expect(s.currencies.gold).toBeGreaterThan(0);
    expect(s.idle.bestStageId).toBe('c1-1');
    expect(s.quests.progress.winBattle).toBe(1);
    expect(result.value.rewards.gold).toBe(600);
  });

  it('locks stages until the previous one is cleared', async () => {
    const { srv } = make();
    const locked = await srv.challengeStage('c1-2', 1);
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.error).toBe('stage_locked');
  });

  it('sweeps a cleared stage for the repeat reward and refuses an uncleared one', async () => {
    const { srv } = make();
    expect((await srv.sweepStage('c1-1')).ok).toBe(false);
    await srv.challengeStage('c1-1', 1);
    const sweep = await srv.sweepStage('c1-1');
    expect(sweep.ok).toBe(true);
    if (!sweep.ok) return;
    expect(sweep.value.granted.gold).toBe(100);
    expect(sweep.value.snapshot.state.quests.progress.sweepStage).toBe(1);
  });

  it('rejects an unknown stage', async () => {
    const { srv } = make();
    const bad = await srv.challengeStage('nope', 1);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBe('not_found');
  });
});

describe('LocalServer M5 idle', () => {
  it('accrues and claims idle income from the best cleared stage', async () => {
    const { srv, advance } = make();
    const none = await srv.claimIdle();
    expect(none.ok).toBe(false);
    await srv.challengeStage('c1-1', 1);
    advance(60 * 60_000);
    const claim = await srv.claimIdle();
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(claim.value.granted.gold).toBe(3600);
    expect(claim.value.granted.candy).toBe(360);
    const again = await srv.claimIdle();
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toBe('not_ready');
  });

  it('quick-collects (R8: VIP 0 has one a day, free) and enforces the daily limit', async () => {
    const { srv } = make();
    await srv.challengeStage('c1-1', 1);
    await srv.grantCurrency('gems', 1000);
    for (let i = 0; i < 1; i++) {
      const quick = await srv.claimIdle(true);
      expect(quick.ok).toBe(true);
    }
    const over = await srv.claimIdle(true);
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toBe('daily_limit');
  });
});

describe('LocalServer M5 daily', () => {
  it('completes and claims a quest only when ready', async () => {
    const { srv } = make();
    const early = await srv.claimQuest('q_win3');
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.error).toBe('not_ready');
    for (let i = 0; i < 3; i++) await srv.challengeStage('c1-1', 1);
    const claim = await srv.claimQuest('q_win3');
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(claim.value.granted.gold).toBe(800);
    expect(claim.value.snapshot.state.quests.claimed).toContain('q_win3');
  });

  it('claims an activity chest once the threshold is reached', async () => {
    const { srv } = make();
    const early = await srv.claimActivityChest(0);
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.error).toBe('not_ready');
    for (let i = 0; i < 3; i++) await srv.challengeStage('c1-1', 1);
    await srv.claimQuest('q_win3');
    const chest = await srv.claimActivityChest(0);
    expect(chest.ok).toBe(true);
    if (!chest.ok) return;
    expect(chest.value.granted.gold).toBe(1000);
  });

  it('claims and claims-all mail', async () => {
    const { srv } = make();
    const load = await srv.loadAccount();
    if (!load.ok) return;
    const one = await srv.claimMail('mail_welcome');
    expect(one.ok).toBe(true);
    if (!one.ok) return;
    expect(one.value.granted.gems).toBe(50);
    const none = await srv.claimAllMail();
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.error).toBe('not_ready');
  });

  it('resets quests at the next UTC midnight', async () => {
    const { srv, advance } = make();
    await srv.challengeStage('c1-1', 1);
    const before = await srv.loadAccount();
    if (!before.ok) return;
    expect(before.value.state.quests.progress.winBattle).toBe(1);
    advance(24 * 60 * 60_000);
    const after = await srv.loadAccount();
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.state.quests.progress).toEqual({});
    expect(after.value.state.campaign.stars['c1-1']).toBeGreaterThanOrEqual(1);
  });
});

describe('LocalServer M5 tutorial and debug clock', () => {
  it('walks the tutorial and can skip it', async () => {
    const { srv } = make();
    const skip = await srv.skipTutorial();
    expect(skip.ok).toBe(true);
    if (!skip.ok) return;
    expect(skip.value.state.tutorial.done).toBe(true);
  });

  it('advances the debug clock by whole minutes and fast-forwards idle income', async () => {
    const { srv } = make();
    expect((await srv.debugAdvanceClock(-5)).ok).toBe(false);

    await srv.challengeStage('c1-1', 1);
    const before = await srv.claimIdle();
    expect(before.ok).toBe(false);

    // The offset is minutes, so 8h of debug time fills the VIP 0 idle cap (R8: source 8 h) exactly.
    const advanced = await srv.debugAdvanceClock(480);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    expect(advanced.value.state.debugClockOffset).toBe(480);

    const claim = await srv.claimIdle();
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(claim.value.granted.gold).toBe(60 * 480);
    expect(claim.value.granted.candy).toBe(6 * 480);
  });
});

describe('save migration', () => {
  it('refuses a v1 save as outdated since the source-retrofit reset', () => {
    const v1 = {
      version: 1,
      state: {
        schemaVersion: 1,
        profile: { name: 'Old', level: 1, xp: 0 },
        roster: [],
        squads: {},
        strategies: {},
        currencies: { gold: 10, gems: 0, candy: 0, shard: 0, stone: 0 },
        nextInstanceSeq: 1,
      },
    };
    const migrated = migrateSave(v1, START);
    expect(migrated.ok).toBe(false);
    if (!migrated.ok) expect(migrated.error).toBe('outdated_save');
  });
});
