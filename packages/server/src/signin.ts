import { dayKey, type AccountState, type Rewards, type SignInState } from '@wildbound/engine';
import type { GameConfig } from './config';
import { applyGrant } from './economy';
import { fail, ok, type Result } from './index';
import { vipPerks } from './vip';

/**
 * R9 Sign In, copied from the source (packages/content/tuning/signin.json, scripts/import-signin.mjs). One day of a
 * 31-day calendar is signed per game day; a day with a VIP ribbon pays double at that VIP level or higher (and can
 * be doubled later when the VIP level rises); a missed day can be signed up to 30 days later for 10 Diamonds; signed
 * days add up to 11 bonuses. The next calendar starts the day after day 31 (the calendars are identical).
 * Readings in ASSUMPTIONS #76.
 */

const DAY_MS = 86_400_000;
const CALENDAR_DAYS = 31;

export type SignDayStatus = 'signed' | 'today' | 'missed' | 'future';

export interface SignDayView {
  day: number;
  rewards: Rewards;
  vipDouble: number | null;
  status: SignDayStatus;
  doubled: boolean;
  /** Signed, not doubled, and the VIP level now reaches the ribbon. */
  canDouble: boolean;
  /** Missed and still inside the patch window. */
  canPatch: boolean;
}

export interface SignInView {
  today: number;
  signedCount: number;
  patchGems: number;
  vipLevel: number;
  days: SignDayView[];
  milestones: { index: number; days: number; rewards: Rewards; claimed: boolean; ready: boolean }[];
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** Move to the calendar that holds `now` (a fresh one after day 31). */
export function rollSignIn(state: SignInState, now: number): SignInState {
  const today = dayKey(now);
  const elapsed = daysBetween(state.calendarStart, today);
  if (elapsed < CALENDAR_DAYS) return state;
  const start = dayKey(Date.parse(`${state.calendarStart}T00:00:00Z`) + Math.floor(elapsed / CALENDAR_DAYS) * CALENDAR_DAYS * DAY_MS);
  return { calendarStart: start, signed: [], doubled: [], milestones: [] };
}

function todayIndex(state: SignInState, now: number): number {
  return Math.max(1, Math.min(CALENDAR_DAYS, daysBetween(state.calendarStart, dayKey(now)) + 1));
}

function doubles(config: GameConfig, state: AccountState, vipDouble: number | null): boolean {
  return vipDouble !== null && vipPerks(config, state).level >= vipDouble;
}

export function buildSignInView(config: GameConfig, state: AccountState, now: number): SignInView {
  const sign = rollSignIn(state.signIn, now);
  const today = todayIndex(sign, now);
  const vipLevel = vipPerks(config, state).level;
  const days = config.signIn.days.map((d): SignDayView => {
    const signed = sign.signed.includes(d.day);
    const doubled = sign.doubled.includes(d.day);
    const status: SignDayStatus = signed ? 'signed' : d.day === today ? 'today' : d.day < today ? 'missed' : 'future';
    return {
      day: d.day,
      rewards: d.rewards,
      vipDouble: d.vipDouble,
      status,
      doubled,
      canDouble: signed && !doubled && doubles(config, state, d.vipDouble),
      canPatch: status === 'missed' && today - d.day <= config.signIn.patchDays,
    };
  });
  const signedCount = sign.signed.length;
  return {
    today,
    signedCount,
    patchGems: config.signIn.patchGems,
    vipLevel,
    days,
    milestones: config.signIn.milestones.map((m, index) => ({
      index,
      days: m.days,
      rewards: m.rewards,
      claimed: sign.milestones.includes(m.days),
      ready: signedCount >= m.days && !sign.milestones.includes(m.days),
    })),
  };
}

export interface SignInResult {
  state: AccountState;
  granted: Rewards;
}

function times(rewards: Rewards, n: number): Rewards {
  const out: Rewards = {};
  for (const [k, v] of Object.entries(rewards)) (out as Record<string, number>)[k] = (v as number) * n;
  return out;
}

function signDay(config: GameConfig, state: AccountState, sign: SignInState, day: number, extra: AccountState['currencies'] | null): SignInResult {
  const def = config.signIn.days.find((d) => d.day === day)!;
  const double = doubles(config, state, def.vipDouble);
  const granted = times(def.rewards, double ? 2 : 1);
  const signed: SignInState = {
    ...sign,
    signed: [...sign.signed, day],
    doubled: double ? [...sign.doubled, day] : sign.doubled,
  };
  const paid = extra ? { ...state, currencies: extra } : state;
  return { state: applyGrant(config, { ...paid, signIn: signed }, granted), granted };
}

/** Sign today's day. */
export function signTodayAction(config: GameConfig, state: AccountState, now: number): Result<SignInResult> {
  const sign = rollSignIn(state.signIn, now);
  const today = todayIndex(sign, now);
  if (sign.signed.includes(today)) return fail('not_ready', 'already signed in today');
  return ok(signDay(config, state, sign, today, null));
}

/** Sign a missed day of this calendar for Diamonds (source SIGN_PATCH). */
export function patchSignInAction(config: GameConfig, state: AccountState, day: number, now: number): Result<SignInResult> {
  const sign = rollSignIn(state.signIn, now);
  const today = todayIndex(sign, now);
  if (!Number.isInteger(day) || day < 1 || day >= today) return fail('invalid_input', `day ${day} is not a missed day`);
  if (sign.signed.includes(day)) return fail('not_ready', `day ${day} is already signed`);
  if (today - day > config.signIn.patchDays) return fail('resource_locked', `day ${day} is too long ago`);
  if (state.currencies.gems < config.signIn.patchGems) return fail('insufficient_items', 'not enough Diamonds');
  const currencies = { ...state.currencies, gems: state.currencies.gems - config.signIn.patchGems };
  return ok(signDay(config, state, sign, day, currencies));
}

/** Take a signed day's double once the VIP level reaches its ribbon (source SIGN_REGET). */
export function doubleSignInAction(config: GameConfig, state: AccountState, day: number, now: number): Result<SignInResult> {
  const sign = rollSignIn(state.signIn, now);
  const def = config.signIn.days.find((d) => d.day === day);
  if (!def) return fail('invalid_input', `no sign-in day ${day}`);
  if (!sign.signed.includes(day)) return fail('not_ready', `day ${day} is not signed`);
  if (sign.doubled.includes(day)) return fail('not_ready', `day ${day} is already doubled`);
  if (!doubles(config, state, def.vipDouble)) return fail('resource_locked', `day ${day} doubles at VIP ${def.vipDouble ?? '—'}`);
  const next = { ...state, signIn: { ...sign, doubled: [...sign.doubled, day] } };
  return ok({ state: applyGrant(config, next, def.rewards), granted: def.rewards });
}

/** Claim a signed-day bonus (source SIGN_AWARD). */
export function claimSignInMilestoneAction(config: GameConfig, state: AccountState, index: number, now: number): Result<SignInResult> {
  const sign = rollSignIn(state.signIn, now);
  const m = config.signIn.milestones[index];
  if (!m) return fail('invalid_input', `no sign-in bonus ${index}`);
  if (sign.milestones.includes(m.days)) return fail('not_ready', 'already claimed');
  if (sign.signed.length < m.days) return fail('not_ready', `sign in ${m.days} days first`);
  const next = { ...state, signIn: { ...sign, milestones: [...sign.milestones, m.days] } };
  return ok({ state: applyGrant(config, next, m.rewards), granted: m.rewards });
}
