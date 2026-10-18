# Procedural creature art

M2 system note. Read before editing `packages/client/src/art` or the Gallery screen.

## Goal

Every Wild's portrait is generated at render time from data (PROMPT §9.4): a seeded SVG generator
with body templates per faction, colour palettes, eyes, limbs, markings, evolution-stage scaling and
quality-tier auras. No image files ship (the IP-guard suite forbids binary media under `packages/`);
the same seed always yields the same creature.

## Determinism

The generator uses the engine's `mulberry32` PRNG seeded by `species.paletteSeed` (mixing the stage
into the seed so each evolution form differs but is stable). It never calls `Math.random`. Rendering
is a pure function of `(species, stage)`.

## Shape

`packages/client/src/art/`:

- `palette.ts` — `paletteFor(faction, seed)` → a deterministic colour set; a faction base hue is
  jittered and lightened from the seed (body, belly, accent, eye, outline).
- `creature.ts` — `buildCreature(species, stage)` → a plain data description (`CreatureShape`): body
  ellipse radii, head radius/offset, eye style, leg/tail/horn/fin counts and sizes, spot count, and
  the palette. Pure and deterministic.
- `WildPortrait.tsx` — a React component that lays out the `CreatureShape` as inline `<svg>` (body,
  belly, legs, tail, fins, horns, spots, eyes).

Evolution stage drives growth: higher stages are larger and add features (legs, tail, horns, fins,
back spikes, more markings), so a Wild's forms are visibly distinct but each form is stable. The
generator does not use `Math.random`; the seed is `paletteSeed` mixed with the stage.

The M2 generator is intentionally simple (one shared creature silhouette with seeded variation) —
per-faction body templates and quality-tier auras (`--tier-*`) are a planned refinement, not shipped
yet.

## Gallery

`packages/client/src/pages/Gallery.tsx`, route `/gallery`, linked from Home. For every faction it
lists its species; each species shows a row of its evolution stages — the procedurally-drawn portrait
at each stage plus the stage's name and the stats/Power computed with the engine growth functions at
that stage's level cap. That is the M2 done criterion: every Wild at every stage, and art is a pure
function of the seed.

## Image sprites (hybrid, planned)

The IP guard exempts `packages/client/public/art/` from its binary-media ban (owner decision
2026-10-17, `docs/ASSUMPTIONS.md`), so 2D sprite image files may be added there — and nowhere else under
`packages/`. The planned pipeline (built in the visual-identity pass, after M10) is: a data manifest
mapping `speciesId` + stage to an art file, a `spriteFor(id, stage)` resolver, and a `WildPortrait` that
renders the image when one exists and otherwise falls back to the procedural SVG above. No image ships
until a file is added, and the SVG path is never removed.

## Accessibility

Each portrait is `role="img"` with an `aria-label` of the Wild and stage name; the gallery is
keyboard navigable and respects reduced motion (no idle animation under
`prefers-reduced-motion`).
