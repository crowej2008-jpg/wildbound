import { isGymCleared, weekKey, type AccountState, type Rewards, type StageEnemy, type StatLine } from '@wildbound/engine';
import { modeBattle, type BattleView } from './battle';
import type { GameConfig } from './config';
import { counter, weeklyCounter, type CounterKey } from './counters';
import { applyGrant } from './economy';
import { fail, ok, type Result } from './index';
import { resonanceLevel } from './resonance';
import { grantTitleCards } from './titles';

/**
 * King's Trial (M14.2, from the source's champion_challenge tables): 36 Elite Four / Champion fights in 7 regions.
 * A trainer opens once its Victory Road gyms and earlier trainers are beaten; its progress is the account's
 * Champion Points against the trainer's threshold (reading: `score` is a running total, so progress = points /
 * score); at 100 it can be fought. Points come from the achievement tasks (logins, outfits, resonance, Arena wins
 * against stronger teams — Golden Egg and fusion-skin tasks wait for those systems) and the weekly tasks Wildbound
 * can track. Champions grant a battle privilege. Enemies are a stand-in. See docs/design/kings-trial.md.
 */

type Trainer = GameConfig['kingsTrial']['trainers'][number];

function trainerById(config: GameConfig, index: number): Trainer | undefined {
  return config.kingsTrial.trainers.find((t) => t.index === index);
}

/** The achievement events Wildbound can measure (others read 0 until their systems exist). */
function achievementValue(config: GameConfig, state: AccountState, event: string): number | null {
  switch (event) {
    case 'login_day_a':
      return state.counters.loginDays;
    case 'fashion_a':
      return config.fashion.pieces.filter((p) => p.slot === 'outfit' && (p.free || (state.fashion.stars[`${p.slot}:${p.index}`] ?? 0) > 0)).length;
    case 'share_lev':
      return resonanceLevel(config, state);
    case 'aren_win_power_higher_a':
      return counter(state, 'arenaWinsHigher');
    default:
      return null;
  }
}

const WEEKLY: Record<string, CounterKey> = {
  '{shop_type_buy,1}': 'goldShopBuys',
  '{item_cost,10057}': 'skyPillar',
  duan_pk_num: 'ranked',
  '{chest,2}': 'premiumDraws',
  world_boss: 'worldBoss',
  underground_new_battle: 'rift',
  champion_challenge_week_task: 'weeklyTasks',
};

export function trainerUnlocked(state: AccountState, t: Trainer): boolean {
  return t.gyms.every((g) => isGymCleared(state.campaign, `gym-${g}`)) && t.trainers.every((i) => state.kingsTrial.beaten.includes(i));
}

export function trainerProgress(state: AccountState, t: Trainer): number {
  return Math.min(100, Math.floor((state.kingsTrial.points * 100) / t.points));
}

function claim(state: AccountState, key: string, points = 0): AccountState {
  return { ...state, kingsTrial: { ...state.kingsTrial, claimed: [...state.kingsTrial.claimed, key], points: state.kingsTrial.points + points } };
}

function pay(config: GameConfig, state: AccountState, rewards: Rewards, titleCard?: string): AccountState {
  const granted = applyGrant(config, state, rewards);
  return titleCard ? grantTitleCards(granted, titleCard, 1) : granted;
}

/** Claim a finished achievement task's Champion Points. */
export function claimTrialAchievement(config: GameConfig, state: AccountState, index: number): Result<AccountState> {
  const task = config.kingsTrial.achTasks.find((t) => t.index === index);
  if (!task) return fail('not_found', 'no such task');
  const key = `ach:${index}`;
  if (state.kingsTrial.claimed.includes(key)) return fail('invalid_input', 'already claimed');
  const have = achievementValue(config, state, task.event);
  if (have === null || have < task.value) return fail('not_ready', 'the task is not done yet');
  return ok(claim(state, key, task.points));
}

/** Claim every finished achievement task at once. */
export function claimAllTrialAchievements(config: GameConfig, state: AccountState): Result<{ state: AccountState; points: number }> {
  let next = state;
  let points = 0;
  for (const t of config.kingsTrial.achTasks) {
    const out = claimTrialAchievement(config, next, t.index);
    if (out.ok) {
      next = out.value;
      points += t.points;
    }
  }
  if (points === 0) return fail('not_ready', 'no finished tasks to claim');
  return ok({ state: next, points });
}

