import {
  ACCOUNT,
  CAMPAIGN,
  CHAPTERS,
  COLLECTION_TUNING,
  RESONANCE,
  ECONOMY,
  EXPLORE,
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
  PET_HOME,
  SKY_PILLAR,
} from '@wildbound/content';
import {
  BERRIES,
  CORE_SETS,
  EQUIPMENT_TUNING,
  PLATES,
  RELICS,
  HELD_TABLES,
  ORBS,
  TRINKETS,
  TRINKET_RULES,
  POTENTIAL,
} from '@wildbound/content';
import type {
  CampaignJson,
  ChapterMetaJson,
  CollectionJson,
  EconomyJson,
  ExploreJson,
  GymJson,
  PetHomeJson,
  SkyPillarJson,
  PveJson,
  PvpJson,
  TitlesJson,
  TitleJson,
} from '@wildbound/content';
import {
  mulberry32,
  starCardFor,
  starRange,
  type EquipmentTables,
  type HeldTables,
  type RelicDef,
  type Faction,
  type GachaMachineDef,
  type PowerWeights,
  type ProgressTables,
  type QuestDef,
  type Rng,
  type ShopDef,
  type StageDef,
  type StarCard,
  type Tier,
  type WildClass,
  type XpCurve,
  type PotentialTable,
  type OrbTables,
  ResonanceTables,
} from '@wildbound/engine';

/** Everything the LocalServer needs, lifted from content and injectable in tests. */
export interface SpeciesMeta {
  id: string;
  name: string;
  faction: Faction;
  className: WildClass;
  tier: Tier;
  /** The source's hero id. */
  sourceId: number;
  /** Shards that make one copy. */
  shards: number;
  /** The star ladder (R1): consecutive cards from the species' first star to its last. */
  stars: StarCard[];
}

/** The species' card for `star` (clamped into its ladder). */
export function cardOf(meta: SpeciesMeta, star: number): StarCard {
  return starCardFor(meta.stars, star);
}

/** The species' first star — where a new copy starts. */
export function firstStar(meta: SpeciesMeta): number {
  return starRange(meta.stars).min;
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
  /** E4: Origin skill-level prices in the Origin's own shards (LV.2, LV.3). */
  originSkillCosts: number[];
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
  /** M13.0b: Explore hub modes and their gates. */
  explore: ExploreJson;
  /** M13.1: Pet Home merge-board levels, tiles, income and shops. */
  petHome: PetHomeJson;
  /** M13.2: Sky Pillar floors, stages, star conditions and proofs. */
  skyPillar: SkyPillarJson;
  quests: QuestDef[];
  gacha: { machines: GachaMachineDef[] };
  shops: ShopDef[];
  economy: EconomyJson;
  /** M7 equipment catalogue + tuning. */
  equipment: EquipmentTables;
  /** M11 collection costs. */
  collection: CollectionJson;
  /** R4: the source's Potential (trees, costs, options). */
  potential: PotentialTable;
  /** M8 PvE mode tables (tower, trials, world boss, dungeons, link crystal). */
  pve: PveJson;
  /** R7: the source's Resonance. */
  resonance: ResonanceTables;
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
      sourceId: wild.sourceId,
      shards: wild.shards,
      stars: wild.stars as StarCard[],
    });
  }
  return {
    playerName: ACCOUNT.playerName,
    startingCurrencies: ACCOUNT.startingCurrencies,
    startingRoster: ACCOUNT.startingRoster,
    debugGrant: ACCOUNT.debugGrantCurrency,
    originSkillCosts: GROWTH.originSkill.costs,
    progress: {
      levelUp: GROWTH.levelUp,
      respawn: GROWTH.respawn,
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
    explore: EXPLORE,
    petHome: PET_HOME,
    skyPillar: SKY_PILLAR,
    quests: QUESTS,
    gacha: { machines: GACHA.machines as unknown as GachaMachineDef[] },
    shops: SHOPS as unknown as ShopDef[],
    economy: ECONOMY,
    collection: COLLECTION_TUNING,
    potential: POTENTIAL as unknown as PotentialTable,
    equipment: {
      relics: RELICS as unknown as RelicDef[],
      held: HELD_TABLES as unknown as HeldTables,
      plates: PLATES as unknown as EquipmentTables['plates'],
      trinkets: TRINKETS as unknown as EquipmentTables['trinkets'],
      trinketRules: TRINKET_RULES as unknown as EquipmentTables['trinketRules'],
      orbs: ORBS as unknown as OrbTables,
      berries: BERRIES as unknown as EquipmentTables['berries'],
      coreSets: CORE_SETS,
      tuning: EQUIPMENT_TUNING as unknown as EquipmentTables['tuning'],
    },
    pve: PVE,
    resonance: RESONANCE as ResonanceTables,
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
