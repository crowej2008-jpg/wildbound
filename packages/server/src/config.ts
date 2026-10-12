import { ACCOUNT, ECONOMY, GROWTH, POWER, QUESTS, STAGES, WILDS } from '@wildbound/content';
import type { EconomyJson } from '@wildbound/content';
import {
  mulberry32,
  type CoreStats,
  type Faction,
  type GrowthTables,
  type PowerWeights,
  type ProgressTables,
  type QuestDef,
  type Rng,
  type StageDef,
  type Tier,
  type WildClass,
  type XpCurve,
} from '@wildbound/engine';

/** Everything the LocalServer needs, lifted from content and injectable in tests. */
export interface SpeciesMeta {
  id: string;
  name: string;
  faction: Faction;
  className: WildClass;
  tier: Tier;
  base: CoreStats;
  stages: string[];
}

export interface IdleConfig {
  capMinutes: number;
  quickCollectMinutes: number;
  quickCollectGems: number;
  quickCollectDailyLimit: number;
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
  stages: StageDef[];
  stageById: Map<string, StageDef>;
  quests: QuestDef[];
  economy: EconomyJson;
  xpCurve: XpCurve;
  idle: IdleConfig;
  now: () => number;
  rng: Rng;
}

/** Build the runtime config from the validated content exports. */
export function buildConfig(): GameConfig {
  const species = new Map<string, SpeciesMeta>();
  for (const wild of WILDS) {
    species.set(wild.id, {
      id: wild.id,
      name: wild.name,
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
    stages: STAGES,
    stageById: new Map(STAGES.map((stage) => [stage.id, stage])),
    quests: QUESTS,
    economy: ECONOMY,
    xpCurve: { base: ECONOMY.xp.base, exponent: ECONOMY.xp.exponent, maxLevel: ECONOMY.xp.maxLevel },
    idle: {
      capMinutes: Math.round(ECONOMY.idle.capHours * 60),
      quickCollectMinutes: Math.round(ECONOMY.idle.quickCollectHours * 60),
      quickCollectGems: ECONOMY.idle.quickCollectGems,
      quickCollectDailyLimit: ECONOMY.idle.quickCollectDailyLimit,
    },
    now: () => Date.now(),
    rng: mulberry32(0x5eed),
  };
}
