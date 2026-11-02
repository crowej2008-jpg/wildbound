import dark from '../species/dark.json';
import fire from '../species/fire.json';
import grass from '../species/grass.json';
import light from '../species/light.json';
import summonPool from '../species/summon-pool.json';
import water from '../species/water.json';
import { speciesSchema, type SpeciesJson } from './schemas';

/**
 * The 98 species — the owner's 84 plus the 14 summon-pool Pokémon (R9, owner 2026-11-02; made up in
 * scripts/generate-summon-pokemon.mjs) — grouped by the source's five factions on disk and validated on load. The
 * content package never reads the filesystem at runtime; JSON is imported at
 * build time so both the client (Vite) and the CLI (Node) share one source.
 */
const RAW: unknown[] = [...water, ...fire, ...grass, ...light, ...dark, ...summonPool];

export const WILDS: SpeciesJson[] = RAW.map((species) => speciesSchema.parse(species));

export function wildById(id: string): SpeciesJson | undefined {
  return WILDS.find((w) => w.id === id);
}

export const FACTIONS = ['water', 'fire', 'grass', 'light', 'dark'] as const;

export function wildsByFaction(faction: (typeof FACTIONS)[number]): SpeciesJson[] {
  return WILDS.filter((w) => w.faction === faction);
}
