import { WILDS, type SpeciesJson } from '@wildbound/content';
import { formIndex, starCardFor, starRange, type StarCard } from '@wildbound/engine';

/** Client-side lookup of validated species content by id. */
export const speciesById = new Map<string, SpeciesJson>(WILDS.map((wild) => [wild.id, wild]));

export function species(id: string): SpeciesJson | undefined {
  return speciesById.get(id);
}

/** The species' star card for `stars` (R1: form name, level cap, stats). */
export function cardFor(meta: SpeciesJson, stars: number): StarCard {
  return starCardFor(meta.stars as StarCard[], stars);
}

/** 0-based form index for the portrait (distinct card names up to `stars`). */
export function formFor(meta: SpeciesJson, stars: number): number {
  return formIndex(meta.stars as StarCard[], stars);
}

/** The species' last star. */
export function topStar(meta: SpeciesJson): number {
  return starRange(meta.stars as StarCard[]).max;
}
