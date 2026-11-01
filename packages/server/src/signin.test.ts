import { describe, expect, it } from 'vitest';
import { buildConfig } from './config';
import { createInitialState } from './save';
import {
  buildSignInView,
  claimSignInMilestoneAction,
  doubleSignInAction,
  patchSignInAction,
  rollSignIn,
  signTodayAction,
} from './signin';

const DAY = 86_400_000;
const START = Date.parse('2026-03-01T08:00:00Z');

function makeState() {
  const config = buildConfig();
  config.now = () => START;
  const state = createInitialState(config);
  return { config, state };
}

describe('R9 Sign In from the source', () => {
  it('ships 31 days of five repeating rewards with VIP ribbons from VIP 1 to 10, and 11 bonuses', () => {
    const { config } = makeState();
    expect(config.signIn.days).toHaveLength(31);
    expect(config.signIn.days[0]).toEqual({ day: 1, rewards: { ticketPremium: 1 }, vipDouble: 1 });
    expect(config.signIn.days[1]).toEqual({ day: 2, rewards: { gems: 100 }, vipDouble: null });
    expect(config.signIn.days[30]!.vipDouble).toBe(10);
    expect(config.signIn.milestones.map((m) => m.days)).toEqual([2, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31]);
    expect(config.signIn.milestones[0]!.rewards).toEqual({ gems: 10, pokemonShard3: 40, stone: 25 });
    expect([config.signIn.patchDays, config.signIn.patchGems]).toEqual([30, 10]);
  });

  it('signs today once, pays double from the ribbon VIP level, and doubles later when VIP rises', () => {
    const { config, state } = makeState();
    const first = signTodayAction(config, state, START);
    if (!first.ok) throw new Error(first.message);
    expect(first.value.granted).toEqual({ ticketPremium: 1 }); // VIP 0 < ribbon VIP 1
    expect(signTodayAction(config, first.value.state, START).ok).toBe(false);

    const vip = { ...first.value.state, currencies: { ...first.value.state.currencies, privilegeXp: 60 } }; // VIP 12
    const doubled = doubleSignInAction(config, vip, 1, START);
    if (!doubled.ok) throw new Error(doubled.message);
    expect(doubled.value.granted).toEqual({ ticketPremium: 1 });
    expect(doubleSignInAction(config, doubled.value.state, 1, START).ok).toBe(false);

    const day3 = signTodayAction(config, doubled.value.state, START + 2 * DAY);
    if (!day3.ok) throw new Error(day3.message);
    expect(day3.value.granted).toEqual({ gold: 200_000 }); // day 3 ribbon VIP 2
  });

  it('patches a missed day for 10 Diamonds and pays the signed-day bonuses', () => {
    const { config, state } = makeState();
    const later = START + 2 * DAY; // day 3
    const today = signTodayAction(config, state, later);
    if (!today.ok) throw new Error(today.message);
    const view = buildSignInView(config, today.value.state, later);
    expect(view.today).toBe(3);
    expect(view.days[0]!.canPatch).toBe(true);
    expect(view.days[3]!.status).toBe('future');

    const gems = today.value.state.currencies.gems;
    const patched = patchSignInAction(config, today.value.state, 1, later);
    if (!patched.ok) throw new Error(patched.message);
    expect(patched.value.state.currencies.gems).toBe(gems - 10);
    expect(patchSignInAction(config, patched.value.state, 3, later).ok).toBe(false); // today is not a missed day

    const bonus = claimSignInMilestoneAction(config, patched.value.state, 0, later);
    if (!bonus.ok) throw new Error(bonus.message);
    expect(bonus.value.granted).toEqual({ gems: 10, pokemonShard3: 40, stone: 25 });
    expect(claimSignInMilestoneAction(config, bonus.value.state, 1, later).ok).toBe(false);
  });

  it('starts a fresh calendar the day after day 31', () => {
    const { state } = makeState();
    const signed = { ...state.signIn, signed: [1, 2] };
    expect(rollSignIn(signed, START + 30 * DAY)).toBe(signed);
    const next = rollSignIn(signed, START + 31 * DAY);
    expect(next.signed).toEqual([]);
    expect(next.calendarStart).toBe('2026-04-01');
    expect(rollSignIn(signed, START + 65 * DAY).calendarStart).toBe('2026-05-02');
  });
});
