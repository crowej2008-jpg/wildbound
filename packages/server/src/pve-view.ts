import {
  dayKey,
  msUntilNextUtcMidnight,
  nextWeekStart,
  weekdayUtc,
  weekKey,
  type AccountState,
  type Rewards,
} from '@wildbound/engine';
import { curveLevel } from '@wildbound/engine';
import type { GameConfig } from './config';
import {
  resolveCurve,
  towerTuning,
  trialDefs,
  worldBossDefs,
} from './pve';
import {
  canSweep,
  ghostRecords,
  openChests,
  rollDungeonDay,
  type DungeonGrade,
  nextTowerFloor,
  rankDamage,
  reachedMilestones,
  rollTower,
  trialAvailable,
  trialFaction,
  trialLevelCap,
  trialSurvivalRounds,
  type TrialRule,
} from '@wildbound/engine';

/**
 * Display-ready PvE views (M8). Pure reads of `AccountState` + `GameConfig`; the
 * client renders them without contacting the engine. See docs/design/pve-modes.md.
 */

export interface TowerMilestoneView {
  floor: number;
  reached: boolean;
  claimed: boolean;
}

export interface TowerView {
  floor: number;
  nextFloor: number;
  nextEnemyLevel: number;
  climbsLeft: number;
  sweepsLeft: number;
  milestones: TowerMilestoneView[];
  dayResetMs: number;
  weekResetMs: number;
}

export function buildTowerView(config: GameConfig, state: AccountState, now: number): TowerView {
  const tuning = towerTuning(config);
  const rolled = rollTower(state.pve.tower, dayKey(now), weekKey(now));
  const nextFloor = nextTowerFloor(rolled);
  const levels = [];
  for (let f = tuning.milestoneEvery; f <= tuning.milestoneCap; f += tuning.milestoneEvery) levels.push(f);
  const curve = resolveCurve(config, config.pve.tower.enemy);
  return {
    floor: rolled.floor,
    nextFloor,
    nextEnemyLevel: curveLevel(curve, nextFloor - 1),
    climbsLeft: Math.max(0, tuning.climbsPerWeek - rolled.climbsThisWeek),
    sweepsLeft: canSweep(rolled, tuning) ? tuning.sweepsPerDay - rolled.sweepsToday : 0,
    milestones: levels.map((floor) => ({
      floor,
      reached: rolled.floor >= floor,
      claimed: rolled.claimedMilestones.includes(floor),
    })),
    dayResetMs: msUntilNextUtcMidnight(now),
    weekResetMs: nextWeekStart(now) - now,
  };
}

export interface TrialCardView {
  id: string;
  name: string;
  tagline: string;
  rule: TrialRule;
  ruleDetail: string;
  open: boolean;
  locked: boolean;
  clearedToday: boolean;
  preview: Rewards;
}

function ruleDetail(trial: ReturnType<typeof trialDefs>[number]): string {
  const faction = trialFaction(trial);
  if (faction) return `Faction lock: ${faction}`;
  const cap = trialLevelCap(trial);
  if (cap !== null) return `Level cap: ${cap}`;
  const rounds = trialSurvivalRounds(trial);
  if (rounds !== null) return `Survive ${rounds} rounds`;
  if (trial.rule === 'noUltimate') return 'Ultimates disabled';
  if (trial.weekdays) return `Open weekdays ${trial.weekdays.join(', ')}`;
  return '';
}

export function buildTrialsView(config: GameConfig, state: AccountState, now: number): TrialCardView[] {
  const weekday = weekdayUtc(now);
  const day = dayKey(now);
  return trialDefs(config).map((trial) => {
    const open = trialAvailable(trial, state.profile.level, weekday);
    return {
      id: trial.id,
      name: trial.name,
      tagline: trial.tagline,
      rule: trial.rule,
      ruleDetail: ruleDetail(trial),
      open,
      locked: state.profile.level < trial.unlockLevel,
      clearedToday: state.pve.trials.lastCleared[trial.id] === day,
      preview: trial.preview as Rewards,
    };
  });
}

