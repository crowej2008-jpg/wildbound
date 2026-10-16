import { z } from 'zod';
import { rewardSchema } from './schemas';

export const shopRestockDailySchema = z
  .object({ type: z.literal('daily'), hoursUtc: z.array(z.number().int().nonnegative()).min(1) })
  .strict();

export const shopRestockIntervalSchema = z
  .object({ type: z.literal('interval'), days: z.number().int().positive(), hourUtc: z.number().int().nonnegative().max(23) })
  .strict();

export const shopRestockManualSchema = z
  .object({ type: z.literal('manual'), refreshCost: rewardSchema, refreshDailyLimit: z.number().int().nonnegative() })
  .strict();

export const shopRestockSchema = z.discriminatedUnion('type', [
  shopRestockDailySchema,
  shopRestockIntervalSchema,
  shopRestockManualSchema,
]);

export const shopItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    price: z.number().nonnegative(),
    grants: rewardSchema,
    limit: z.number().int().positive().optional(),
    oneTime: z.boolean().optional(),
  })
  .strict();

export const shopSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    currency: z.string().min(1),
    restock: shopRestockSchema,
    items: z.array(shopItemSchema).min(1),
  })
  .strict();

export type ShopJson = z.infer<typeof shopSchema>;

