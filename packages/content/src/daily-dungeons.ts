import { z } from 'zod';
import raw from '../tuning/daily-dungeons.json';
import { rewardSchema } from './schemas';

/** R9: the source's four daily dungeons (scripts/import-daily-dungeons.mjs). */
const gradeSchema = z.object({
  grade: z.enum(['C', 'B', 'A', 'S']),
  kills: z.number().int().positive().optional(),
  damage: z.number().int().positive().optional(),
  rounds: z.number().int().positive().optional(),
  pay: rewardSchema,
  chest: rewardSchema,
});
export const dailyDungeonsSchema = z.object({
  _note: z.string().optional(),
  dungeons: z
    .array(
      z.object({
        id: z.enum(['gold', 'vanity', 'xp', 'shard']),
        name: z.string().min(1),
        desc: z.string().min(1),
        runs: z.number().int().positive(),
        rounds: z.number().int().positive(),
        difficulties: z
          .array(
            z.object({
              id: z.string(),
              name: z.string().min(1),
              level: z.number().int().positive(),
              sweep: rewardSchema,
              winPay: rewardSchema,
              grades: z.array(gradeSchema).length(4),
            }),
          )
          .length(10),
      }),
    )
    .length(4),
});
export const DAILY_DUNGEONS = dailyDungeonsSchema.parse(raw);
export type DailyDungeonsJson = z.infer<typeof dailyDungeonsSchema>;
export type DailyDungeonJson = DailyDungeonsJson['dungeons'][number];
export type DailyDungeonId = DailyDungeonJson['id'];
