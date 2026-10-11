import type { ProgressTables, WildInstance } from './types';

/**
 * Pure cost/eligibility math for growth actions (docs/design/account.md).
 * The engine computes; the server checks affordability and applies.
 */

export function maxLevelForStage(stage: number, tables: ProgressTables): number {
  const idx = Math.min(Math.max(0, stage), tables.maxLevelByStage.length - 1);
  return tables.maxLevelByStage[idx] ?? tables.maxLevelByStage[tables.maxLevelByStage.length - 1] ?? 1;
}

/** Candy needed to go from `level` to `level + 1`. */
export function candyCost(level: number, tables: ProgressTables): number {
  return Math.round(tables.levelUp.candyBase * Math.pow(level, tables.levelUp.candyExponent));
}

export interface Cost {
  candy: number;
  gold: number;
}

/** Total candy+gold to climb from `from` to `to` (exclusive of `to`). */
export function levelUpCost(from: number, to: number, tables: ProgressTables): Cost {
  let candy = 0;
  for (let level = from; level < to; level++) candy += candyCost(level, tables);
  return { candy, gold: candy * tables.levelUp.goldPerCandy };
}

/** Highest level this instance may reach right now (its evolution stage's cap). */
export function levelCapOf(instance: WildInstance, tables: ProgressTables): number {
  return maxLevelForStage(instance.evolutionStage, tables);
}

/** Cost to raise from `stars` to `stars + 1`. */
export function starUpCost(stars: number, tables: ProgressTables): { shards: number; gold: number } {
  return { shards: tables.starUp.shardsPerStar * stars, gold: tables.starUp.goldPerStar * stars };
}

export interface EvolveCheck {
  targetStage: number;
  step: import('./types').EvolveStep;
  candy: number;
  gold: number;
  stones: number;
  minLevel: number;
  minStars: number;
}

export interface EvolveBlocked {
  reason: 'max_stage';
}

/**
 * The requirement/cost to evolve `instance` one stage further, given how many
 * forms the species has (`stageCount`). Returns a block reason at the last form.
 */
export function evolveCheck(
  instance: WildInstance,
  stageCount: number,
  tables: ProgressTables,
): EvolveCheck | EvolveBlocked {
  const target = instance.evolutionStage + 1;
  if (target >= stageCount || target >= tables.evolve.length) return { reason: 'max_stage' };
  const step = tables.evolve[target] as import('./types').EvolveStep;
  return {
    targetStage: target,
    step,
    candy: step.candy,
    gold: step.gold,
    stones: step.stones,
    minLevel: step.minLevel,
    minStars: step.minStars,
  };
}

export function canEvolve(instance: WildInstance, stageCount: number, tables: ProgressTables): boolean {
  const check = evolveCheck(instance, stageCount, tables);
  if ('reason' in check) return false;
  return instance.level >= check.minLevel && instance.stars >= check.minStars;
}