/** Claim a Champion Point milestone reward (by achievement points claimed). */
export function claimTrialMilestone(config: GameConfig, state: AccountState, index: number): Result<{ state: AccountState; rewards: Rewards }> {
  const row = config.kingsTrial.achRewards.find((r) => r.index === index);
  if (!row) return fail('not_found', 'no such reward');
  const key = `ms:${index}`;
  if (state.kingsTrial.claimed.includes(key)) return fail('invalid_input', 'already claimed');
  if (state.kingsTrial.points < row.points) return fail('not_ready', `reach ${row.points} Champion Points first`);
  return ok({ state: pay(config, claim(state, key), row.rewards, row.titleCard), rewards: row.rewards });
}

/** Claim this week's finished weekly task (its Champion Points and rewards). */
export function claimTrialWeekly(config: GameConfig, state: AccountState, now: number, id: number): Result<{ state: AccountState; rewards: Rewards }> {
  const w = config.kingsTrial.weekly.find((x) => x.id === id);
  if (!w) return fail('not_found', 'no such weekly task');
  const key = `wk:${weekKey(now)}:${id}`;
  if (state.kingsTrial.claimed.includes(key)) return fail('invalid_input', 'already claimed this week');
  const c = WEEKLY[w.event];
  if (!c || weeklyCounter(state, now, c) < w.value) return fail('not_ready', 'the weekly task is not done yet');
  let next = pay(config, claim(state, key, w.points), w.rewards, w.titleCard);
  if (w.event !== 'champion_challenge_week_task') {
    const cs = next.counters;
    next = { ...next, counters: { ...cs, weekly: { ...cs.weekly, weeklyTasks: (cs.weekly.weeklyTasks ?? 0) + 1 }, total: { ...cs.total, weeklyTasks: (cs.total.weeklyTasks ?? 0) + 1 } } };
  }
  return ok({ state: next, rewards: w.rewards });
}

/** Claim a trainer's progress chest (30 / 60 / 100). */
export function claimTrialChest(config: GameConfig, state: AccountState, index: number, progress: number): Result<{ state: AccountState; rewards: Rewards }> {
  const t = trainerById(config, index);
  const chest = t?.chests.find((c) => c.progress === progress);
  if (!t || !chest) return fail('not_found', 'no such chest');
  const key = `chest:${index}:${progress}`;
  if (state.kingsTrial.claimed.includes(key)) return fail('invalid_input', 'already claimed');
  if (!trainerUnlocked(state, t) || trainerProgress(state, t) < progress) return fail('not_ready', `reach ${progress} progress first`);
  return ok({ state: pay(config, claim(state, key), chest.rewards, chest.titleCard), rewards: chest.rewards });
}

/** The stand-in lineup: the hardest condition gym's team, a few levels up (Champions further). */
export function trialEnemies(config: GameConfig, t: Trainer): StageEnemy[] {
  let gymIndex = Math.max(0, ...t.gyms);
  let walk: Trainer | undefined = t;
  while (gymIndex === 0 && walk && walk.trainers.length > 0) {
    walk = trainerById(config, walk.trainers[0]!);
    gymIndex = Math.max(0, ...(walk?.gyms ?? []));
  }
  const gym = config.gymById.get(`gym-${Math.max(1, gymIndex)}`)!;
  const step = 2 + (t.index - (walk?.index ?? t.index)) + (t.champion ? 3 : 0);
  return gym.enemies.map((e) => ({ ...e, level: e.level + step, stars: e.stars + (t.champion ? 1 : 0) }));
}

/** Fight a trainer at 100 progress. A first win pays its rewards (and a Champion's privilege). */
export function challengeTrial(
  config: GameConfig,
  state: AccountState,
  index: number,
  seed?: number,
): Result<{ state: AccountState; battle: BattleView; win: boolean; rewards: Rewards }> {
  const t = trainerById(config, index);
  if (!t) return fail('not_found', 'no such trainer');
  if (!trainerUnlocked(state, t)) return fail('resource_locked', 'beat the gyms and trainers before this one first');
  if (trainerProgress(state, t) < 100) return fail('not_ready', `needs ${t.points.toLocaleString()} Champion Points`);
  const battle = modeBattle(config, state, {
    squadMode: 'campaign',
    label: 'gymGate',
    enemies: trialEnemies(config, t),
    battleId: `m14:kings:${t.index}`,
    ...(seed !== undefined ? { seed } : {}),
  });
  if (!battle) return fail('not_found', 'no Pokémon available');
  const win = battle.winner === 'attackers';
  const first = win && !state.kingsTrial.beaten.includes(t.index);
  if (!first) return ok({ state, battle, win, rewards: {} });
  const next = { ...state, kingsTrial: { ...state.kingsTrial, beaten: [...state.kingsTrial.beaten, t.index] } };
  return ok({ state: pay(config, next, t.firstClear.rewards, t.firstClear.titleCard), battle, win, rewards: t.firstClear.rewards });
}

