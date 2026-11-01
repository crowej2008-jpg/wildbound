import {
  generateEnemies,
  type AccountState,
  type EnemyPoolSpec,
  type ResolvedCurve,
  type Rewards,
  type StageEnemy,
  type TowerTuning,
  type TrialDef,
  type WorldBossDef,
} from '@wildbound/engine';
import type { BattleView } from '../battle';
import type { GameConfig } from '../config';

/**
 * Shared PvE helpers (M8, PROMPT §7.6): resolve content definitions, generate
 * enemy squads and describe crystal eligibility. See docs/design/pve-modes.md.
 */

/** Species ids a mode's pool may field, resolved from the species catalogue. */
export function resolvePool(config: GameConfig, spec: EnemyPoolSpec): string[] {
  const out: string[] = [];
  for (const [id, meta] of config.species) {
    if (spec.factions.length > 0 && !spec.factions.includes(meta.faction)) continue;
    if (spec.tiers.length > 0 && !spec.tiers.includes(meta.tier)) continue;
    out.push(id);
  }
  return out.sort();
}

export function resolveCurve(config: GameConfig, spec: EnemyPoolSpec): ResolvedCurve {
  return {
    pool: resolvePool(config, spec),
    count: spec.count,
    baseLevel: spec.baseLevel,
    levelSlope: spec.levelSlope,
    starsEvery: spec.starsEvery,
    maxStars: spec.maxStars,
    stageEvery: spec.stageEvery,
    maxStage: spec.maxStage,
  };
}

export function enemiesFor(config: GameConfig, spec: EnemyPoolSpec, index: number): StageEnemy[] {
  return generateEnemies(resolveCurve(config, spec), index);
}

export function towerTuning(config: GameConfig): TowerTuning {
  const t = config.pve.tower;
  return {
    climbsPerWeek: t.climbsPerWeek,
    sweepsPerDay: t.sweepsPerDay,
    milestoneEvery: t.milestoneEvery,
    milestoneCap: t.milestoneCap,
    reward: t.reward,
  };
}

export function trialDefs(config: GameConfig): TrialDef[] {
  return config.pve.trials as TrialDef[];
}


export function worldBossDefs(config: GameConfig): WorldBossDef[] {
  return config.pve.worldBoss.rotation as WorldBossDef[];
}

export interface BattleOutcome<T> {
  state: AccountState;
  battle: BattleView;
  win: boolean;
  rewards: Rewards;
  extra: T;
}

