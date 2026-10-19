import { mulberry32 } from '../rng';
import { generateEnemies } from '../pve/curve';
import type { GeneratedEnemy, ResolvedCurve } from '../pve/types';

/**
 * Deterministic ghost opponents (M10). A PvP rival is a generated squad drawn
 * from the mode's species pool, seeded by `(mode, seed, slot)` so the same save +
 * day + rank always meets the same opponents — the local "matchmaking" the World
 * Boss already uses. Pure; reuses the M8 curve generator. See docs/design/pvp.md.
 */

export type GhostMode = 'arena' | 'ranked';

/** FNV-1a over a short label, so a mode always mixes the same way. */
function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The seed the three Arena opponents share for a day + rank + reroll. */
export function arenaOpponentSeed(day: string, credits: number, reroll: number): number {
  return hashString(`${day}|${credits}|${reroll}`);
}

/** The per-slot seeds shown together in the Arena (stable until a win/loss/reroll). */
export function arenaOpponentSeeds(
  day: string,
  credits: number,
  reroll: number,
  count: number,
): number[] {
  const rng = mulberry32(arenaOpponentSeed(day, credits, reroll));
  const seeds: number[] = [];
  for (let i = 0; i < Math.max(0, count); i += 1) seeds.push(Math.floor(rng() * 0x100000000));
  return seeds;
}

/** The seed for one slot's squad. */
export function ghostSeed(mode: GhostMode, seed: number, slot: number): number {
  const mixed = hashString(mode) ^ Math.imul(seed >>> 0, 2654435761) ^ Math.imul(slot + 1, 3266489917);
  return mixed >>> 0;
}

/**
 * The seed a Ranked match's games share for a season + region + tier. The same
 * save + season + rung always meets the same rivals (a loss never rerolls them),
 * matching the ghost model the Arena and the World Boss use.
 */
export function rankedMatchSeed(season: string, phase: number, tier: number): number {
  return hashString(`${season}|${phase}|${tier}`);
}

/**
 * One deterministic ghost squad. `slot` picks the seed (so two opponents in the
 * same trio differ); `index` scales the curve (level/stars/stage) and defaults to
 * the slot, so a later slot is a touch stronger.
 */
export function ghostSquad(
  curve: ResolvedCurve,
  mode: GhostMode,
  seed: number,
  slot: number,
  index: number = slot,
): GeneratedEnemy[] {
  return generateEnemies(curve, index, ghostSeed(mode, seed, slot));
}
