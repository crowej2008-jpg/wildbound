# Content authoring guide

How to add content to Wildbound. This file is completed as the systems land.
See `packages/content/src/index.ts` for the data-dir registry, the `*.ts` loaders
(`species.ts`, `kits.ts`, `tuning.ts`) for the validated exports the client reads, and
`packages/cli/src/validate-content.ts` for the validator that guards it.

| Topic | Milestone | Where |
|---|---|---|
| Add a Wild | M2 | `packages/content/species/*.json` |
| Add a kit | M2 | `packages/content/kits/*.json` (DSL in PROMPT §6.7) |
| Add an item | M7 | `packages/content/items/*.json` |
| Add a stage | M5 | `packages/content/stages/*.json` |
| Tune an economy/growth curve | M3/M5 | `packages/content/tuning/*.json` |

## Wilds and kits (M2)

- One file per faction: `species/<faction>.json` and `kits/<faction>.json`, each an **array of six**
  entries. Files may also hold a single object (the M1 form) — the loader accepts both.
- A Wild (`speciesSchema`) has `id`, `name`, `faction`, `class`, `tier`, `description`,
  `paletteSeed`, `stages` (1–3 display names, index = stage), and `base` (the six core stats).
- A kit (`kitSchema`) must share the Wild's `id`/`faction`/`class`/`tier`; `content:validate`
  cross-references the two and fails on any mismatch, duplicate id, or faction that lacks six Wilds.
- Stats are **not** authored per level: the engine derives them with the multiplicative formula in
  `docs/design/wilds.md` from `base` + `packages/content/tuning/growth.json`.
- Portraits are procedural: `paletteSeed` + stage seed the SVG in `packages/client/src/art/`. No
  binary media may be added under `packages/` (IP guard).

## Tuning files (identified by filename)

| File | Schema | Holds |
|---|---|---|
| `tuning/combat.json` | `combatSettingsSchema` | every combat constant (Appendix A) |
| `tuning/growth.json` | `growthSchema` | level caps, level/star steps, evolution/quality multipliers |
| `tuning/power.json` | `powerSchema` | Power core weights, percent rows, percent scale |

## Quality bar (content)

- Every piece of authored text is original and passes `pnpm content:validate`.
- Every Wild has a complete kit (normal + basic + ult + ≥1 talent).
- Every rule a number implies is covered by a unit test or referenced by a named setting.
