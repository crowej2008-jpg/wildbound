import { describe, expect, it } from 'vitest';
import { orderStages, type AccountState } from '@wildbound/engine';
import { buildConfig } from './config';
import { createInitialState } from './save';
import { buildTempleView, challengeSeat, cpuChallenge, prepareTemple } from './temple';

const NOW = Date.UTC(2026, 10, 11, 12);
const DAY = 86_400_000;

function account(credits: number) {
  const config = { ...buildConfig(), now: () => NOW };
  const base = createInitialState(config);
  const stages = orderStages(config.stages).filter((s) => s.chapter === config.pvp.arenaChapter);
  const roster = base.roster.map((w) => ({ ...w, level: 200, stars: w.stars + 8 }));
  const ids = roster.slice(0, 6).map((w) => w.id);
  const state: AccountState = {
    ...base,
    roster,
    campaign: { ...base.campaign, stars: { ...base.campaign.stars, [stages[stages.length - 1]!.id]: 3 } },
    squads: { ...base.squads, temple: [...ids, ...Array(6).fill(null)].slice(0, 6) },
    pvp: { ...base.pvp, arena: { ...base.pvp.arena, credits } },
  };
  return { config, state };
}

describe('SPT Temple', () => {
  it('six thrones held by CPUs; seats need an Arena place', () => {
    const { config, state } = account(0);
    const v = buildTempleView(config, state, NOW);
    expect(v.unlocked).toBe(true);
    expect(v.seats).toHaveLength(6);
    expect(v.seats.every((s) => !s.you)).toBe(true);
    expect(challengeSeat(config, state, NOW, 'eternity1', 1).ok).toBe(false);
  });

  it('winning takes the seat and its title; losing costs 20 minutes; CPU challengers can retake it', () => {
    const { config, state } = account(1_000_000);
    expect(buildTempleView(config, state, NOW).place).toBeLessThanOrEqual(50);
    let s = state;
    let took = false;
    for (let i = 0; i < 6 && !took; i += 1) {
      const r = challengeSeat(config, s, NOW + i * 30 * 60_000, 'vanguard3', 1, i + 1);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.value.state;
      took = r.value.took;
      if (!r.value.win) expect(challengeSeat(config, s, NOW + i * 30 * 60_000 + 60_000, 'vanguard3', 1).ok).toBe(false);
    }
    if (!took) return;
    expect(s.temple!.seat).toBe('vanguard3');
    expect(s.titles.owned['2003']).toBeDefined();
    const seat = config.temple.seats.find((x) => x.id === 'vanguard3')!;
    let days = 1;
    while (cpuChallenge(config, seat, days) <= s.temple!.evolution) days += 1;
    const later = prepareTemple(config, s, s.temple!.since + days * DAY + 1000);
    expect(later.temple!.seat).toBeNull();
    expect(later.titles.owned['2003']).toBeUndefined();
  });
});
