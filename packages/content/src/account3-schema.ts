import { z } from 'zod';

/** Account systems III tuning (M15), written by scripts/import-account3.mjs. Checked for its top-level shape. */
const line = z.object({ kind: z.enum(['core', 'percent']), field: z.string().min(1), value: z.number() }).strict();
export const account3Schema = z
  .object({
    _note: z.string().optional(),
    treasures: z
      .object({
        list: z
          .array(
            z
              .object({
                type: z.number().int(),
                name: z.string(),
                gym: z.number().int(),
                gymName: z.string(),
                summary: z.string(),
                skills: z.array(z.object({ level: z.number().int(), treasureLevel: z.number().int(), accessory: z.number().int(), refine: z.number().int(), text: z.string() }).strict()),
                accessory: z.array(z.object({ level: z.number().int(), cost: z.number() }).strict()),
                stars: z.array(z.object({ star: z.number().int(), cost: z.number(), lines: z.array(line) }).strict()),
                refine: z.array(z.object({ level: z.number().int(), treasureLevel: z.number().int().optional(), cost: z.number().optional() }).strict()),
              })
              .strict(),
          )
          .length(6),
        resonance: z.array(z.object({ level: z.number().int(), skillLevel: z.number().int(), lines: z.array(line) }).strict()),
        factionSlots: z.array(z.object({ unlocked: z.number().int(), perFaction: z.number().int() }).strict()),
        levelCost: z.object({ base: z.number(), perLevel: z.number() }).strict(),
        maxLevel: z.number().int().positive(),
      })
      .strict(),
    wristband: z
      .object({
        levels: z.array(z.object({ level: z.number().int(), cost: z.number(), lines: z.array(line) }).strict()),
        crystalCaps: z.array(z.object({ wristband: z.number().int(), maxLevel: z.number().int() }).strict()),
        crystals: z.array(z.object({ faction: z.enum(['water', 'fire', 'grass', 'light', 'dark']), levels: z.array(z.object({ level: z.number().int(), cost: z.number(), lines: z.array(line) }).strict()) }).strict()),
      })
      .strict(),
    fusion: z.array(z.object({ id: z.number().int(), name: z.string(), species: z.string().nullable(), perk: z.string(), levels: z.array(z.object({ level: z.number().int(), cost: z.number(), perkValue: z.number(), lines: z.array(line) }).strict()) }).strict()),
    egg: z
      .object({
        freePerDay: z.number().int(),
        pointsPerSmash: z.number().int(),
        jackpot: z.array(z.object({ weight: z.number(), species: z.string().optional(), shards: z.number().optional(), rewards: z.record(z.string(), z.number()).optional(), notCopied: z.array(z.string()).optional() }).strict()),
        shop: z.array(z.object({ id: z.number().int(), price: z.number(), limit: z.number().int(), species: z.string().nullable(), shards: z.number() }).strict()),
      })
      .strict(),
    awaken: z
      .object({
        need: z.number().int(),
        tasks: z.array(z.object({ id: z.number().int(), event: z.string(), value: z.number().int(), progress: z.number().int(), desc: z.string() }).strict()),
        serverDay: z.number().int(),
        at18: z.number().int(),
      })
      .strict(),
  })
  .strict();
export type Account3Json = z.infer<typeof account3Schema>;
