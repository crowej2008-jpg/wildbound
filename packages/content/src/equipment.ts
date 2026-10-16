import charms from '../equipment/charms.json';
import cores from '../equipment/cores.json';
import relics from '../equipment/relics.json';
import runes from '../equipment/runes.json';
import talents from '../equipment/talents.json';
import equipmentTuning from '../tuning/equipment.json';
import {
  charmsSchema,
  coresSchema,
  equipmentTuningSchema,
  relicsSchema,
  runesSchema,
  talentsSchema,
} from './equipment-schema';

/**
 * Validated M7 equipment catalogue. Shapes mirror the engine's
 * `equipment/types.ts`; the server assembles an `EquipmentTables` from these.
 */
export const EQUIPMENT_TUNING = equipmentTuningSchema.parse(equipmentTuning);
export const RELICS = relicsSchema.parse(relics).relics;

const RUNE_CATALOGUE = runesSchema.parse(runes);
export const RUNES = RUNE_CATALOGUE.runes;
export const RUNE_SETS = RUNE_CATALOGUE.sets;

export const CHARMS = charmsSchema.parse(charms).charms;
export const CORE_SETS = coresSchema.parse(cores).sets;

const TALENT_CATALOGUE = talentsSchema.parse(talents);
export const TALENT_BLOCKS = TALENT_CATALOGUE.blocks;
export const TALENT_TREES = TALENT_CATALOGUE.trees;

export function relicById(id: string) {
  return RELICS.find((r) => r.id === id);
}
export function charmById(id: string) {
  return CHARMS.find((c) => c.id === id);
}
export function coreSetById(id: string) {
  return CORE_SETS.find((s) => s.id === id);
}
export function talentTreeById(id: string) {
  return TALENT_TREES.find((t) => t.id === id);
}
