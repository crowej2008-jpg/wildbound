import { describe, expect, it } from 'vitest';
import { buildConfig } from './config';
import { joinGuild } from './guild';
import { attemptsToday, buildGuildWarView, challengeGuildBoss, claimGuildWarDaily, prepareGuildWar } from './guild-war';
import { attackGrid, buildRelicView, claimRelicTask, cpuHoldings, exploreRelic, relicSeason } from './relic';
import { createInitialState } from './save';

const DAY = 86_400_000;
const WED = Date.UTC(2026, 10, 11, 12); // Wednesday 12:00 UTC
const MON = Date.UTC(2026, 10, 9, 12);

function account(now = WED) {
  const config = buildConfig();
  config.now = () => now;
  let state = createInitialState(config);
  const j = joinGuild(config, state, now);
  if (!j.ok) throw new Error('join');
  state = j.value;
  state.roster = state.roster.map((w) => ({ ...w, level: 150, stars: w.stars + 6 }));
  const ids = state.roster.slice(0, 6).map((w) => w.id);
  state.squads = { ...state.squads, guildWar: [...ids, ...Array(6 - ids.length).fill(null)].slice(0, 6), relic: [...ids, ...Array(6 - ids.length).fill(null)].slice(0, 6) };
  return { config, state };
}

function withActivity(config: ReturnType<typeof buildConfig>, state: ReturnType<typeof createInitialState>, now: number) {
  const day = new Date(now).toISOString().slice(0, 10);
  const claimed = config.quests.map((q) => q.id);
  return { ...state, quests: { ...state.quests, day, claimed } };
}

describe('Guild War (M17)', () => {
  it('needs a guild; attempts come from daily activity', () => {
    const { config, state } = account();
    expect(challengeGuildBoss(config, { ...state, guild: null }, WED, 0).ok).toBe(false);
    const day = new Date(WED).toISOString().slice(0, 10);
    expect(attemptsToday(config, { ...state, quests: { ...state.quests, day, claimed: [] } }, WED).earned).toBe(0);
    expect(attemptsToday(config, withActivity(config, state, WED), WED).earned).toBe(3);
  });

  it('a challenge deals damage, pays Guild Chests and spends an attempt; CPU members progress the bosses', () => {
    const { config, state } = account();
    const s = withActivity(config, state, WED);
    const r = challengeGuildBoss(config, s, WED, 0, 11);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.damage).toBeGreaterThan(0);
    expect(r.value.rewards.guildCoin).toBeGreaterThanOrEqual(300);
    expect(attemptsToday(config, r.value.state, WED).used).toBe(1);
    const later = prepareGuildWar(config, r.value.state, WED + 2 * DAY);
    const v = buildGuildWarView(config, later, WED + 2 * DAY);
    expect(v.bosses).toHaveLength(5);
    expect(v.difficulty).toBeGreaterThanOrEqual(1);
    expect(claimGuildWarDaily(config, r.value.state, WED + DAY).ok).toBe(true);
  });
});

describe('Relic Battlefield (M17)', () => {
  it('runs Tuesday 09:00 to Sunday 22:00 UTC', () => {
    expect(relicSeason(MON)).toBeNull();
    expect(relicSeason(WED)?.day).toBe(2);
    const sun = Date.UTC(2026, 10, 15, 21);
    expect(relicSeason(sun)?.day).toBe(6);
    expect(relicSeason(sun + 2 * 3_600_000)).toBeNull();
  });

  it('starts at the base; attacks only next to held grids; CPU guilds hold grids', () => {
    const { config, state } = account();
    const v = buildRelicView(config, state, WED);
    expect(v.grids).toHaveLength(91);
    expect(v.grids.find((g) => g.index === 1)!.owner).toBe('you');
    expect(v.standings).toHaveLength(4);
    expect(cpuHoldings(config, [1], 2).size).toBeGreaterThan(3);
    const far = v.grids.find((g) => !g.attackable && g.owner === 'neutral')!;
    expect(attackGrid(config, state, WED, far.index).ok).toBe(false);
    const near = v.grids.find((g) => g.attackable)!;
    let s = state;
    let captured = false;
    for (let i = 0; i < 8 && !captured; i += 1) {
      const r = attackGrid(config, s, WED, near.index, i + 1);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.value.state;
      captured = r.value.captured;
    }
    expect(captured).toBe(true);
    expect(s.relic!.held).toContain(near.index);
    expect(s.relic!.stamina).toBeLessThan(150);
    const t = claimRelicTask(config, s, WED, 2004);
    expect(t.ok).toBe(false);
  });

  it('explore rolls an event with a cooldown', () => {
    const { config, state } = account();
    const e = exploreRelic(config, state, WED);
    expect(e.ok).toBe(true);
    if (!e.ok) return;
    expect([3, 4, 5]).toContain(e.value.event.type);
    expect(exploreRelic(config, e.value.state, WED + 1000).ok).toBe(false);
    expect(exploreRelic(config, e.value.state, WED + 121_000).ok).toBe(true);
  });
});
