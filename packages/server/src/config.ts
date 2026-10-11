import { ACCOUNT, GROWTH, POWER, WILDS } from '@wildbound/content';
import {
  mulberry32,
  type CoreStats,
  type Faction,
  type GrowthTables,
  type PowerWeights,
  type ProgressTables,
  type Rng,
  type Tier,
  type WildClass,
} from '@wildbound/engine';

/** Everything the LocalServer needs, lifted from content and injectable in tests. */
export interface SpeciesMeta {
  id: string;
  faction: Faction;
  className: WildClass;
  tier: Tier;
  base: CoreStats;
  stages: string[];
}

export interface GameConfig {
  playerName: string;
  startingCurrencies: Record<string, number>;
  startingRoster: string[];
  debugGrant: Record<string, number>;
  progress: ProgressTables;
  growth: GrowthTables;
  power: PowerWeights;
  species: Map<string, SpeciesMeta>;
  now: () => number;
  rng: Rng;
}

/** Build the runtime config from the validated content exports. */
export function buildConfig(): GameConfig {
  const species = new Map<string, SpeciesMeta>();
  for (const wild of WILDS) {
    species.set(wild.id, {
      id: wild.id,
      faction: wild.faction,
      className: wild.class,
      tier: wild.tier,
      base: wild.base,
      stages: wild.stages,
    });
  }
  return {
    playerName: ACCOUNT.playerName,
    startingCurrencies: ACCOUNT.startingCurrencies,
    startingRoster: ACCOUNT.startingRoster,
    debugGrant: ACCOUNT.debugGrantCurrency,
    progress: {
      levelUp: GROWTH.levelUp,
      starUp: GROWTH.starUp,
      evolve: GROWTH.evolve,
      respawn: GROWTH.respawn,
      maxLevelByStage: GROWTH.maxLevelByStage,
      maxStars: GROWTH.maxStars,
    },
    growth: {
      maxLevelByStage: GROWTH.maxLevelByStage,
      maxStars: GROWTH.maxStars,
      levelGrowth: GROWTH.levelGrowth,
      starStep: GROWTH.starStep,
      evolutionMult: GROWTH.evolutionMult,
      qualityMult: GROWTH.qualityMult,
    },
    power: POWER,
    species,
    now: () => Date.now(),
    rng: mulberry32(0x5eed),
  };
}
