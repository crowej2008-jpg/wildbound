import { fusionPerk } from './account3';
import {
  dayKey,
  isGymAvailable,
  isGymCleared,
  orderStages,
  type AccountState,
  type Rewards,
  type StatLine,
} from '@wildbound/engine';
import type { GameConfig } from './config';
import { applyGrant } from './economy';
import { fail, ok, type Result } from './index';
import { grantTitleCards } from './titles';

/**
 * Victory Road (M14.1, from the source's champion_road tables): the 60 gyms of the story gates, each with a badge.
 * A gym's progress is 30 once reached, 60 once its task is done, 100 once beaten (reading: the live task lists are
 * not in the dumps; each gym's task comes from the retired dun_champion_task table). Each progress step pays a
 * chest; each task pays once. Badges carry the source privileges: AFK profit (the best one counts), class / faction
 * battle stats (they stack), mode coin bonuses (the best of each), and the top badge's daily Diamonds.
 * See docs/design/victory-road.md.
 */

type Gym = GameConfig['victoryRoad']['gyms'][number];
type Task = NonNullable<Gym['task']>;

const gymId = (index: number) => `gym-${index}`;

export function badgesOwned(config: GameConfig, state: AccountState): Gym[] {
  return config.victoryRoad.gyms.filter((g) => isGymCleared(state.campaign, gymId(g.index)));
}

/** Is a gym's task met? Tasks on systems Wildbound does not track count as met (listed in the design doc). */
export function taskDone(config: GameConfig, state: AccountState, task: Task): boolean {
  const roster = state.roster;
  const n = task.count ?? 1;
  switch (task.kind) {
    case 'trainerLevel':
      return state.profile.level >= (task.value ?? 0);
    case 'story':
      return (state.campaign.stars[task.stage ?? ''] ?? 0) > 0;
    case 'tower':
      return state.pve.tower.floor >= (task.floor ?? 0);
    case 'gym':
      return isGymCleared(state.campaign, gymId(task.gym ?? 0));
    case 'pokemonLevel':
      return roster.filter((w) => w.level >= (task.level ?? 0)).length >= n;
    case 'pokemonStars':
      return roster.filter((w) => w.stars >= (task.stars ?? 0)).length >= n;
    case 'plates':
      return Object.values(state.plates ?? {}).filter((s) => s >= (task.plateStage ?? 0)).length >= n;
    case 'trinkets':
      return Object.values(state.trinkets ?? {}).filter((l) => l >= (task.level ?? 0)).length >= n;
    case 'berries':
      return state.equipment.berries.filter((b) => b.star >= (task.star ?? 0)).length >= n;
    case 'orbs':
      return state.equipment.orbs.filter((o) => o.level >= (task.level ?? 0)).length >= n;
    case 'factionTower': {
      const f = state.factionTower.floors;
      return Math.max(f.water, f.fire, f.grass) >= (task.value ?? 0);
    }
    case 'misty':
      return (state.misty?.chaptersCleared.length ?? 0) > 0;
    default:
      return true;
  }
}

export type GymStatus = 'locked' | 'reached' | 'beaten';

/** 30 once reached, 60 once the task is done, 100 once beaten. */
export function gymProgress(config: GameConfig, state: AccountState, gym: Gym): { status: GymStatus; progress: number; task: boolean } {
  const id = gymId(gym.index);
  if (isGymCleared(state.campaign, id)) return { status: 'beaten', progress: 100, task: true };
  const ordered = orderStages(config.stages);
  if (!isGymAvailable(state.campaign, ordered, id)) return { status: 'locked', progress: 0, task: false };
  const task = gym.task ? taskDone(config, state, gym.task) : true;
  return { status: 'reached', progress: task ? 60 : 30, task };
}

/** The best value of a mode perk across the badges owned (0 when none). */
export function badgePerk(config: GameConfig, state: AccountState, kind: string): number {
  let best = 0;
  for (const g of badgesOwned(config, state)) if (g.perk?.kind === kind) best = Math.max(best, g.perk.value);
  return best;
}

/** The class / faction battle-stat badges that apply to one Pokémon (they stack). */
export function badgeStatLines(config: GameConfig, state: AccountState, className: string, faction: string): StatLine[] {
  const lines: StatLine[] = [];
  for (const g of badgesOwned(config, state)) {
    const p = g.perk;
    if (!p || p.kind !== 'stat' || !p.field) continue;
    if ((p.className && p.className === className) || (p.faction && p.faction === faction)) {
      lines.push({ kind: 'percent', field: p.field, base: p.value, perLevel: 0 });
    }
  }
  return lines;
}

/** Scale one currency of a reward by a badge perk. */
/** Fusion-skin perks (M15) that boost the same rewards as a badge perk kind (keyword in the skin's perk text). */
const SKIN_PERK: Record<string, string> = { factionCoins: 'faction tower', mistyCoins: 'Misty Forest', skyPillarChallenge: 'Sky Pillar', skyPillarSweep: 'Sky Pillar' };

export function withBadgeBonus(config: GameConfig, state: AccountState, rewards: Rewards, kind: string, currency: keyof Rewards): Rewards {
  const skin = SKIN_PERK[kind] ? fusionPerk(config, state, SKIN_PERK[kind]!) / 100 : 0;
  const k = badgePerk(config, state, kind) + skin;
  const v = rewards[currency];
  if (!k || !v) return rewards;
  return { ...rewards, [currency]: Math.round(v * (1 + k)) };
}

