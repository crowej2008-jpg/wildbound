import { z } from 'zod';

/** World Championship + League Championship tuning (M18.3), written by scripts/import-championship.mjs. */
const rewards = z.record(z.string(), z.number());
export const championshipSchema = z
  .object({
    world: z
      .object({
        anchorMonday: z.string(),
        tiers: z.array(z.object({ stage: z.number().int(), name: z.string(), opens: z.tuple([z.number(), z.number()]) }).strict()).length(3),
        lock: z.tuple([z.number(), z.number()]),
        knockout: z.array(z.tuple([z.number(), z.number(), z.number()])),
        settle: z.tuple([z.number(), z.number()]),
        leagues: z.array(z.object({ group: z.number().int(), minLevel: z.number() }).strict()).min(1),
        floors: z.record(z.string(), z.array(z.object({ floor: z.number().int(), level: z.number(), rewards }).strict())),
        rank: z.record(z.string(), z.array(z.object({ min: z.number().int(), max: z.number().int(), rewards }).strict())),
        cpuShare: z.number(),
        field: z.number().int(),
      })
      .strict(),
    league: z
      .object({
        days: z.record(z.string(), z.object({ kind: z.enum(['r64', 'groups', 'ko']), battles: z.number().int().optional(), losses: z.number().int().optional(), need: z.number().int().optional(), rounds: z.array(z.string()).optional() }).strict()),
        resolveHour: z.number(),
        placements: z.array(z.object({ place: z.number().int(), rewards }).strict()),
        serverDay: z.number().int(),
        cpu: z.object({ base: z.number(), perStage: z.number() }).strict(),
      })
      .strict(),
  })
  .strict();
export type ChampionshipJson = z.infer<typeof championshipSchema>;
