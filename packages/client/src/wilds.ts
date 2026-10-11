import { WILDS, type SpeciesJson } from '@wildbound/content';

/** Client-side lookup of validated species content by id. */
export const speciesById = new Map<string, SpeciesJson>(WILDS.map((wild) => [wild.id, wild]));

export function species(id: string): SpeciesJson | undefined {
  return speciesById.get(id);
}
