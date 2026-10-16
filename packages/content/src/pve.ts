import pve from '../tuning/pve.json';
import { pveSchema } from './pve-schema';

export const PVE = pveSchema.parse(pve);
export type { PveJson, EnemyPoolJson, TrialDefJson, DungeonDefJson } from './pve-schema';
