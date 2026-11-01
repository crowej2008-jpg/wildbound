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
  titleEarnedBySchema,
  TITLE_SLOTS,
  type TitlesJson,
  type TitleJson,
  type TitleStageJson,
  type TitleSlotJson,
  type TitleEarnedBy,
} from './titles-schema';
export { PVE } from './pve';
export { pveSchema, type PveJson, type EnemyPoolJson } from './pve-schema';
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
} from './tuning';
export type {
  CampaignJson,
  ExploreJson,
  ExploreModeJson,
  ExploreGateJson,
  PetHomeJson,
  SkyPillarJson,
} from './tuning';
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
export { RESONANCE, resonanceSchema } from './resonance';
export { VIP, vipSchema, type VipJson } from './vip';
export { TOKENS, tokensSchema, type TokensJson, type TokenJson } from './tokens';
export { SIGN_IN, signInSchema, type SignInJson } from './signin';
export { TOWER, towerSourceSchema, towerRuleSchema, type TowerSourceJson, type TowerRuleJson } from './tower';
export {
  DAILY_DUNGEONS,
  dailyDungeonsSchema,
  type DailyDungeonsJson,
  type DailyDungeonJson,
  type DailyDungeonId,
} from './daily-dungeons';
export {
  FASHION,
  FASHION_SLOTS,
  FASHION_LADDERS,
  fashionSchema,
  type FashionJson,
  type FashionPieceJson,
  type FashionSlot,
  type FashionLadder,
} from './fashion';
export { BERRY_SKILLS, berrySkillAt, berrySkillsSchema } from './berry-skills';
export {
  EQUIPMENT_TUNING,
  RELICS,
  HELD_TABLES,
  PLATES,
  TRINKETS,
  TRINKET_RULES,
  ORBS,
  BERRIES,
  CORE_SETS,
  relicById,
  trinketBySpecies,
  berryById,
  coreSetById,
} from './equipment';
export {
  equipmentTuningSchema,
  heldItemsSchema,
  platesSchema,
  trinketsSchema,
  orbsSchema,
  berriesSchema,
  coresSchema,
  type RelicJson,
  type HeldItemsJson,
  type PlateJson,
  type TrinketJson,
  type OrbsJson,
  type BerriesJson,
  type CoreSetJson,
} from './equipment-schema';

/** Bumped when the shape of any content directory changes. */
export const CONTENT_SCHEMA_VERSION = 2;

export const contentManifest = {
  game: 'wildbound',
  schemaVersion: CONTENT_SCHEMA_VERSION,
  dataDirs: Object.values(CONTENT_DIRS),
} as const;export { POTENTIAL, potentialSchema, type PotentialJson } from './potential';