function pay(config: GameConfig, state: AccountState, rewards: Rewards, titleCard?: string): AccountState {
  const granted = applyGrant(config, state, rewards);
  return titleCard ? grantTitleCards(granted, titleCard, 1) : granted;
}

/** Claim a gym's progress chest (30 / 60 / 100) once its progress is reached. */
export function claimVictoryChest(config: GameConfig, state: AccountState, gymIndex: number, progress: number): Result<{ state: AccountState; rewards: Rewards }> {
  const gym = config.victoryRoad.gyms.find((g) => g.index === gymIndex);
  const chest = gym?.chests.find((c) => c.progress === progress);
  if (!gym || !chest) return fail('not_found', 'no such chest');
  const key = `chest:${gymIndex}:${progress}`;
  if (state.victoryRoad.claimed.includes(key)) return fail('invalid_input', 'chest already opened');
  if (gymProgress(config, state, gym).progress < progress) return fail('not_ready', `reach ${progress} progress first`);
  const next = { ...state, victoryRoad: { ...state.victoryRoad, claimed: [...state.victoryRoad.claimed, key] } };
  return ok({ state: pay(config, next, chest.rewards, chest.titleCard), rewards: chest.rewards });
}

/** Claim a gym task's reward once the task is met (the gym must be reached). */
export function claimVictoryTask(config: GameConfig, state: AccountState, gymIndex: number): Result<{ state: AccountState; rewards: Rewards }> {
  const gym = config.victoryRoad.gyms.find((g) => g.index === gymIndex);
  if (!gym?.task) return fail('not_found', 'no such task');
  const key = `task:${gymIndex}`;
  if (state.victoryRoad.claimed.includes(key)) return fail('invalid_input', 'task reward already claimed');
  const p = gymProgress(config, state, gym);
  if (p.status === 'locked' || !p.task) return fail('not_ready', 'the task is not done yet');
  const next = { ...state, victoryRoad: { ...state.victoryRoad, claimed: [...state.victoryRoad.claimed, key] } };
  return ok({ state: pay(config, next, gym.task.rewards, gym.task.titleCard), rewards: gym.task.rewards });
}

/** The top badge's daily Diamonds (once a UTC day). */
export function claimBadgeDaily(config: GameConfig, state: AccountState, now: number): Result<{ state: AccountState; rewards: Rewards }> {
  const owned = badgesOwned(config, state);
  if (owned.length === 0) return fail('not_ready', 'earn a badge first');
  const day = dayKey(now);
  if (state.victoryRoad.dailyDay === day) return fail('invalid_input', "today's badge reward is claimed");
  const top = owned[owned.length - 1]!;
  const rewards: Rewards = { gems: top.dailyGems };
  return ok({ state: applyGrant(config, { ...state, victoryRoad: { ...state.victoryRoad, dailyDay: day } }, rewards), rewards });
}

export interface VictoryGymView {
  index: number;
  name: string;
  chapter: number;
  badge: string;
  perkText: string;
  status: GymStatus;
  progress: number;
  task: { desc: string; done: boolean; claimed: boolean; tracked: boolean; rewards: Rewards } | null;
  chests: { progress: number; rewards: Rewards; titleCard?: string; claimed: boolean; ready: boolean }[];
}

export interface VictoryRoadView {
  areas: { id: number; name: string; gyms: VictoryGymView[] }[];
  badges: number;
  dailyGems: number;
  dailyClaimed: boolean;
  afk: number;
}

export function buildVictoryRoadView(config: GameConfig, state: AccountState, now: number): VictoryRoadView {
  const claimed = new Set(state.victoryRoad.claimed);
  const owned = badgesOwned(config, state);
  const gymName = (i: number) => config.gymById.get(gymId(i));
  const views = config.victoryRoad.gyms.map((g): VictoryGymView => {
    const p = gymProgress(config, state, g);
    const def = gymName(g.index);
    return {
      index: g.index,
      name: def?.name ?? `Gym ${g.index}`,
      chapter: def?.chapter ?? 0,
      badge: g.badge,
      perkText: g.text,
      status: p.status,
      progress: p.progress,
      task: g.task
        ? { desc: g.task.desc, done: p.status !== 'locked' && p.task, claimed: claimed.has(`task:${g.index}`), tracked: g.task.kind !== 'untracked', rewards: g.task.rewards }
        : null,
      chests: g.chests.map((c) => ({
        progress: c.progress,
        rewards: c.rewards,
        ...(c.titleCard ? { titleCard: config.titles.find((t) => t.id === c.titleCard)?.name ?? c.titleCard } : {}),
        claimed: claimed.has(`chest:${g.index}:${c.progress}`),
        ready: p.progress >= c.progress,
      })),
    };
  });
  return {
    areas: config.victoryRoad.areas.map((a) => ({ id: a.id, name: a.name, gyms: views.filter((v, i) => config.victoryRoad.gyms[i]!.area === a.id) })),
    badges: owned.length,
    dailyGems: owned.at(-1)?.dailyGems ?? 0,
    dailyClaimed: state.victoryRoad.dailyDay === dayKey(now),
    afk: badgePerk(config, state, 'afk'),
  };
}
