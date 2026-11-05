import { z } from 'zod';
import { rewardSchema } from './schemas';

/** Clash of Isles tuning (M14.5), assembled from island_new_* (see the file's _note). */
const n = z.number().nonnegative();
export const islesSchema = z
  .object({
    _note: z.string().optional(),
    gate: z.object({ serverDay: z.number().int().positive(), stage: z.string().min(1) }).strict(),
    attemptsMax: z.number().int().positive(),
    attemptRegenMin: z.number().int().positive(),
    powerPerDay: z.number().int().positive(),
    powerPerMinute: z.number().int().positive(),
    tokenEveryMin: z.number().int().positive(),
    pointsPerBattle: n,
    winBonus: n,
    boosts: z.array(z.object({ attempts: z.number().int().positive(), pct: n }).strict()),
    fatiguePerWin: n,
    fatigueMax: n,
    cpuShields: z.number().int().positive(),
    tasks: z.array(z.object({ challenges: z.number().int().positive(), rewards: rewardSchema }).strict()),
    tiers: z.record(z.string(), z.string()),
    islands: z.array(z.object({ id: z.number().int().positive(), area: z.number().int().positive(), tier: z.number().int().positive(), tokens: n }).strict()).min(1),
    ranks: z.array(z.object({ upTo: z.number().int().positive(), rewards: rewardSchema, notCopied: z.array(z.string()).optional() }).strict()),
  })
  .strict();
export type IslesJson = z.infer<typeof islesSchema>;
