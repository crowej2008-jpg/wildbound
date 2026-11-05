import { describe, expect, it } from 'vitest';
import { orderStages, type AccountState } from '@wildbound/engine';
import { buildChampionshipView, claimLeagueReward, claimWorldReward, climbWorldFloor, playLeagueDay, playWorldKnockout, worldCycle, worldRank } from './championship';
import { buildConfig } from './config';
import { rankedTuning } from './pvp';
import { createInitialState } from './save';

const DAY = 86_400_000;
const TUE = Date.UTC(2026, 10, 3, 12); // play week (cycle from 2026-11-02)
const SUN_KO = Date.UTC(2026, 10, 8, 18, 45);
const SUN_LATE = Date.UTC(2026, 10, 8, 22, 30);
const THU_EVE = Date.UTC(2026, 10, 5, 20, 30);

function account() {
  const config = { ...buildConfig(), now: () => TUE };
  const base = createInitialState(config);
  const roster = base.roster.map((w) => ({ ...w, level: 300, stars: 15 }));
  const ids = roster.slice(0, 6).map((w) => w.id);
  const stages = orderStages(config.stages);
  const stars: Record<string, number> = {};
  for (const s of stages.filter((x) => x.chapter <= Math.max(config.pvp.arenaChapter, config.pvp.rankedChapter))) stars[s.id] = 3;
  const state: AccountState = {
    ...base,
    roster,
    serverEpoch: TUE - 30 * DAY,
    campaign: { ...base.campaign, stars: { ...base.campaign.stars, ...stars } },
    squads: { ...base.squads, championship: [...ids, ...Array(6).fill(null)].slice(0, 6) },
  };
  return { config, state };
}

describe('World Championship', () => {
  it('two-week cycles from 2026-11-02; Poké Ball opens Tuesday 08:00', () => {
    const { config, state } = account();
    expect(worldCycle(config, TUE)).toMatchObject({ key: '2026-11-02', playWeek: true });
    expect(worldCycle(config, TUE + 7 * DAY)).toMatchObject({ key: '2026-11-02', playWeek: false });
    expect(worldCycle(config, TUE + 14 * DAY)).toMatchObject({ key: '2026-11-16', playWeek: true });
    const v = buildChampionshipView(config, state, TUE);
    expect(v.world.tiers.map((x) => x.open)).toEqual([true, false, false]);
    expect(v.world.tiers[0]!.total).toBe(20);
    expect(climbWorldFloor(config, state, TUE, 2).ok).toBe(false);
  });

  it('floors pay their rewards and lift the ladder rank; the knockout needs the top 8; rewards after settling', () => {
    const { config, state } = account();
    let s = state;
    for (let i = 0; i < 12; i += 1) {
      const r = climbWorldFloor(config, s, TUE, 1, i + 1);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.value.state;
      if (!r.value.win) break;
    }
    const cleared = s.championship!.floors['1'] ?? 0;
    expect(cleared).toBeGreaterThan(0);
    expect(worldRank(config, s.championship!)).toBeLessThanOrEqual(61);
    const ko = playWorldKnockout(config, s, SUN_KO);
    if (worldRank(config, s.championship!) > 8) expect(ko.ok).toBe(false);
    const c = claimWorldReward(config, s, SUN_LATE);
    expect(c.ok).toBe(true);
    if (c.ok) expect(claimWorldReward(config, c.value.state, SUN_LATE).ok).toBe(false);
  });
});

describe('League Championship', () => {
  it('needs the top Ranked tier on Thursday; plays from 20:00 UTC; placements pay', () => {
    const { config, state } = account();
    const out = playLeagueDay(config, state, THU_EVE);
    expect(out.ok).toBe(false);
    const top = { ...state, pvp: { ...state.pvp, ranked: { ...state.pvp.ranked, tier: rankedTuning(config).tiers.length - 1 } } } as AccountState;
    const early = playLeagueDay(config, top, Date.UTC(2026, 10, 5, 12));
    expect(early.ok).toBe(false);
    const r = playLeagueDay(config, top, THU_EVE, 5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.battles.length).toBeGreaterThan(0);
    if (r.value.place !== null) {
      const c = claimLeagueReward(config, r.value.state, THU_EVE);
      expect(c.ok).toBe(r.value.place <= 8);
    }
  });
});
