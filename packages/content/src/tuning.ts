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
import victoryRoad from '../tuning/victory-road.json';
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
import { victoryRoadSchema, type VictoryRoadJson } from './victory-road-schema';
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
export const VICTORY_ROAD: VictoryRoadJson = victoryRoadSchema.parse(victoryRoad);
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
export type { VictoryRoadJson } from './victory-road-schema';
