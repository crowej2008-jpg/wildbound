import { describe, expect, it } from 'vitest';
import { buildConfig } from './config';
import { joinGuild } from './guild';
import { attackParkBoss, bossWindow, buildParkView, claimParkBoss, collapsed, enterPark, explorePark, fightWild, hatchEggs, movePark, parkOpen, skipWild } from './park';
import { createInitialState } from './save';

const WED10 = Date.UTC(2026, 10, 11, 10); // Wednesday 10:00 UTC
const MIN = 60_000;

function account(now = WED10) {
  const config = buildConfig();
  config.now = () => now;
  let state = createInitialState(config);
  const j = joinGuild(config, state, now);
  if (!j.ok) throw new Error('join');
  state = j.value;
  state.roster = state.roster.map((w) => ({ ...w, level: 150, stars: w.stars + 6 }));
  const ids = state.roster.slice(0, 6).map((w) => w.id);
  state.squads = { ...state.squads, park: [...ids, ...Array(6).fill(null)].slice(0, 6) };
  return { config, state };
}

describe('Pokémon Park', () => {
  it('opens Tuesday–Sunday 09:00–21:00 UTC; grids collapse by phase', () => {
    const { config } = account();
    expect(parkOpen(config, WED10)).toBe(true);
    expect(parkOpen(config, Date.UTC(2026, 10, 9, 10))).toBe(false); // Monday
    expect(parkOpen(config, Date.UTC(2026, 10, 11, 22))).toBe(false);
    expect(collapsed(config, 4, WED10)).toBe(false);
    expect(collapsed(config, 4, Date.UTC(2026, 10, 11, 12, 30))).toBe(true);
    expect(collapsed(config, 5, Date.UTC(2026, 10, 11, 20))).toBe(false);
  });

  it('enter, move (1 stamina), explore for wild Pokémon or eggs; skip or fight', () => {
    const { config, state } = account();
    const e = enterPark(config, state, WED10, 10);
    expect(e.ok).toBe(true);
    if (!e.ok) return;
    const m = movePark(config, e.value, WED10, 5);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.value.park!.stamina).toBe(29);
    expect(movePark(config, m.value, WED10, 19).ok).toBe(false);
    let s = m.value;
    let sawWild = false;
    let sawEgg = false;
    for (let i = 0; i < 12; i += 1) {
      const x = explorePark(config, s, WED10 + i * 1000);
      expect(x.ok).toBe(true);
      if (!x.ok) return;
      s = x.value.state;
      if (x.value.found === 'egg') sawEgg = true;
      else {
        sawWild = true;
        const r = i % 2 ? skipWild(config, s, WED10) : fightWild(config, s, WED10, i + 1);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        s = 'state' in r.value ? r.value.state : r.value;
        if (s.park!.grid === null) break;
      }
    }
    expect(sawWild || sawEgg).toBe(true);
    if (s.park!.bag.length) {
      expect(hatchEggs(config, s, WED10).ok).toBe(false);
      expect(hatchEggs(config, s, WED10 + 31 * MIN).ok).toBe(true);
    }
    expect(buildParkView(config, s, WED10).grids).toHaveLength(19);
  });

  it('the boss is out 12:15–12:25; attacks score; rewards after the window', () => {
    const at = Date.UTC(2026, 10, 11, 12, 16);
    const { config, state } = account(at);
    expect(bossWindow(config, at)).not.toBeNull();
    expect(attackParkBoss(config, state, WED10).ok).toBe(false);
    const a = attackParkBoss(config, state, at, 3);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.value.damage).toBeGreaterThan(0);
    expect(claimParkBoss(config, a.value.state, at).ok).toBe(false);
    const c = claimParkBoss(config, a.value.state, at + 15 * MIN);
    expect(c.ok).toBe(true);
  });
});
