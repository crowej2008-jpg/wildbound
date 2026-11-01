import { z } from 'zod';
import raw from '../tuning/vip.json';

/** R8: the source's VIP 0–40 (scripts/import-vip.mjs). */
export const vipSchema = z.object({
  _note: z.string().optional(),
  dailyActivityXp: z.number().int().min(0),
  levels: z
    .array(
      z.object({
        level: z.number().int().min(0),
        xp: z.number().int().min(0),
        showFrom: z.number().int().min(0),
        idleCandyBonus: z.number().min(0),
        idleGoldBonus: z.number().min(0),
        idleCapHours: z.number().min(1),
        quickCombat: z.number().int().min(0),
        quickCombatFree: z.number().int().min(0),
        arenaBuys: z.number().int().min(0),
        dungeonBuys: z.number().int().min(0),
        dailyShopRefreshes: z.number().int().min(0),
        bag: z.number().int().min(0),
        goldenTouch: z.array(z.number().int()),
        pack: z.array(z.object({ item: z.number().int(), n: z.number().int() })),
      }),
    )
    .length(41),
});

export const VIP = vipSchema.parse(raw);
export type VipJson = z.infer<typeof vipSchema>;
