import { z } from 'zod';
import raw from '../tuning/tower.json';
import { rewardSchema } from './schemas';

/** R9: the source's Pokémon Tower achievements and Hard-tower rules (scripts/import-tower.mjs, dun_tower_json). */
const payout = {
  rewards: rewardSchema,
  speciesShards: z.record(z.string(), z.number().int().positive()).optional(),
  titleCard: z.string().optional(),
};
export const towerRuleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('noPositions'), positions: z.array(z.number().int().min(1).max(6)).min(1) }),
  z.object({ kind: z.literal('maxFaction'), max: z.number().int().min(0), faction: z.enum(['water', 'fire', 'grass', 'light', 'dark']) }),
  z.object({ kind: z.literal('maxClass'), max: z.number().int().min(0), className: z.enum(['striker', 'guardian', 'adept']) }),
  z.object({ kind: z.literal('maxTier'), max: z.number().int().min(0), tier: z.string() }),
]);
export const towerSourceSchema = z.object({
  _note: z.string().optional(),
  normalFloors: z.number().int().positive(),
  hardFloors: z.number().int().positive(),
  hardStageFloors: z.number().int().positive(),
  normal: z.array(z.object({ floor: z.number().int().positive(), ...payout })).min(1),
  hard: z.array(z.object({ stage: z.number().int().positive(), floor: z.number().int().positive(), rule: towerRuleSchema, ...payout })).min(1),
});
export const TOWER = towerSourceSchema.parse(raw);
export type TowerSourceJson = z.infer<typeof towerSourceSchema>;
export type TowerRuleJson = z.infer<typeof towerRuleSchema>;
