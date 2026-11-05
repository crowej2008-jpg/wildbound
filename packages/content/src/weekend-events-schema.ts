import { z } from 'zod';

/** Weekend Bash + Flower Event tuning (from the owner's wiki; hand-entered). */
const rewards = z.record(z.string(), z.number());
const offer = z.object({ id: z.number().int(), name: z.string(), price: z.number(), limit: z.number().int(), rewards }).strict();
export const weekendEventsSchema = z
  .object({
    _note: z.string().optional(),
    elven: z
      .object({
        weekdays: z.array(z.number().int().min(0).max(6)),
        tiles: z.number().int().positive(),
        grandIn: z.number().int().positive(),
        tileReward: rewards,
        buy: z.array(z.object({ upTo: z.number().int(), price: z.number() }).strict()),
        grand: z.array(z.object({ round: z.number().int(), rewards, titleCard: z.string().optional() }).strict()),
        cashback: z.array(z.tuple([z.number(), z.number()])),
        exchange: z.array(offer),
      })
      .strict(),
    bingo: z
      .object({
        weekdays: z.array(z.number().int().min(0).max(6)),
        numbers: z.number().int().positive(),
        lines: z.array(z.object({ id: z.string(), cells: z.array(z.number().int()), rewards: rewards.optional(), wildcard: z.number().int().optional() }).strict()),
        wildcards: z.array(z.array(z.object({ id: z.string(), rewards }).strict())),
        sauceShop: z.array(z.object({ price: z.number(), limit: z.number().int() }).strict()),
        exchange: z.array(offer),
      })
      .strict(),
    flower: z
      .object({
        tasks: z.array(z.object({ source: z.string(), label: z.string(), steps: z.array(z.tuple([z.number(), z.number()])) }).strict()),
        milestones: z.array(z.object({ flowers: z.number(), rewards }).strict()),
        ranks: z.array(z.object({ rank: z.number().int(), rewards }).strict()),
        cpuTop: z.number(),
      })
      .strict(),
  })
  .strict();
export type WeekendEventsJson = z.infer<typeof weekendEventsSchema>;
