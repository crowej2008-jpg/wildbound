import {
  planFodder,
  starCardFor,
  starRange,
  type AccountState,
  type Faction,
  type FodderReq,
  type StarCard,
} from '@wildbound/engine';

/**
 * Evolution (R1): the source's "Evolve" raises a Pokémon one star by consuming fodder — copies of the
 * same species and same-faction Pokémon at set stars (hero_evolution_json evolution_item). Shared by
 * LocalServer.evolve and the client's Evolve tab so both read the same plan.
 */

/** What evolution needs to know about a species. */
export interface EvolutionSpecies {
  faction: Faction;
  stars: StarCard[];
}

export type EvolutionBlock = 'max_star' | 'awakening';

export interface EvolutionRequirement extends FodderReq {
  /** Eligible Wilds the account has for this line (capped at `count`). */
  have: number;
}

export interface EvolutionView {
  card: StarCard;
  /** The next star's card, or null at the top of the ladder. */
  next: StarCard | null;
  /** Why the star can't be raised by evolving at all; null when it can. */
  blocked: EvolutionBlock | null;
  requirements: EvolutionRequirement[];
  /** Wild ids an evolve would consume right now (empty unless `ready`). */
  consume: string[];
  ready: boolean;
}

/** Wilds that can never be fodder: anything placed in a squad. */
export function squadWildIds(state: AccountState): Set<string> {
  const ids = new Set<string>();
  for (const squad of Object.values(state.squads)) for (const id of squad) if (id) ids.add(id);
  return ids;
}

export function evolutionView(
  state: AccountState,
  speciesOf: (speciesId: string) => EvolutionSpecies | undefined,
  instanceId: string,
): EvolutionView | null {
  const wild = state.roster.find((w) => w.id === instanceId);
  const species = wild ? speciesOf(wild.speciesId) : undefined;
  if (!wild || !species) return null;
  const card = starCardFor(species.stars, wild.stars);
  const top = starRange(species.stars).max;
  const next = wild.stars < top ? starCardFor(species.stars, wild.stars + 1) : null;
  if (!next) return { card, next: null, blocked: 'max_star', requirements: [], consume: [], ready: false };
  // 18★ → 19★ and the Origins' middle stars need Awakening / the Origin system (not built yet).
  if (!card.fodder || card.fodderItems) {
    return { card, next, blocked: 'awakening', requirements: [], consume: [], ready: false };
  }
  const candidates = state.roster.flatMap((instance) => {
    const meta = speciesOf(instance.speciesId);
    return meta ? [{ instance, faction: meta.faction }] : [];
  });
  const plan = planFodder(wild, card, candidates, squadWildIds(state));
  const requirements = card.fodder.map((req) => {
    const short = plan.missing.find((m) => m.own === req.own && m.star === req.star && m.faction === req.faction);
    return { ...req, have: req.count - (short?.count ?? 0) };
  });
  const ready = plan.missing.length === 0;
  return { card, next, blocked: null, requirements, consume: ready ? plan.consume : [], ready };
}