export interface WorldBossMilestoneView {
  index: number;
  damage: number;
  rewards: Rewards;
  reached: boolean;
  claimed: boolean;
}

export interface WorldBossView {
  open: boolean;
  name: string;
  speciesId: string;
  attemptsLeft: number;
  attemptsPerDay: number;
  lastDamage: number;
  bestDamage: number;
  rank: number;
  ghostCount: number;
  milestones: WorldBossMilestoneView[];
  dayResetMs: number;
}

export function buildWorldBossView(config: GameConfig, state: AccountState, now: number): WorldBossView {
  const weekday = weekdayUtc(now);
  const boss = worldBossDefs(config).find((d) => d.weekday === weekday);
  const tuning = config.pve.worldBoss;
  const bossState = state.pve.worldBoss;
  const ghosts = ghostRecords(bossState.history, 0x5eed, tuning.ghostCount);
  const reached = new Set(reachedMilestones(bossState.lastDamage, tuning.milestones));
  return {
    open: boss !== undefined,
    name: boss?.name ?? '',
    speciesId: boss?.speciesId ?? '',
    attemptsLeft: Math.max(0, tuning.attemptsPerDay - bossState.attempts),
    attemptsPerDay: tuning.attemptsPerDay,
    lastDamage: bossState.lastDamage,
    bestDamage: bossState.bestDamage,
    rank: rankDamage(bossState.bestDamage, ghosts),
    ghostCount: tuning.ghostCount,
    milestones: tuning.milestones.map((m, index) => ({
      index,
      damage: m.damage,
      rewards: m.rewards as Rewards,
      reached: reached.has(index),
      claimed: bossState.claimedMilestones.includes(index),
    })),
    dayResetMs: msUntilNextUtcMidnight(now),
  };
}

export interface DungeonDifficultyView {
  index: number;
  id: string;
  name: string;
  level: number;
  open: boolean;
  best: DungeonGrade | null;
  sweep: Rewards;
  grades: { grade: DungeonGrade; goal: string; pay: Rewards; chest: Rewards; chestReady: boolean; chestDrawn: boolean }[];
}

export interface DungeonCardView {
  id: string;
  name: string;
  desc: string;
  runsLeft: number;
  runs: number;
  difficulties: DungeonDifficultyView[];
}

function goalText(g: { kills?: number; damage?: number; rounds?: number }): string {
  const what = g.kills !== undefined ? `Defeat ${g.kills}` : `Deal ${(g.damage ?? 0).toLocaleString()} damage`;
  return g.rounds !== undefined ? `${what} within ${g.rounds} rounds` : what;
}

/** R9: the four source daily dungeons, their difficulties, grades and chests. */
export function buildDungeonsView(config: GameConfig, state: AccountState, now: number): DungeonCardView[] {
  const rolled = rollDungeonDay(state.pve.dungeons, dayKey(now));
  return config.dailyDungeons.dungeons.map((d) => ({
    id: d.id,
    name: d.name,
    desc: d.desc,
    runs: d.runs,
    runsLeft: Math.max(0, d.runs - (rolled.runs[d.id] ?? 0)),
    difficulties: d.difficulties.map((x, index) => {
      const ready = openChests(rolled, x.id);
      return {
        index,
        id: x.id,
        name: x.name,
        level: x.level,
        open: state.profile.level >= x.level,
        best: rolled.best[x.id] ?? null,
        sweep: x.sweep,
        grades: x.grades.map((g) => ({
          grade: g.grade,
          goal: goalText(g),
          pay: g.pay,
          chest: g.chest,
          chestReady: ready.includes(g.grade),
          chestDrawn: rolled.chests.includes(`${x.id}:${g.grade}`),
        })),
      };
    }),
  }));
}

