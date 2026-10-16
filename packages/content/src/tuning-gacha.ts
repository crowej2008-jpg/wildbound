import gacha from '../tuning/gacha.json';
import { gachaSchema } from './gacha-schema';

export const GACHA = gachaSchema.parse(gacha);
export type { GachaJson } from './gacha-schema';
