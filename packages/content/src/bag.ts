import { z } from 'zod';
import raw from '../tuning/bag.json';

/** R9: the Bag's generic shards and Pokémon boxes (scripts/import-bag.mjs, docs/design/bag.md). */
const boxRowSchema = z
  .object({
    species: z.string().min(1),
    /** The exact star for a card row; null = the species' first star (or, for chooseShards, unused). */
    star: z.number().int().min(1).nullable(),
    /** Random boxes: the row's weight. chooseShards: the shards granted. chooseSpecies: unused (1). */
    weight: z.number().positive(),
  })
  .strict();

export const bagSchema = z
  .object({
    _note: z.string().optional(),
    recipes: z
      .array(z.object({ from: z.string().min(1), count: z.number().int().positive(), box: z.string().min(1) }).strict())
      .min(1),
    boxes: z
      .array(
        z
          .object({
            id: z.string().min(1),
            kind: z.enum(['random', 'chooseSpecies', 'chooseShards']),
            /** Composed random boxes open themselves and are never kept. */
            autoOpen: z.boolean(),
            rows: z.array(boxRowSchema).min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .superRefine((bag, ctx) => {
    const ids = new Set(bag.boxes.map((b) => b.id));
    for (const r of bag.recipes) {
      if (!ids.has(r.box)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `recipe ${r.from}: unknown box ${r.box}` });
    }
  });

export type BagJson = z.infer<typeof bagSchema>;
export const BAG: BagJson = bagSchema.parse(raw);
