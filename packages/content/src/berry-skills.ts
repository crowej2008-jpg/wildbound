import { z } from 'zod';
import type { PlateSkillDef } from '@wildbound/engine';
import raw from '../equipment/berry-skills.json';
import { toEnginePlate } from './kit-to-engine';
import { plateSkillSchema } from './schemas';

/**
 * R6d: berry skills by star (generated from scripts/data/berry-skills.py). A carried berry adds the skill of
 * its star (the Commons: their one fixed skill) to the holder's kit — see `applyBerrySkills`.
 */
export const berrySkillsSchema = z.object({
  _note: z.string().optional(),
  skills: z.record(z.string(), z.record(z.string(), plateSkillSchema)),
});

const parsed = berrySkillsSchema.parse(raw);

export const BERRY_SKILLS: Record<string, Partial<Record<string, PlateSkillDef>>> = Object.fromEntries(
  Object.entries(parsed.skills).map(([id, stars]) => [id, toEnginePlate(stars)]),
);

/** The skill a berry gives at its star (stars below 1 use the 1★ skill — the Commons). */
export function berrySkillAt(defId: string, star: number): PlateSkillDef | undefined {
  return BERRY_SKILLS[defId]?.[String(Math.max(1, star))];
}
