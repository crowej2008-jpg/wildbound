import pvp from '../tuning/pvp.json';
import { pvpSchema } from './pvp-schema';

export const PVP = pvpSchema.parse(pvp);
export type {
  PvpJson,
  ArenaJson,
  ArenaBandJson,
  RankedJson,
  RankedPhaseJson,
  RankedTierJson,
} from './pvp-schema';
