import account from '../tuning/account.json';
import combat from '../tuning/combat.json';
import growth from '../tuning/growth.json';
import power from '../tuning/power.json';
import {
  accountSchema,
  combatSettingsSchema,
  growthSchema,
  powerSchema,
  type AccountJson,
  type CombatSettingsJson,
  type GrowthJson,
  type PowerJson,
} from './schemas';

/**
 * Validated tuning tables (M2/M3). Everything tunable is data; these exports
 * are the single source both the client and the CLI read.
 */
export const COMBAT_SETTINGS: CombatSettingsJson = combatSettingsSchema.parse(combat);
export const GROWTH: GrowthJson = growthSchema.parse(growth);
export const POWER: PowerJson = powerSchema.parse(power);
export const ACCOUNT: AccountJson = accountSchema.parse(account);
