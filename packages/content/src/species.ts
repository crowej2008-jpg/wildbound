import dark from '../species/dark.json';
import fire from '../species/fire.json';
import grass from '../species/grass.json';
import light from '../species/light.json';
import water from '../species/water.json';
import { speciesSchema, type SpeciesJson } from './schemas';

/**
 * The 84 species, grouped by the source's five factions on disk and validated on load. The
 * content package never reads the filesystem at runtime; JSON is imported at
 * build time so both the client (Vite) and the CLI (Node) share one source.
 */
const RAW: unknown[] = [...water, ...fire, ...grass, ...light, ...dark];

export const WILDS: SpeciesJson[] = RAW.map((species) => speciesSchema.parse(species));

export function wildById(id: string): SpeciesJson | undefined {
  return WILDS.find((w) => w.id === id);
}

export const FACTIONS = ['water', 'fire', 'grass', 'light', 'dark'] as const;

export function wildsByFaction(faction: (typeof FACTIONS)[number]): SpeciesJson[] {
  return WILDS.filter((w) => w.faction === faction);
}
