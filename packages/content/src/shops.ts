import daily from '../shops/daily.json';
import forest from '../shops/forest.json';
import island from '../shops/island.json';
import guild from '../shops/guild.json';
import pvp from '../shops/pvp.json';
import wilds from '../shops/wilds.json';
import { shopSchema } from './shop-schema';
import type { ShopJson } from './shop-schema';

const RAW: unknown[] = [daily, forest, island, guild, pvp, wilds];

export const SHOPS: ShopJson[] = RAW.map((shop) => shopSchema.parse(shop));
export function shopById(id: string): ShopJson | undefined {
  return SHOPS.find((s) => s.id === id);
}
export { shopSchema } from './shop-schema';
export type { ShopJson } from './shop-schema';
