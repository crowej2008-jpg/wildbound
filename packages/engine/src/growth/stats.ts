import type { CoreStats } from '../model';
import type { StarCard } from './types';

/**
 * The source's naked stats (reference kb/pokemon-growth.md, "exact from the config"):
 *
 *   HP    = basic.hp  + level × growth.hp
 *   P.ATK = S.ATK = basic.atk + level × growth.atk
 *   P.DEF = level × growth.pDef,  S.DEF = floor(level × growth.sDef)
 *   SPD   = basic.spd
 *
 * plus, from 19★, extraBasic flat and extraGrowth per level (ASSUMPTIONS #50). The source also adds a
 * per-species milestone row (hero_upstage_attr_json) that is not in the dumps; it is 0 here until the
 * table is captured.
 */
export function resolveCoreStats(card: StarCard, level: number): CoreStats {
  const lv = Math.max(1, Math.floor(level));
  const hp = card.basic.hp + lv * card.growth.hp + (card.extraBasic?.hp ?? 0) + lv * (card.extraGrowth?.hp ?? 0);
  const atk =
    card.basic.atk + lv * card.growth.atk + (card.extraBasic?.atk ?? 0) + lv * (card.extraGrowth?.atk ?? 0);
  return {
    hp: Math.round(hp),
    pAtk: Math.round(atk),
    sAtk: Math.round(atk),
    spd: card.basic.spd,
    pDef: Math.round(lv * card.growth.pDef),
    sDef: Math.floor(lv * card.growth.sDef),
  };
}

/** The card for `star`, clamped into the ladder (lowest card below it, highest above). */
export function starCardFor(stars: StarCard[], star: number): StarCard {
  if (stars.length === 0) throw new Error('a species needs at least one star card');
  let pick = stars[0]!;
  for (const card of stars) if (card.star <= star) pick = card;
  return pick;
}

/** The species' first and last star. */
export function starRange(stars: StarCard[]): { min: number; max: number } {
  return { min: stars[0]?.star ?? 1, max: stars[stars.length - 1]?.star ?? 1 };
}

/** 0-based index of the form (distinct card name) shown at `star` — used for art and labels. */
export function formIndex(stars: StarCard[], star: number): number {
  const names: string[] = [];
  for (const card of stars) {
    if (card.star > star) break;
    if (names[names.length - 1] !== card.name) names.push(card.name);
  }
  return Math.max(0, names.length - 1);
}

/** Every distinct form name in ladder order. */
export function formNames(stars: StarCard[]): string[] {
  const names: string[] = [];
  for (const card of stars) if (names[names.length - 1] !== card.name) names.push(card.name);
  return names;
}
