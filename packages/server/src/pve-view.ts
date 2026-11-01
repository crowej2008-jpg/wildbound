import {
  dayKey,
  msUntilNextUtcMidnight,
  weekdayUtc,
  type AccountState,
  type Rewards,
} from '@wildbound/engine';
import { curveLevel } from '@wildbound/engine';
import type { GameConfig } from './config';
import {
  hardTowerRule,
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
  type TowerKind,
  type TrialRule,
} from '@wildbound/engine';
import type { TowerRuleJson } from '@wildbound/content';

/**
 * Display-ready PvE views (M8). Pure reads of `AccountState` + `GameConfig`; the
 * client renders them without contacting the engine. See docs/design/pve-modes.md.
 */

export interface TowerMilestoneView {
  floor: number;
  reached: boolean;
  rewards: Rewards;
  /** Species shards and title cards, as text. */
  extras: string[];
}

export interface TowerSideView {
  floor: number;
  top: number;
  nextFloor: number;
  nextEnemyLevel: number;
  climbsLeft: number;
  /** The next achievements (up to five) on this tower. */
  milestones: TowerMilestoneView[];
}

export interface TowerView extends TowerSideView {
  sweepsLeft: number;
  hard: TowerSideView & { rule: string | null };
  dayResetMs: number;
}

function ruleText(rule: TowerRuleJson | undefined): string | null {
  if (!rule) return null;
  if (rule.kind === 'noPositions') return `No Pokémon in position ${rule.positions.join(' and ')}`;
  if (rule.kind === 'maxFaction') return `At most ${rule.max} ${rule.faction[0]!.toUpperCase()}${rule.faction.slice(1)} Pokémon`;
  if (rule.kind === 'maxClass') return `At most ${rule.max} ${rule.className} Pokémon`;
  return `At most ${rule.max} ${rule.tier[0]!.toUpperCase()}${rule.tier.slice(1)} Pokémon`;
}

function side(config: GameConfig, state: AccountState, kind: TowerKind, now: number): TowerSideView {
  const tuning = towerTuning(config);
  const rolled = rollTower(state.pve.tower, dayKey(now));
  const floor = kind === 'hard' ? rolled.hardFloor : rolled.floor;
  const nextFloor = nextTowerFloor(rolled, kind);
  const curve = resolveCurve(config, config.pve.tower.enemy);
  const rows = kind === 'hard' ? config.tower.hard : config.tower.normal;
  return {
    floor,
    top: kind === 'hard' ? tuning.hardFloors : tuning.normalFloors,
    nextFloor,
    nextEnemyLevel: curveLevel(curve, kind === 'hard' ? nextFloor * 2 - 1 : nextFloor - 1),
    climbsLeft: Math.max(0, tuning.climbsPerDay - (kind === 'hard' ? rolled.hardClimbsToday : rolled.climbsToday)),
    milestones: rows
      .filter((r) => r.floor > floor)
      .slice(0, 5)
      .map((r) => ({
        floor: r.floor,
        reached: false,
        rewards: r.rewards,
        extras: [
          ...Object.entries(r.speciesShards ?? {}).map(([id, n]) => `${config.species.get(id)?.name ?? id} shards ×${n}`),
          ...(r.titleCard ? [`Title: ${config.titleById.get(r.titleCard)?.name ?? r.titleCard}`] : []),
        ],
      })),
  };
}

export function buildTowerView(config: GameConfig, state: AccountState, now: number): TowerView {
  const tuning = towerTuning(config);
  const rolled = rollTower(state.pve.tower, dayKey(now));
  const hard = side(config, state, 'hard', now);
  return {
    ...side(config, state, 'normal', now),
    sweepsLeft: canSweep(rolled, tuning) ? tuning.sweepsPerDay - rolled.sweepsToday : 0,
    hard: { ...hard, rule: ruleText(hardTowerRule(config, hard.nextFloor)) },
    dayResetMs: msUntilNextUtcMidnight(now),
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

