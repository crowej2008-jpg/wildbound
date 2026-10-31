/**
 * Content registry for Wildbound.
 *
 * The content package is environment-neutral: it never reads the filesystem
 * (so the client can import it at build time and the CLI can validate the same
 * tables at runtime). Data lives in the sibling `data/` directories listed
 * below; the CLI validator walks them with `packages/content` as its root.
 */
export const CONTENT_DIRS = {
  species: 'species',
  kits: 'kits',
  items: 'items',
  stages: 'stages',
  shops: 'shops',
  quests: 'quests',
  equipment: 'equipment',
  titles: 'titles',
  tuning: 'tuning',
} as const;

export type ContentDir = (typeof CONTENT_DIRS)[keyof typeof CONTENT_DIRS];

export * from './schemas';
export type {
  KitJson,
  CombatSettingsJson,
  SpeciesJson,
  GrowthJson,
  PowerJson,
  CoreStatsJson,
  AccountJson,
  StageJson,
  QuestJson,
  EconomyJson,
  RewardJson,
} from './schemas';
export { gachaSchema } from './gacha-schema';
export type { GachaJson } from './gacha-schema';
export { shopSchema } from './shop-schema';
export type { ShopJson } from './shop-schema';

export { WILDS, FACTIONS, wildById, wildsByFaction } from './species';
export { CHAPTERS, GYMS, chapterByNumber, gymById, gymByChapter } from './campaign';
export { TITLES, titleById } from './titles';
export {
  titlesSchema,
  titleSchema,
  titleStageSchema,
  titleRequirementSchema,
  TITLE_SLOTS,
  TITLE_SOURCES,
  type TitlesJson,
  type TitleJson,
  type TitleStageJson,
  type TitleSlotJson,
  type TitleSourceJson,
} from './titles-schema';
export { PVE } from './pve';
export { pveSchema, type PveJson, type EnemyPoolJson, type TrialDefJson, type DungeonDefJson } from './pve-schema';
export { PVP } from './pvp';
export {
  pvpSchema,
  arenaSchema,
  arenaBandSchema,
  rankedSchema,
  rankedPhaseSchema,
  rankedTierSchema,
  type PvpJson,
  type ArenaJson,
  type ArenaBandJson,
  type RankedJson,
  type RankedPhaseJson,
  type RankedTierJson,
} from './pvp-schema';
export { KITS, kitById } from './kits';
export { kitToEngine } from './kit-to-engine';
export { STAGES, stageById, orderedStages, chapterNumbers, stagesInChapter } from './stages';
export { QUESTS, questById } from './quests';
export {
  COMBAT_SETTINGS,
  GROWTH,
  POWER,
  ACCOUNT,
  ECONOMY,
  CAMPAIGN,
  EXPLORE,
  PET_HOME,
  SKY_PILLAR,
  GACHA_TUNING,
  COLLECTION_TUNING,
} from './tuning';
export type {
  CollectionJson,
  CampaignJson,
  ExploreJson,
  ExploreModeJson,
  ExploreGateJson,
  PetHomeJson,
  SkyPillarJson,
} from './tuning';
export { collectionTuningSchema } from './collection-schema';
export { petHomeSchema } from './pet-home-schema';
export { skyPillarSchema } from './sky-pillar-schema';
export type {
  SkyPillarConditionJson,
  SkyPillarStageJson,
  SkyPillarChestJson,
  SkyPillarFloorJson,
} from './sky-pillar-schema';
export type {
  PetHomeLevelJson,
  PetHomeTileJson,
  PetHomeIncomeJson,
  PetHomeShopOfferJson,
  PetHomeShopBandJson,
  PetHomeShopJson,
} from './pet-home-schema';
export { GACHA } from './tuning-gacha';
export { SHOPS } from './shops';
export {
  EQUIPMENT_TUNING,
  RELICS,
  PLATES,
  TRINKETS,
  RUNES,
  RUNE_SETS,
  CHARMS,
  CORE_SETS,
  TALENT_BLOCKS,
  TALENT_TREES,
  relicById,
  plateByFaction,
  trinketBySpecies,
  charmById,
  coreSetById,
  talentTreeById,
} from './equipment';
export {
  equipmentTuningSchema,
  relicsSchema,
  platesSchema,
  trinketsSchema,
  runesSchema,
  charmsSchema,
  coresSchema,
  talentsSchema,
  type RelicJson,
  type PlateJson,
  type TrinketJson,
  type RuneJson,
  type CharmJson,
  type CoreSetJson,
  type TalentBlockJson,
  type TalentTreeJson,
} from './equipment-schema';

/** Bumped when the shape of any content directory changes. */
export const CONTENT_SCHEMA_VERSION = 2;

export const contentManifest = {
  game: 'wildbound',
  schemaVersion: CONTENT_SCHEMA_VERSION,
  dataDirs: Object.values(CONTENT_DIRS),
} as const;