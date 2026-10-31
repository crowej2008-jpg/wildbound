import { mulberry32 } from '@wildbound/engine';
import type { Faction } from '@wildbound/engine';
import { paletteFor, type Palette } from './palette';

/** A deterministic, render-agnostic description of one creature stage. */
export interface CreatureShape {
  palette: Palette;
  /** Body ellipse radii in a 120×120 viewBox. */
  body: { rx: number; ry: number };
  /** Head circle: radius + vertical offset from body centre. */
  head: { r: number; offsetY: number };
  eye: { r: number; dx: number; dy: number; style: 'round' | 'slit' | 'sleepy' | 'wide' };
  legs: { count: number; length: number };
  tail: { length: number; curve: number };
  horns: { count: number; length: number };
  spikes: number;
  fins: { count: number; size: number };
  spots: { count: number; radius: number };
  stage: number;
}

export interface SpeciesLike {
  id: string;
  faction: Faction;
  paletteSeed: number;
  /** The star ladder; each distinct card name is one visible form (R1). */
  stars: { name: string }[];
}

/** How many distinct forms a species shows along its star ladder. */
export function formCount(species: SpeciesLike): number {
  let count = 0;
  let last = '';
  for (const card of species.stars) {
    if (card.name !== last) count += 1;
    last = card.name;
  }
  return Math.max(1, count);
}

const EYE_STYLES = ['round', 'slit', 'sleepy', 'wide'] as const;

function pick<T>(rng: () => number, arr: readonly T[]): T {
  const value = arr[Math.floor(rng() * arr.length)] ?? arr[0];
  return value as T;
}

/**
 * Build a deterministic creature shape from a species and evolution stage
 * (0-based). No `Math.random`: the seed is `paletteSeed` mixed with the stage,
 * so a Wild always renders identically (docs/design/art.md). Higher stages add
 * limbs, horns, fins and markings so evolution is visible.
 */
export function buildCreature(species: SpeciesLike, stage: number): CreatureShape {
  const clamped = Math.min(Math.max(0, stage), Math.min(2, formCount(species) - 1));
  const seed = (species.paletteSeed * 31 + clamped * 101) >>> 0;
  const rng = mulberry32(seed);
  const palette = paletteFor(species.faction, species.paletteSeed);

  const growth = 1 + clamped * 0.18;
  const bodyRx = (26 + rng() * 6) * growth;
  const bodyRy = (22 + rng() * 5) * growth;
  const headR = (16 + rng() * 4) * (1 + clamped * 0.1);

  const legCount = clamped === 0 ? pick(rng, [2, 4]) : pick(rng, [4, 4, 6]);
  const hornCount = clamped >= 1 ? pick(rng, [0, 2, 2, 3]) : 0;
  const finCount = clamped >= 2 ? pick(rng, [2, 3, 4]) : 0;

  return {
    palette,
    body: { rx: bodyRx, ry: bodyRy },
    head: { r: headR, offsetY: -(bodyRy + headR * 0.6) },
    eye: {
      r: 2.6 + rng() * 1.2,
      dx: headR * 0.42,
      dy: -headR * 0.1,
      style: pick(rng, EYE_STYLES),
    },
    legs: { count: legCount, length: (10 + rng() * 5) * growth },
    tail: { length: clamped >= 1 ? 14 + rng() * 18 : 8 + rng() * 6, curve: (rng() - 0.5) * 22 },
    horns: { count: hornCount, length: 8 + rng() * 8 },
    spikes: clamped >= 2 ? Math.floor(rng() * 3) + 2 : 0,
    fins: { count: finCount, size: 6 + rng() * 5 },
    spots: { count: Math.floor(rng() * 4) + (clamped >= 1 ? 2 : 1), radius: 2.4 + rng() * 2 },
    stage: clamped,
  };
}
