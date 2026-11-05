import { dayKey, weekKey, type AccountState } from '@wildbound/engine';

/**
 * M14.2 activity counters (lifetime and this UTC week) for task systems such as King's Trial. Login days count the
 * distinct UTC days the account saved anything.
 */

export type CounterKey = 'premiumDraws' | 'goldShopBuys' | 'worldBoss' | 'skyPillar' | 'rift' | 'ranked' | 'arenaWinsHigher' | 'weeklyTasks';

type Counters = AccountState['counters'];

function rolled(c: Counters, now: number): Counters {
  const week = weekKey(now);
  return c.week === week ? c : { ...c, week, weekly: {} };
}

export function bumpCounter(state: AccountState, now: number, key: CounterKey, n = 1): AccountState {
  const c = rolled(state.counters, now);
  return {
    ...state,
    counters: { ...c, total: { ...c.total, [key]: (c.total[key] ?? 0) + n }, weekly: { ...c.weekly, [key]: (c.weekly[key] ?? 0) + n } },
  };
}

export function stampLogin(state: AccountState, now: number): AccountState {
  const day = dayKey(now);
  if (state.counters.lastDay === day) return state;
  return { ...state, counters: { ...rolled(state.counters, now), loginDays: state.counters.loginDays + 1, lastDay: day } };
}

export function counter(state: AccountState, key: CounterKey): number {
  return state.counters.total[key] ?? 0;
}

export function weeklyCounter(state: AccountState, now: number, key: CounterKey): number {
  return state.counters.week === weekKey(now) ? (state.counters.weekly[key] ?? 0) : 0;
}
