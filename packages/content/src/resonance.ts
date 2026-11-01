import { z } from 'zod';
import raw from '../tuning/resonance.json';

/** R7: the source's Resonance (scripts/import-resonance.mjs). */
export const resonanceSchema = z.object({
  _note: z.string().optional(),
  defaultSlots: z.number().int().min(1),
  evolutionSlots: z.number().int().min(0),
  evolutionLevel: z.number().int().min(1),
  cooldownHours: z.number().min(0),
  clearGemsPerHour: z.number().int().min(0),
  maxSlots: z.number().int().min(1),
  maxSlotsEvolved: z.number().int().min(1),
  capBase: z.number().int().min(1),
  capPerPokemon: z.number().int().min(1),
  capStars: z.number().int().min(1),
  slotPrices: z.array(z.object({ openNum: z.number().int(), shards: z.number().int().min(0), gems: z.number().int().min(0) })),
  upgradePoints: z.array(z.object({ level: z.number().int(), candy: z.number().int(), stones: z.number().int() })).min(2),
  goldPerCandy: z.number().min(0),
});

export const RESONANCE = resonanceSchema.parse(raw);
