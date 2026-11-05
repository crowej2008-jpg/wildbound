import account from '../tuning/account.json';
import campaign from '../tuning/campaign.json';
import explore from '../tuning/explore.json';
import petHome from '../tuning/pet-home.json';
import skyPillar from '../tuning/sky-pillar.json';
import hoopaVault from '../tuning/hoopa-vault.json';
import rift from '../tuning/rift.json';
import misty from '../tuning/misty.json';
import factionTower from '../tuning/faction-tower.json';
import berryGrove from '../tuning/berry-grove.json';
import digSite from '../tuning/dig-site.json';
import paradise from '../tuning/paradise.json';
import jointTeam from '../tuning/joint-team.json';
import isles from '../tuning/isles.json';
import account3 from '../tuning/account3.json';
import guildEvents from '../tuning/guild-events.json';
import guildWarRelic from '../tuning/guild-war-relic.json';
import park from '../tuning/park.json';
import weekendEvents from '../tuning/weekend-events.json';
import temple from '../tuning/temple.json';
import victoryRoad from '../tuning/victory-road.json';
import kingsTrial from '../tuning/kings-trial.json';
import combat from '../tuning/combat.json';
import economy from '../tuning/economy.json';
import growth from '../tuning/growth.json';
import power from '../tuning/power.json';
import { GACHA } from './tuning-gacha';
import { gachaSchema, type GachaJson } from './gacha-schema';
import { petHomeSchema, type PetHomeJson } from './pet-home-schema';
import { skyPillarSchema, type SkyPillarJson } from './sky-pillar-schema';
import { hoopaVaultSchema, type HoopaVaultJson } from './hoopa-vault-schema';
import { riftSchema, type RiftJson } from './rift-schema';
import { mistySchema, type MistyJson } from './misty-schema';
import { factionTowerSchema, type FactionTowerJson } from './faction-tower-schema';
import { berryGroveSchema, type BerryGroveJson } from './berry-grove-schema';
import { digSiteSchema, type DigSiteJson } from './dig-site-schema';
import { paradiseSchema, type ParadiseJson } from './paradise-schema';
import { jointTeamSchema, type JointTeamJson } from './joint-team-schema';
import { islesSchema, type IslesJson } from './isles-schema';
import { account3Schema, type Account3Json } from './account3-schema';
import { guildEventsSchema, type GuildEventsJson } from './guild-events-schema';
import { guildWarRelicSchema, type GuildWarRelicJson } from './guild-war-relic-schema';
import { parkSchema, type ParkJson } from './park-schema';
import { weekendEventsSchema, type WeekendEventsJson } from './weekend-events-schema';
import { templeSchema, type TempleJson } from './temple-schema';
import { victoryRoadSchema, type VictoryRoadJson } from './victory-road-schema';
import { kingsTrialSchema, type KingsTrialJson } from './kings-trial-schema';
import {
  accountSchema,
  campaignSchema,
  combatSettingsSchema,
  economySchema,
  exploreSchema,
  growthSchema,
  powerSchema,
  type AccountJson,
  type CampaignJson,
  type CombatSettingsJson,
  type EconomyJson,
  type ExploreJson,
  type GrowthJson,
  type PowerJson,
} from './schemas';

export const COMBAT_SETTINGS: CombatSettingsJson = combatSettingsSchema.parse(combat);
export const GROWTH: GrowthJson = growthSchema.parse(growth);
export const POWER: PowerJson = powerSchema.parse(power);
export const ACCOUNT: AccountJson = accountSchema.parse(account);
export const ECONOMY: EconomyJson = economySchema.parse(economy);
export const CAMPAIGN: CampaignJson = campaignSchema.parse(campaign);
export const EXPLORE: ExploreJson = exploreSchema.parse(explore);
export const PET_HOME: PetHomeJson = petHomeSchema.parse(petHome);
export const SKY_PILLAR: SkyPillarJson = skyPillarSchema.parse(skyPillar);
export const HOOPA_VAULT: HoopaVaultJson = hoopaVaultSchema.parse(hoopaVault);
export const RIFT: RiftJson = riftSchema.parse(rift);
export const MISTY: MistyJson = mistySchema.parse(misty);
export const FACTION_TOWER: FactionTowerJson = factionTowerSchema.parse(factionTower);
export const BERRY_GROVE: BerryGroveJson = berryGroveSchema.parse(berryGrove);
export const DIG_SITE: DigSiteJson = digSiteSchema.parse(digSite);
export const PARADISE: ParadiseJson = paradiseSchema.parse(paradise);
export const JOINT_TEAM: JointTeamJson = jointTeamSchema.parse(jointTeam);
export const ISLES: IslesJson = islesSchema.parse(isles);
export const ACCOUNT3: Account3Json = account3Schema.parse(account3);
export const GUILD_EVENTS: GuildEventsJson = guildEventsSchema.parse(guildEvents);
export const GUILD_WAR_RELIC: GuildWarRelicJson = guildWarRelicSchema.parse(guildWarRelic);
export const PARK: ParkJson = parkSchema.parse(park);
export const WEEKEND_EVENTS: WeekendEventsJson = weekendEventsSchema.parse(weekendEvents);
export const TEMPLE: TempleJson = templeSchema.parse(temple);
export const VICTORY_ROAD: VictoryRoadJson = victoryRoadSchema.parse(victoryRoad);
export const KINGS_TRIAL: KingsTrialJson = kingsTrialSchema.parse(kingsTrial);
export const GACHA_TUNING: GachaJson = gachaSchema.parse(GACHA);
export type { GachaJson } from './gacha-schema';
export type { CampaignJson, ExploreJson, ExploreModeJson, ExploreGateJson } from './schemas';
export type { PetHomeJson } from './pet-home-schema';
export type { SkyPillarJson } from './sky-pillar-schema';
export type { HoopaVaultJson } from './hoopa-vault-schema';
export type { RiftJson } from './rift-schema';
export type { MistyJson } from './misty-schema';
export type { FactionTowerJson } from './faction-tower-schema';
export type { BerryGroveJson } from './berry-grove-schema';
export type { DigSiteJson } from './dig-site-schema';
export type { ParadiseJson } from './paradise-schema';
export type { JointTeamJson } from './joint-team-schema';
export type { IslesJson } from './isles-schema';
export type { Account3Json } from './account3-schema';
export type { GuildEventsJson } from './guild-events-schema';
export type { GuildWarRelicJson } from './guild-war-relic-schema';
export type { ParkJson } from './park-schema';
export type { WeekendEventsJson } from './weekend-events-schema';
export type { TempleJson } from './temple-schema';
export type { VictoryRoadJson } from './victory-road-schema';
export type { KingsTrialJson } from './kings-trial-schema';
