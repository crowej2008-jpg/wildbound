import {
  countQualifying,
  crystalCap,
  generateEnemies,
  levelCapOf,
  type AccountState,
  type CrystalWildInfo,
  type DungeonDef,
  type EnemyPoolSpec,
  type LinkCrystalTuning,
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

export function crystalTuning(config: GameConfig): LinkCrystalTuning {
  return config.pve.linkCrystal;
}

export function trialDefs(config: GameConfig): TrialDef[] {
  return config.pve.trials as TrialDef[];
}

export function dungeonDefs(config: GameConfig): DungeonDef[] {
  return config.pve.dungeons as DungeonDef[];
}

export function worldBossDefs(config: GameConfig): WorldBossDef[] {
  return config.pve.worldBoss.rotation as WorldBossDef[];
}

/** The crystal facts for every owned Wild (top stage is per-species). */
export function crystalWilds(config: GameConfig, state: AccountState): CrystalWildInfo[] {
  return state.roster.map((w) => {
    const meta = config.species.get(w.speciesId);
    const topStage = Math.max(0, (meta?.stages.length ?? 1) - 1);
    // Eligible only at the final evolution stage *and* already at its level cap,
    // so a crystal can extend a finished Wild rather than unlock at birth.
    const atTopStage = w.evolutionStage >= topStage && w.level >= levelCapOf(w, config.progress);
    return { stars: w.stars, atTopStage };
  });
}

export interface BattleOutcome<T> {
  state: AccountState;
  battle: BattleView;
  win: boolean;
  rewards: Rewards;
  extra: T;
}

export { crystalCap, countQualifying };
