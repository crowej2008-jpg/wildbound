import { z } from 'zod';
import { statLineSchema } from './equipment-schema';

/**
 * M11.11 title catalogue. A title occupies one of three slots and is either
 * permanent or timed. Every stage cost is paid in Title Tickets; event titles
 * keep the reference's 15-stage ladder even though no event feeds them yet.
 */

export const TITLE_SLOTS = ['common', 'premium', 'rare'] as const;
export type TitleSlotJson = (typeof TITLE_SLOTS)[number];

export const TITLE_SOURCES = [
  'trainer',
  'collection',
  'arena',
  'ranked',
  'guild',
  'event',
] as const;
export type TitleSourceJson = (typeof TITLE_SOURCES)[number];

export const titleRequirementSchema = z
  .object({
    kind: z.enum(['trainerLevel', 'uniqueSpecies', 'arenaCredits', 'arenaBestPlace', 'rankedWins']),
    value: z.number().int().min(0),
  })
  .strict();

export const titleStageSchema = z
  .object({
    /** Title Tickets paid to reach this stage (or to continue a timed title). */
    cost: z.number().int().min(0),
    stats: z.array(statLineSchema).min(1),
  })
  .strict();

export const titleSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    slot: z.enum(TITLE_SLOTS),
    source: z.enum(TITLE_SOURCES),
    /** null = permanent; otherwise the activation/continuation window. */
    durationDays: z.number().int().min(1).nullable(),
    /** null = no gate beyond the title source being live. */
    requirement: titleRequirementSchema.nullable(),
    stages: z.array(titleStageSchema).min(1),
  })
  .strict();

export const titlesSchema = z.array(titleSchema).min(1);

export type TitleJson = z.infer<typeof titleSchema>;
export type TitlesJson = z.infer<typeof titlesSchema>;
export type TitleStageJson = z.infer<typeof titleStageSchema>;
