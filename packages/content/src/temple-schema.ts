import { z } from 'zod';

/** SPT Temple tuning (hand-entered from the owner's wiki). */
export const templeSchema = z
  .object({
    _note: z.string().optional(),
    seats: z.array(z.object({ id: z.string(), title: z.string(), name: z.string(), arenaTop: z.number().int().positive(), cpuEvolution: z.number().int().nonnegative(), base: z.number().positive() }).strict()).length(6),
    steps: z.array(z.number().int().positive()).min(1),
    multPerEvolution: z.number().positive(),
    failCooldownMinutes: z.number().nonnegative(),
    cpuChallengePerDay: z.number().nonnegative(),
  })
  .strict();
export type TempleJson = z.infer<typeof templeSchema>;
