import type { Faction } from '../model';
import type { FodderReq, StarCard } from '../growth/types';
import type { ProgressTables, WildInstance } from './types';

/**
 * Pure cost/eligibility math for growth actions (docs/design/account.md, R1).
 * The engine computes; the server checks affordability and applies.
 */

/** Candy needed to go from `level` to `level + 1` (stand-in curve; matches the one known source point, Lv1→2 = 48). */
export function candyCost(level: number, tables: ProgressTables): number {
  return Math.round(tables.levelUp.candyBase * Math.pow(level, tables.levelUp.candyExponent));
}

export interface Cost {
  candy: number;
  gold: number;
}

/** Total candy+gold to climb from `from` to `to` (exclusive of `to`). */
export function levelUpCost(from: number, to: number, tables: ProgressTables): Cost {
  let candy = 0;
  for (let level = from; level < to; level++) candy += candyCost(level, tables);
  return { candy, gold: candy * tables.levelUp.goldPerCandy };
}

/** What the engine needs to know about a roster Wild to judge it as fodder. */
export interface FodderCandidate {
  instance: WildInstance;
  faction: Faction;
}

export interface FodderPlan {
  /** Instance ids to consume, in requirement order. */
  consume: string[];
  /** Requirements that could not be filled (empty when the plan is complete). */
  missing: FodderReq[];
}

/**
 * Pick fodder for evolving `target` with `card.fodder` (the source's evolution_item). Each line takes
 * `count` Wilds at exactly `star` — the same species (`own`) or any species of `faction`. Protected
 * ids (locked, in a squad, resonating, …) and the target are never taken; within a line the
 * lowest-level, then oldest, Wild goes first, so the choice is deterministic.
 */
export function planFodder(
  target: WildInstance,
  card: StarCard,
  candidates: FodderCandidate[],
  protectedIds: ReadonlySet<string>,
): FodderPlan {
  const used = new Set<string>([target.id]);
  const consume: string[] = [];
  const missing: FodderReq[] = [];
  for (const req of card.fodder ?? []) {
    const pool = candidates
      .filter(({ instance, faction }) => {
        if (used.has(instance.id) || protectedIds.has(instance.id) || instance.locked) return false;
        if (instance.stars !== req.star) return false;
        if (req.own) return instance.speciesId === target.speciesId;
        return req.faction === undefined || faction === req.faction;
      })
      .sort(
        (a, b) =>
          a.instance.level - b.instance.level ||
          a.instance.acquiredAt - b.instance.acquiredAt ||
          a.instance.id.localeCompare(b.instance.id),
      );
    const taken = pool.slice(0, req.count);
    for (const { instance } of taken) {
      used.add(instance.id);
      consume.push(instance.id);
    }
    if (taken.length < req.count) missing.push({ ...req, count: req.count - taken.length });
  }
  return { consume, missing };
}