/** Champions' battle privileges for one Pokémon (they stack). */
export function trialStatLines(config: GameConfig, state: AccountState, className: string, faction: string): StatLine[] {
  const lines: StatLine[] = [];
  for (const i of state.kingsTrial?.beaten ?? []) {
    const p = trainerById(config, i)?.perk;
    if (p && ((p.className && p.className === className) || (p.faction && p.faction === faction))) lines.push({ kind: 'percent', field: p.field, base: p.value, perLevel: 0 });
  }
  return lines;
}

export interface KingsTrialView {
  points: number;
  areas: {
    id: number;
    name: string;
    trainers: {
      index: number;
      name: string;
      champion: boolean;
      points: number;
      unlocked: boolean;
      progress: number;
      beaten: boolean;
      perkText: string;
      firstClear: Rewards;
      chests: { progress: number; rewards: Rewards; ready: boolean; claimed: boolean }[];
    }[];
  }[];
  achievements: { event: string; desc: string; tracked: boolean; have: number; ready: number; claimed: number; total: number; next: { value: number; points: number } | null }[];
  readyPoints: number;
  milestones: { index: number; points: number; rewards: Rewards; claimed: boolean }[];
  weekly: { id: number; desc: string; value: number; have: number; tracked: boolean; points: number; rewards: Rewards; claimed: boolean }[];
}

const EVENT_NAME: Record<string, string> = {
  login_day_a: 'Total login days',
  fashion_a: 'Trainer outfits collected',
  share_lev: 'Resonance level',
  aren_win_power_higher_a: 'Arena wins against teams 1.2× stronger',
  egg_times_a: 'Golden Egg smashes (not in Wildbound yet)',
  hero_fusion_a: 'Fusion skins collected (not in Wildbound yet)',
};

export function buildKingsTrialView(config: GameConfig, state: AccountState, now: number): KingsTrialView {
  const k = config.kingsTrial;
  const claimed = new Set(state.kingsTrial.claimed);
  const events = [...new Set(k.achTasks.map((t) => t.event))];
  let readyPoints = 0;
  const achievements = events.map((event) => {
    const tasks = k.achTasks.filter((t) => t.event === event);
    const have = achievementValue(config, state, event);
    const ready = have === null ? [] : tasks.filter((t) => !claimed.has(`ach:${t.index}`) && have >= t.value);
    readyPoints += ready.reduce((s, t) => s + t.points, 0);
    const next = tasks.find((t) => !claimed.has(`ach:${t.index}`) && (have === null || have < t.value));
    return {
      event,
      desc: EVENT_NAME[event] ?? event,
      tracked: have !== null,
      have: have ?? 0,
      ready: ready.length,
      claimed: tasks.filter((t) => claimed.has(`ach:${t.index}`)).length,
      total: tasks.length,
      next: next ? { value: next.value, points: next.points } : null,
    };
  });
  return {
    points: state.kingsTrial.points,
    areas: k.areas.map((a) => ({
      id: a.id,
      name: a.name,
      trainers: k.trainers
        .filter((t) => t.area === a.id)
        .map((t) => {
          const unlocked = trainerUnlocked(state, t);
          const progress = unlocked ? trainerProgress(state, t) : 0;
          return {
            index: t.index,
            name: t.name,
            champion: t.champion,
            points: t.points,
            unlocked,
            progress,
            beaten: state.kingsTrial.beaten.includes(t.index),
            perkText: t.perkText,
            firstClear: t.firstClear.rewards,
            chests: t.chests.map((c) => ({ progress: c.progress, rewards: c.rewards, ready: unlocked && progress >= c.progress, claimed: claimed.has(`chest:${t.index}:${c.progress}`) })),
          };
        }),
    })),
    achievements,
    readyPoints,
    milestones: k.achRewards.map((r) => ({ index: r.index, points: r.points, rewards: r.rewards, claimed: claimed.has(`ms:${r.index}`) })),
    weekly: k.weekly.map((w) => {
      const c = WEEKLY[w.event];
      return {
        id: w.id,
        desc: w.desc,
        value: w.value,
        have: c ? weeklyCounter(state, now, c) : 0,
        tracked: Boolean(c),
        points: w.points,
        rewards: w.rewards,
        claimed: claimed.has(`wk:${weekKey(now)}:${w.id}`),
      };
    }),
  };
}
