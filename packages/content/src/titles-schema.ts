import { z } from 'zod';
import { statLineSchema } from './equipment-schema';

/**
 * R8 title catalogue, imported from the source by scripts/import-titles.mjs (title_basic_json +
 * title_up_stage_json). A title sits in one of three slots and is permanent or timed (7 / 14 days). Each stage is
 * paid with the title's own activation card; event titles climb 15 stages.
 */

export const TITLE_SLOTS = ['common', 'premium', 'rare'] as const;
export type TitleSlotJson = (typeof TITLE_SLOTS)[number];

/** Where Wildbound hands out the title today (null = its source mode is not built yet). */
export const titleEarnedBySchema = z.union([
  z.object({ kind: z.literal('start') }).strict(),
  z.object({ kind: z.literal('hardTower'), floor: z.number().int().min(1) }).strict(),
]);

export const titleStageSchema = z
  .object({
    /** Activation cards paid to reach this stage. */
    cost: z.number().int().min(0),
    stats: z.array(statLineSchema).min(1),
  })
  .strict();

export const titleSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    slot: z.enum(TITLE_SLOTS),
    /** Source priority: the order within the slot. */
    order: z.number().int(),
    /** null = permanent; otherwise the activation / continuation window. */
    durationDays: z.number().int().min(1).nullable(),
    /** The source item id of the title's activation card (null = granted directly, no card). */
    card: z.number().int().nullable(),
    /** Cards a Continuation costs (timed titles only). */
    continueCost: z.number().int().min(0).nullable(),
    /** The source's how-to-earn text. */
    earn: z.string().nullable(),
    earnedBy: titleEarnedBySchema.nullable(),
    stages: z.array(titleStageSchema).min(1),
  })
  .strict();

export const titlesSchema = z.array(titleSchema).length(102);

export type TitleJson = z.infer<typeof titleSchema>;
export type TitlesJson = z.infer<typeof titlesSchema>;
export type TitleStageJson = z.infer<typeof titleStageSchema>;
export type TitleEarnedBy = z.infer<typeof titleEarnedBySchema>;
