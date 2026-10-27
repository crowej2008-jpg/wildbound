import {
  ACCOUNT,
  CAMPAIGN,
  CHAPTERS,
  COLLECTION_TUNING,
  ECONOMY,
  GROWTH,
  GYMS,
  POWER,
  QUESTS,
  STAGES,
  WILDS,
  GACHA,
  SHOPS,
  PVE,
  PVP,
  TITLES,
} from '@wildbound/content';
import {
  CHARMS,
  CORE_SETS,
  EQUIPMENT_TUNING,
  PLATES,
  RELICS,
  RUNES,
  TRINKETS,
  RUNE_SETS,
  TALENT_BLOCKS,
  TALENT_TREES,
} from '@wildbound/content';
import type {
  CampaignJson,
  ChapterMetaJson,
  CollectionJson,
  EconomyJson,
  GymJson,
  PveJson,
  PvpJson,
  TitlesJson,
  TitleJson,
} from '@wildbound/content';
import {
  mulberry32,
  type CoreStats,
  type EquipmentTables,
  type Faction,
  type GachaMachineDef,
  type GrowthTables,
  type PowerWeights,
  type ProgressTables,
  type QuestDef,
  type Rng,
  type ShopDef,
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
  /** M13.0a: chapter index, gym gates and chapter chest tuning. */
  campaign: CampaignJson;
  chapters: ChapterMetaJson[];
  chapterByNumber: Map<number, ChapterMetaJson>;
  gyms: GymJson[];
  gymById: Map<string, GymJson>;
  quests: QuestDef[];
  gacha: { machines: GachaMachineDef[] };
  shops: ShopDef[];
  economy: EconomyJson;
  /** M7 equipment catalogue + tuning. */
  equipment: EquipmentTables;
  /** M11 collection costs (Potential now; later layers add their own blocks). */
  collection: CollectionJson;
  /** M8 PvE mode tables (tower, trials, world boss, dungeons, link crystal). */
  pve: PveJson;
  pvp: PvpJson;
  /** M11.11 title catalogue. */
  titles: TitlesJson;
  titleById: Map<string, TitleJson>;
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
    campaign: CAMPAIGN,
    chapters: CHAPTERS,
    chapterByNumber: new Map(CHAPTERS.map((chapter) => [chapter.number, chapter])),
    gyms: GYMS,
    gymById: new Map(GYMS.map((gym) => [gym.id, gym])),
    quests: QUESTS,
    gacha: { machines: GACHA.machines as unknown as GachaMachineDef[] },
    shops: SHOPS as unknown as ShopDef[],
    economy: ECONOMY,
    collection: COLLECTION_TUNING,
    equipment: {
      relics: RELICS,
      plates: PLATES,
      trinkets: TRINKETS,
      runes: RUNES,
      runeSets: RUNE_SETS,
      charms: CHARMS,
      coreSets: CORE_SETS,
      talentBlocks: TALENT_BLOCKS,
      talentTrees: TALENT_TREES,
      tuning: EQUIPMENT_TUNING,
    },
    pve: PVE,
    pvp: PVP,
    titles: TITLES,
    titleById: new Map(TITLES.map((title) => [title.id, title])),
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
