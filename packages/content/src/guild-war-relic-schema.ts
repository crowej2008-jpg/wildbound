import { z } from 'zod';

/** Guild War + Relic Battlefield tuning (M17), written by scripts/import-guild-war-relic.mjs. */
const rewards = z.record(z.string(), z.number());
const rank = z.object({ rank: z.number().int(), rewards, titleCard: z.string().optional() }).strict();
export const guildWarRelicSchema = z
  .object({
    guildWar: z
      .object({
        activity: z.array(z.number()).min(1),
        battle: rewards,
        kill: rewards,
        bosses: z.number().int().positive(),
        rounds: z.number().int().positive(),
        difficulties: z.number().int().positive(),
        dailyRank: z.array(rank).min(1),
        seasonRank: z.array(rank).min(1),
        guildRank: z.array(rank).min(1),
        roundHp: z.object({ base: z.number().positive(), growth: z.number().positive() }).strict(),
        cpuDamagePerDay: z.number(),
        cpuGuilds: z.number().int().positive(),
      })
      .strict(),
    relic: z
      .object({
        stamina: z.object({ max: z.number(), regenMinutes: z.number(), attack: z.number(), explore: z.number() }).strict(),
        exploreCooldownSec: z.number(),
        maxHeld: z.number().int(),
        guardTeams: z.number().int(),
        score: z.object({ win: z.number(), loss: z.number() }).strict(),
        garrison: z.record(z.string(), z.object({ monsters: z.number().int(), bosses: z.number().int() }).strict()),
        map: z.array(z.object({ index: z.number().int(), type: z.number().int(), score: z.number(), neighbours: z.array(z.number().int()), openDay: z.number().int() }).strict()).min(10),
        events: z.array(z.object({ id: z.number().int(), type: z.number().int(), value: z.number(), weight: z.number() }).strict()),
        tasks: z.array(z.object({ id: z.number().int(), scope: z.enum(['personal', 'guild']), event: z.number().int(), target: z.number(), rewards }).strict()),
        placeRewards: z.array(z.object({ place: z.number().int(), rewards }).strict()),
      })
      .strict(),
  })
  .strict();
export type GuildWarRelicJson = z.infer<typeof guildWarRelicSchema>;
