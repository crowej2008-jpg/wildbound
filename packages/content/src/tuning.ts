import account from '../tuning/account.json';
import campaign from '../tuning/campaign.json';
import collection from '../tuning/collection.json';
import explore from '../tuning/explore.json';
import petHome from '../tuning/pet-home.json';
import combat from '../tuning/combat.json';
import economy from '../tuning/economy.json';
import growth from '../tuning/growth.json';
import power from '../tuning/power.json';
import { GACHA } from './tuning-gacha';
import { gachaSchema, type GachaJson } from './gacha-schema';
import { collectionTuningSchema, type CollectionJson } from './collection-schema';
import { petHomeSchema, type PetHomeJson } from './pet-home-schema';
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
export const GACHA_TUNING: GachaJson = gachaSchema.parse(GACHA);
export const COLLECTION_TUNING: CollectionJson = collectionTuningSchema.parse(collection);
export type { GachaJson } from './gacha-schema';
export type { CollectionJson } from './collection-schema';
export type { CampaignJson, ExploreJson, ExploreModeJson, ExploreGateJson } from './schemas';
export type { PetHomeJson } from './pet-home-schema';
