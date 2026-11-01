import { z } from 'zod';
import raw from '../tuning/signin.json';
import { rewardSchema } from './schemas';

/** R9: the source's Sign In (scripts/import-signin.mjs, sign_json + sign_heap_json). */
export const signInSchema = z.object({
  _note: z.string().optional(),
  /** A missed day can be signed up to this many days later … */
  patchDays: z.number().int().min(0),
  /** … for this many Diamonds. */
  patchGems: z.number().int().min(0),
  days: z
    .array(
      z.object({
        day: z.number().int().min(1).max(31),
        rewards: rewardSchema,
        /** The VIP level from which the day pays double (null = never). */
        vipDouble: z.number().int().min(0).nullable(),
      }),
    )
    .length(31),
  milestones: z.array(z.object({ days: z.number().int().min(1).max(31), rewards: rewardSchema })).min(1),
});

export const SIGN_IN = signInSchema.parse(raw);
export type SignInJson = z.infer<typeof signInSchema>;
