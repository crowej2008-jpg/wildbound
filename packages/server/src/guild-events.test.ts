import { describe, expect, it } from 'vitest';
import { buildConfig } from './config';
import { buildEventsView, buyShovels, claimMerge, claimShovelMilestone, contributeMerge, exchangeShovel, mergeWindow, shovelWindow, spinShovel } from './events';
import { buildGuildView, claimGuildPacket, donateGuild, feedGuildBeast, guildLines, joinGuild, rollGuild } from './guild';
import { createInitialState } from './save';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 11, 12);

function account(serverDay = 1) {
  const config = buildConfig();
  config.now = () => NOW;
  const state = createInitialState(config);
  state.serverEpoch = NOW - (serverDay - 1) * DAY;
  state.currencies = { ...state.currencies, gold: 10_000_000, gems: 100_000, treasureShovel: 200, treasurePiece: 5000, beastFood: 500, beastFoodPlus: 200, berryEssence: 100_000 } as typeof state.currencies;
  return { config, state };
}

describe('Guild (M16)', () => {
  it('joins a CPU guild, donates five times a day and earns Guild Tokens', () => {
    const { config, state } = account();
    expect(donateGuild(config, state, NOW, 'normal').ok).toBe(false);
    const j = joinGuild(config, state, NOW);
    expect(j.ok).toBe(true);
    if (!j.ok) return;
    let s = j.value;
    for (let i = 0; i < 5; i += 1) {
      const r = donateGuild(config, s, NOW, i % 2 ? 'gems' : 'normal');
      expect(r.ok).toBe(true);
      if (r.ok) s = r.value.state;
    }
    expect(donateGuild(config, s, NOW, 'normal').ok).toBe(false);
    expect(s.currencies.guildCoin).toBeGreaterThan(state.currencies.guildCoin);
    expect(donateGuild(config, s, NOW + DAY, 'normal').ok).toBe(true);
    const later = rollGuild(config, s, NOW + 3 * DAY);
    expect(later.guild!.exp + later.guild!.level * 1e6).toBeGreaterThan(s.guild!.exp + s.guild!.level * 1e6);
  });

  it('red packets need the trainer level; the beast levels from candy and adds stats', () => {
    const { config, state } = account();
    const j = joinGuild(config, state, NOW);
    if (!j.ok) throw new Error('join');
    const low = { ...j.value, profile: { ...j.value.profile, level: 1 } };
    expect(claimGuildPacket(config, low, 1).ok).toBe(false);
    const high = { ...j.value, profile: { ...j.value.profile, level: 10 } };
    const p = claimGuildPacket(config, high, 1);
    expect(p.ok).toBe(true);
    if (p.ok) expect(claimGuildPacket(config, p.value.state, 1).ok).toBe(false);
    const f = feedGuildBeast(config, j.value, 'beastFoodPlus', 200);
    expect(f.ok).toBe(true);
    if (!f.ok) return;
    expect(f.value.state.guild!.beast.level).toBeGreaterThan(1);
    expect(guildLines(config, f.value.state).length).toBeGreaterThan(0);
    expect(buildGuildView(config, f.value.state, NOW).joined).toBe(true);
  });
});

describe('Shovel Carnival (M16)', () => {
  it('runs 4 days every 14 from server day 8', () => {
    const { config, state } = account(1);
    expect(shovelWindow(config, state, NOW)).toMatchObject({ active: false, startsIn: 7 });
    expect(shovelWindow(config, account(8).state, NOW)).toMatchObject({ active: true, daysLeft: 4 });
    expect(shovelWindow(config, account(12).state, NOW).active).toBe(false);
    expect(shovelWindow(config, account(22).state, NOW)).toMatchObject({ active: true, cycle: 1 });
    expect(spinShovel(config, state, NOW, 1).ok).toBe(false);
  });

  it('spins bank credits, grow the pool, unlock milestones; the shop and exchange work', () => {
    const { config, state } = account(8);
    let s = state;
    for (let i = 0; i < 2; i += 1) {
      const r = spinShovel(config, s, NOW + i, 10);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.value.state;
    }
    expect(s.events!.shovel.credits).toBe(200);
    expect(s.events!.shovel.pool).toBeGreaterThanOrEqual(16000);
    expect(s.currencies.treasureShovel).toBe(180);
    const m = claimShovelMilestone(config, s, NOW, 200);
    expect(m.ok).toBe(true);
    expect(claimShovelMilestone(config, s, NOW, 500).ok).toBe(false);
    const b = buyShovels(config, s, NOW, 0, 5);
    expect(b.ok).toBe(true);
    if (b.ok) expect(buyShovels(config, b.value, NOW, 0, 1).ok).toBe(false);
    const x = exchangeShovel(config, s, NOW, 7);
    expect(x.ok).toBe(true);
    if (x.ok) expect(x.value.state.currencies.goldenEggVoucher).toBe((s.currencies.goldenEggVoucher ?? 0) + 1);
    expect(buildEventsView(config, s, NOW).shovel.milestones.length).toBe(18);
  });
});

describe('Merge Event (M16)', () => {
  it('four one-day phases from server day 30; contributions rank against CPUs and pay after the phase', () => {
    const { config, state } = account(30);
    expect(mergeWindow(config, state, NOW)).toMatchObject({ active: true, dayIndex: 0 });
    const c = contributeMerge(config, state, NOW, 100_000);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.value.events!.merge.points.berry).toBe(10_000);
    expect(claimMerge(config, c.value, NOW, 'berry').ok).toBe(false);
    const r = claimMerge(config, c.value, NOW + DAY, 'berry');
    expect(r.ok).toBe(true);
    if (r.ok) expect(claimMerge(config, r.value.state, NOW + DAY, 'berry').ok).toBe(false);
  });
});
