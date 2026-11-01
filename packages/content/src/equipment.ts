import charms from '../equipment/charms.json';
import cores from '../equipment/cores.json';
import plates from '../equipment/plates.json';
import heldItems from '../equipment/held-items.json';
import { toEngineTrigger } from './kit-to-engine';
import runes from '../equipment/runes.json';
import trinkets from '../equipment/trinkets.json';
import equipmentTuning from '../tuning/equipment.json';
import {
  charmsSchema,
  coresSchema,
  equipmentTuningSchema,
  platesSchema,
  heldItemsSchema,
  runesSchema,
  trinketsSchema,
} from './equipment-schema';

/**
 * Validated M7 equipment catalogue. Shapes mirror the engine's
 * `equipment/types.ts`; the server assembles an `EquipmentTables` from these.
 */
export const EQUIPMENT_TUNING = equipmentTuningSchema.parse(equipmentTuning);
const HELD_CATALOGUE = heldItemsSchema.parse(heldItems);
/** R5: the source's 75 held items (code id: relics); E2 skill triggers converted for the engine. */
export const RELICS = HELD_CATALOGUE.items.map((item) =>
  item.skill ? { ...item, skill: { ...item.skill, triggers: item.skill.triggers?.map(toEngineTrigger) } } : item,
);
/** R5: held-item pools, level costs and the refine ladder. */
export const HELD_TABLES = {
  mainPool: HELD_CATALOGUE.mainPool,
  linePool: HELD_CATALOGUE.linePool,
  levelCost: HELD_CATALOGUE.levelCost,
  levelGates: HELD_CATALOGUE.levelGates,
  refineLadder: HELD_CATALOGUE.refineLadder,
  resetterCompound: HELD_CATALOGUE.resetterCompound,
};
export const PLATES = platesSchema.parse(plates).plates;
export const TRINKETS = trinketsSchema.parse(trinkets).trinkets;

const RUNE_CATALOGUE = runesSchema.parse(runes);
export const RUNES = RUNE_CATALOGUE.runes;
export const RUNE_SETS = RUNE_CATALOGUE.sets;

export const CHARMS = charmsSchema.parse(charms).charms;
export const CORE_SETS = coresSchema.parse(cores).sets;

export function relicById(id: string) {
  return RELICS.find((r) => r.id === id);
}
export function plateByFaction(faction: string) {
  return PLATES.find((p) => p.faction === faction);
}
export function trinketBySpecies(speciesId: string) {
  return TRINKETS.find((t) => t.speciesId === speciesId);
}
export function charmById(id: string) {
  return CHARMS.find((c) => c.id === id);
}
export function coreSetById(id: string) {
  return CORE_SETS.find((s) => s.id === id);
}
