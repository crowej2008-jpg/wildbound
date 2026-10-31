import { mulberry32 } from '@wildbound/engine';
import type { Faction } from '@wildbound/engine';

/** A deterministic colour set for one creature portrait. */
export interface Palette {
  body: string;
  belly: string;
  accent: string;
  eye: string;
  outline: string;
}

const FACTION_HUE: Record<Faction, number> = {
  water: 200,
  fire: 12,
  grass: 135,
  light: 48,
  dark: 270,
};

function hsl(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  return `hsl(${hue.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;
}

/**
 * Derive a palette from a faction and the species `paletteSeed`. Pure and
 * deterministic — the same species always renders the same colours, so the
 * gallery is stable across reloads (docs/design/art.md).
 */
export function paletteFor(faction: Faction, seed: number): Palette {
  const rng = mulberry32(seed);
  const baseHue = FACTION_HUE[faction] + (rng() - 0.5) * 20;
  const sat = 58 + rng() * 14;
  return {
    body: hsl(baseHue, sat, 52 + rng() * 6),
    belly: hsl(baseHue, sat - 22, 78),
    accent: hsl(baseHue + 165, 68, 55),
    eye: '#16181d',
    outline: hsl(baseHue, sat - 18, 26),
  };
}
