import { z } from 'zod';

/** Dig Site tuning (M13.9): the owner's replacement for the Ultra Wormhole; every number a stand-in. */
const cell = z.array(z.number().int().nonnegative()).length(2);
const shape = z.array(cell).min(1);
const tool = z
  .object({ center: z.number().int().nonnegative(), edge: z.number().int().nonnegative(), diagonal: z.number().int().nonnegative(), shake: z.number().int().positive() })
  .strict();

export const digSiteSchema = z
  .object({
    _note: z.string().optional(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    depthMin: z.number().int().positive(),
    depthMax: z.number().int().positive(),
    stability: z.number().int().positive(),
    tools: z.object({ pick: tool, hammer: tool }).strict(),
    itemsMin: z.number().int().positive(),
    itemsMax: z.number().int().positive(),
    bedrockMin: z.number().int().nonnegative(),
    bedrockMax: z.number().int().nonnegative(),
    bedrock: z.array(shape).min(1),
    items: z
      .array(
        z
          .object({
            id: z.string().min(1),
            name: z.string().min(1),
            kind: z.enum(['soulHeart', 'exp', 'fossil', 'treasure']),
            weight: z.number().positive(),
            shape,
            quality: z.enum(['blue', 'purple', 'orange', 'red']).optional(),
            exp: z.number().int().positive().optional(),
          })
          .strict(),
      )
      .min(1),
    labSlots: z.number().int().positive(),
    cure: z.array(z.object({ fossil: z.string().min(1), hours: z.number().positive(), gold: z.number().int().nonnegative() }).strict()),
    duplicateExp: z.object({ fossil: z.number().int().nonnegative(), treasure: z.number().int().nonnegative() }).strict(),
    pieces: z
      .array(z.object({ id: z.string().min(1), group: z.string().min(1), hp: z.number().int().nonnegative(), atk: z.number().int().nonnegative() }).strict())
      .min(1),
    groups: z
      .array(
        z
          .object({
            id: z.string().min(1),
            name: z.string().min(1),
            /** A full group's rarer lines (crit, block, damage boost …), as fractions. */
            lines: z
              .array(
                z
                  .object({
                    field: z.enum(['crit', 'critRes', 'critPower', 'block', 'blockPower', 'guardBreak', 'dmgBoost', 'dmgRdct', 'controlBoost', 'controlRes', 'pvpBoost', 'pvpRdct']),
                    value: z.number().positive(),
                  })
                  .strict(),
              )
              .min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type DigSiteJson = z.infer<typeof digSiteSchema>;
