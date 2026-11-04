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
    /** R9: a species' own shards (source 40xxx goods). */
    speciesShards: z.record(z.string(), z.number().int().positive()).optional(),
    /** R9: the row's cost currency when it differs from the shop's. */
    currency: z.string().min(1).optional(),
    /** R9: the source's discount — the price as a percent of the full price (50 = half off), display only. */
    discount: z.number().int().positive().optional(),
    /** R9: the Champion Road badge the row needs (source conditions priv_id). */
    badge: z.number().int().positive().optional(),
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
    /** R9: manual refreshes on top of the schedule (the Daily Shop): the price of each, the limit by VIP. */
    refresh: z.object({ costs: z.array(rewardSchema).min(1), limit: z.union([z.literal('vip'), z.number().int().nonnegative()]) }).strict().optional(),
    /** R9: how many rows show per restock; `fixed` always show, the rest are drawn from the other rows. */
    slots: z.number().int().positive().optional(),
    fixed: z.array(z.string()).optional(),
    /** Source rows whose goods Wildbound does not have (documentation only). */
    _leftOut: z.array(z.string()).optional(),
    items: z.array(shopItemSchema).min(1),
  })
  .strict();

export type ShopJson = z.infer<typeof shopSchema>;

