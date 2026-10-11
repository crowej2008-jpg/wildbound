import ember from '../species/ember.json';
import frost from '../species/frost.json';
import grove from '../species/grove.json';
import shade from '../species/shade.json';
import tide from '../species/tide.json';
import volt from '../species/volt.json';
import { speciesSchema, type SpeciesJson } from './schemas';

/**
 * The 36 Wilds (M2), grouped by faction on disk and validated on load. The
 * content package never reads the filesystem at runtime; JSON is imported at
 * build time so both the client (Vite) and the CLI (Node) share one source.
 */
const RAW: unknown[] = [...ember, ...tide, ...grove, ...volt, ...frost, ...shade];

export const WILDS: SpeciesJson[] = RAW.map((species) => speciesSchema.parse(species));

export function wildById(id: string): SpeciesJson | undefined {
  return WILDS.find((w) => w.id === id);
}

export const FACTIONS = ['ember', 'tide', 'grove', 'volt', 'frost', 'shade'] as const;

export function wildsByFaction(faction: (typeof FACTIONS)[number]): SpeciesJson[] {
  return WILDS.filter((w) => w.faction === faction);
}
