import {
  ACCOUNT,
  CAMPAIGN,
  CHAPTERS,
  RESONANCE,
  VIP,
  TOKENS,
  SIGN_IN,
  BAG,
  FASHION,
  DAILY_DUNGEONS,
  TOWER,
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
  HOOPA_VAULT,
  RIFT,
  MISTY,
  FACTION_TOWER,
  BERRY_GROVE,
  DIG_SITE,
  VICTORY_ROAD,
  KINGS_TRIAL,
  PARADISE,
  JOINT_TEAM,
  ISLES,
  ACCOUNT3,
  GUILD_EVENTS,
  GUILD_WAR_RELIC,
  PARK,
  WEEKEND_EVENTS,
  TEMPLE,
  CLASH,
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
import type { TowerSourceJson, DailyDungeonsJson, FashionJson, SignInJson, TokensJson, VipJson } from '@wildbound/content';
import type {
  CampaignJson,
  ChapterMetaJson,
  EconomyJson,
  ExploreJson,
  GymJson,
  PetHomeJson,
  SkyPillarJson,
  HoopaVaultJson,
  RiftJson,
  MistyJson,
  FactionTowerJson,
  BerryGroveJson,
  DigSiteJson,
  ParadiseJson,
  JointTeamJson,
  IslesJson,
  Account3Json,
  GuildEventsJson,
  GuildWarRelicJson,
  ParkJson,
  WeekendEventsJson,
  TempleJson,
  ClashJson,
  VictoryRoadJson,
  KingsTrialJson,
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
  type GachaRow,
  type BagRecipe,
  type BoxDef,
  type MachineId,
  type SupremeGiftDef,
  type WishingWellDef,
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
  quickCollectMinutes: number;
  quickCollectGems: number;
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
  /** M13.3 Hoopa's Vault. */
  hoopaVault: HoopaVaultJson;
  /** M13.4 Rift Barriers. */
  rift: RiftJson;
  /** M13.6 Misty Woods. */
  misty: MistyJson;
  /** M13.7 Faction Tower. */
  factionTower: FactionTowerJson;
  /** M13.8 Berry Grove. */
  berryGrove: BerryGroveJson;
  /** M13.9 Dig Site. */
  digSite: DigSiteJson;
  /** M14.1 Victory Road. */
  victoryRoad: VictoryRoadJson;
  /** M14.2 King's Trial. */
  kingsTrial: KingsTrialJson;
  /** M14.3 Pokémon Paradise. */
  paradise: ParadiseJson;
  /** M14.4 Joint Team Battles + Wild Area. */
  jointTeam: JointTeamJson;
  /** M14.5 Clash of Isles. */
  isles: IslesJson;
  /** M15 Account systems III. */
  account3: Account3Json;
  guildEvents: GuildEventsJson;
  guildWarRelic: GuildWarRelicJson;
  park: ParkJson;
  weekendEvents: WeekendEventsJson;
  temple: TempleJson;
  clash: ClashJson;
  quests: QuestDef[];
  /** R9: the source's two gachas, their pools (rows tagged with faction and tier), Wishing Well, Supreme Gift. */
  gacha: {
    machines: GachaMachineDef[];
    pools: Record<MachineId, GachaRow[]>;
    wishingWell: WishingWellDef;
    supremeGift: SupremeGiftDef;
  };
  shops: ShopDef[];
  economy: EconomyJson;
  /** M7 equipment catalogue + tuning. */
  equipment: EquipmentTables;
  /** M11 collection costs. */
  /** R4: the source's Potential (trees, costs, options). */
  potential: PotentialTable;
  /** M8 PvE mode tables (tower, trials, world boss, dungeons, link crystal). */
  pve: PveJson;
  /** R7: the source's Resonance. */
  resonance: ResonanceTables;
  /** R8: the source's VIP 0–40. */
  vip: VipJson;
  /** R8 Trainer Tokens (source celestica_trial_token_json). */
  tokens: TokensJson;
  /** R9 Sign In (source sign_json). */
  signIn: SignInJson;
  /** R9: the Bag's compose recipes and Pokémon boxes (species checked against the roster). */
  bag: { recipes: BagRecipe[]; boxes: BoxDef[] };
  /** R8 Mount / Back Decor / Follower / Outfits (curve and piece stats made up). */
  fashion: FashionJson;
  /** R9 daily dungeons (source dun_basic_json). */
  dailyDungeons: DailyDungeonsJson;
  /** R9 Pokémon Tower achievements and Hard rules (source dun_tower_json). */
  tower: TowerSourceJson;
  pvp: PvpJson;
  /** M11.11 title catalogue. */
  titles: TitlesJson;
  titleById: Map<string, TitleJson>;
  xpCurve: XpCurve;
  idle: IdleConfig;
  now: () => number;
  rng: Rng;
}

/** R9: the gacha tables with every pool row tagged by its species' faction and tier. */
function buildGacha(species: Map<string, SpeciesMeta>): GameConfig['gacha'] {
  const pools = {} as Record<MachineId, GachaRow[]>;
  const machines = GACHA.machines.map(({ pool, ...machine }) => {
    pools[machine.id] = pool.map((row) => {
      const meta = species.get(row.species);
      if (!meta) throw new Error(`gacha pool ${machine.id}: unknown species "${row.species}"`);
      return { speciesId: row.species, star: row.star, weight: row.weight, group: row.group, faction: meta.faction, tier: meta.tier };
    });
    return machine as GachaMachineDef;
  });
  return { machines, pools, wishingWell: GACHA.wishingWell, supremeGift: GACHA.supremeGift };
}

/** R9: the Bag tables, every box row's species checked against the roster. */
function buildBag(species: Map<string, SpeciesMeta>): GameConfig['bag'] {
  for (const box of BAG.boxes) {
    for (const row of box.rows) {
      const meta = species.get(row.species);
      if (!meta) throw new Error(`bag box ${box.id}: unknown species "${row.species}"`);
      if (row.star !== null && !meta.stars.some((c) => c.star === row.star)) {
        throw new Error(`bag box ${box.id}: ${row.species} has no ${row.star}★`);
      }
    }
  }
  return { recipes: BAG.recipes, boxes: BAG.boxes };
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
    hoopaVault: HOOPA_VAULT,
    rift: RIFT,
    misty: MISTY,
    factionTower: FACTION_TOWER,
    berryGrove: BERRY_GROVE,
    digSite: DIG_SITE,
    victoryRoad: VICTORY_ROAD,
    kingsTrial: KINGS_TRIAL,
    paradise: PARADISE,
    jointTeam: JOINT_TEAM,
    isles: ISLES,
    account3: ACCOUNT3,
    guildEvents: GUILD_EVENTS,
    guildWarRelic: GUILD_WAR_RELIC,
    park: PARK,
    weekendEvents: WEEKEND_EVENTS,
    temple: TEMPLE,
    clash: CLASH,
    quests: QUESTS,
    gacha: buildGacha(species),
    shops: SHOPS as unknown as ShopDef[],
    economy: ECONOMY,
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
    vip: VIP,
    tokens: TOKENS,
    signIn: SIGN_IN,
    bag: buildBag(species),
    fashion: FASHION,
    dailyDungeons: DAILY_DUNGEONS,
    tower: TOWER,
    pvp: PVP,
    titles: TITLES,
    titleById: new Map(TITLES.map((title) => [title.id, title])),
    xpCurve: { base: ECONOMY.xp.base, exponent: ECONOMY.xp.exponent, maxLevel: ECONOMY.xp.maxLevel },
    idle: {
      quickCollectMinutes: Math.round(ECONOMY.idle.quickCollectHours * 60),
      quickCollectGems: ECONOMY.idle.quickCollectGems,
    },
    now: () => Date.now(),
    rng: mulberry32(0x5eed),
  };
}
