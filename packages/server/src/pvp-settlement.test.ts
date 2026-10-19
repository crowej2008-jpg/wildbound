import { describe, expect, it } from 'vitest';
import { arenaBandIndex, type AccountState } from '@wildbound/engine';
import { buildConfig } from './config';
import { LocalServer } from './local-server';
import { MemoryStore } from './storage';
import { createInitialState, SAVE_KEY, serializeSave } from './save';
import { arenaTuning, rollPvp } from './pvp';

/**
 * M10.4 — the lazy PvP settlement: a week turn pays the Arena band by Mail and
 * resets the credits; a season turn rolls the Ranked ladder. Run from `normalize`
 * on every load, so there is no cron anywhere. See docs/design/pvp.md.
 */

/** A fixed Saturday (UTC) in ISO week 2026-W42. */
const NOW = Date.UTC(2026, 9, 17, 12, 0, 0);
const LAST_WEEK = '2026-W41';
const LAST_SEASON = '2026-W41';

function config() {
  return { ...buildConfig(), now: () => NOW };
}

/** A save that has not been opened since the previous week/season. */
function staleState(cfg: ReturnType<typeof config>, credits = 150): AccountState {
  const base = createInitialState(cfg);
  return {
    ...base,
    pvp: {
      arena: {
        ...base.pvp.arena,
        weekKey: LAST_WEEK,
        day: '2026-10-10',
        credits,
        bestCredits: Math.max(credits, 400),
        bestPlace: 9000,
        attempts: 4,
        battleCount: 3,
        claimedChests: [0],
      },
      ranked: {
        ...base.pvp.ranked,
        season: LAST_SEASON,
        phase: 1,
        tier: 4,
        score: 350,
        matches: 20,
        wins: 12,
        losses: 8,
        attempts: 3,
        claimedTiers: [0, 1],
        claimedGifts: [0],
        streak: 2,
      },
    },
  };
}

describe('PvP weekly settlement (M10.4)', () => {
  it('pays the band by Mail and resets the credits on a week turn', () => {
    const cfg = config();
    const before = staleState(cfg);
    const bands = arenaTuning(cfg).bands;
    const band = bands[arenaBandIndex(before.pvp.arena.credits, bands)]!;

    const rolled = rollPvp(cfg, before, NOW);
    expect(rolled.letter).not.toBeNull();
    expect(rolled.settlement).not.toBeNull();
    if (!rolled.letter || !rolled.settlement) return;

    // The letter is titled "Arena Rewards", carries the band's reward and its id
    // embeds the week that ended, so it can never be written twice.
    expect(rolled.letter.subjectKey).toBe('mail.arena.subject');
    expect(rolled.letter.id).toBe(`mail_arena_${LAST_WEEK}`);
    expect(rolled.letter.grants).toEqual(band.reward);
    expect(rolled.letter.expiresAt).toBe(NOW + cfg.economy.mailTtlHours * 3_600_000);
    expect(rolled.settlement.reward).toEqual(band.reward);

    // The credits fall to the band floor and the week's counters clear.
    expect(rolled.state.pvp.arena.credits).toBe(band.resetCredits);
    expect(rolled.state.pvp.arena.weekKey).toBe('2026-W42');
    expect(rolled.state.pvp.arena.attempts).toBe(0);
    expect(rolled.state.pvp.arena.battleCount).toBe(0);
    expect(rolled.state.pvp.arena.claimedChests).toEqual([]);
    // Achievements and the best-ever readouts survive the reset.
    expect(rolled.state.pvp.arena.bestCredits).toBe(400);
    expect(rolled.state.pvp.arena.bestPlace).toBe(9000);
    expect(rolled.state.mail.some((m) => m.id === rolled.letter!.id)).toBe(true);
  });

  it('clears the day counters without paying when only the day turned', () => {
    const cfg = config();
    const fresh = createInitialState(cfg);
    const stale: AccountState = {
      ...fresh,
      pvp: {
        ...fresh.pvp,
        arena: { ...fresh.pvp.arena, day: '2026-10-10', attempts: 5, battleCount: 4 },
        ranked: { ...fresh.pvp.ranked, day: '2026-10-16', attempts: 6 },
      },
    };
    const rolled = rollPvp(cfg, stale, NOW);
    expect(rolled.letter).toBeNull();
    expect(rolled.settlement).toBeNull();
    expect(rolled.state.pvp.arena.attempts).toBe(0);
    expect(rolled.state.pvp.arena.battleCount).toBe(0);
    expect(rolled.state.pvp.ranked.attempts).toBe(0);
    expect(rolled.state.pvp.arena.weekKey).toBe(stale.pvp.arena.weekKey);
  });

  it('is idempotent: a second roll in the same week changes nothing', () => {
    const cfg = config();
    const first = rollPvp(cfg, staleState(cfg), NOW);
    const second = rollPvp(cfg, first.state, NOW);
    expect(second.letter).toBeNull();
    expect(second.state).toBe(first.state);
    expect(second.state.mail.filter((m) => m.id.startsWith('mail_arena_')).length).toBe(1);
  });

  it('advances the Ranked region and resets the ladder on a season turn', () => {
    const cfg = config();
    const before = staleState(cfg);
    const rolled = rollPvp(cfg, before, NOW);
    const phases = cfg.pvp.ranked.phases.length;
    expect(rolled.state.pvp.ranked.season).toBe('2026-W42');
    expect(rolled.state.pvp.ranked.phase).toBe((before.pvp.ranked.phase + 1) % phases);
    expect(rolled.state.pvp.ranked.tier).toBe(0);
    expect(rolled.state.pvp.ranked.score).toBe(0);
    expect(rolled.state.pvp.ranked.claimedTiers).toEqual([]);
    expect(rolled.state.pvp.ranked.claimedGifts).toEqual([]);
    expect(rolled.state.pvp.ranked.attempts).toBe(0);
  });

  it('reports no change on the same object when nothing turned', () => {
    const cfg = config();
    const settled = rollPvp(cfg, staleState(cfg), NOW).state;
    const same = rollPvp(cfg, settled, NOW);
    expect(same.state).toBe(settled);
  });

  it('settles and claims through the LocalServer boundary', async () => {
    const cfg = config();
    const store = new MemoryStore();
    await store.write(SAVE_KEY, serializeSave(staleState(cfg)));
    const server = new LocalServer(store, cfg);

    const loaded = await server.loadAccount();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const bands = arenaTuning(cfg).bands;
    const band = bands[arenaBandIndex(150, bands)]!;
    const letter = loaded.value.state.mail.find((m) => m.id === `mail_arena_${LAST_WEEK}`);
    expect(letter).toBeDefined();
    expect(loaded.value.state.pvp.arena.credits).toBe(band.resetCredits);

    // The settled save is persisted, so a second load does not pay again.
    const again = await server.loadAccount();
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.state.mail.filter((m) => m.id.startsWith('mail_arena_')).length).toBe(1);

    const claimed = await server.claimMail(`mail_arena_${LAST_WEEK}`);
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.value.granted).toEqual(band.reward);
    expect(claimed.value.snapshot.state.pvp.arena.credits).toBe(band.resetCredits);
    expect(await server.claimMail(`mail_arena_${LAST_WEEK}`)).toMatchObject({ ok: false, error: 'not_ready' });
  });
});
