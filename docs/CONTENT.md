# Content authoring guide

How to add content to Wildbound. This file is completed as the systems land.
See `packages/content/src/index.ts` for the data-dir registry and `packages/cli/src/validate-content.ts`
for the validator that guards it.

| Topic | Milestone | Where |
|---|---|---|
| Add a Wild | M2 | `packages/content/species/*.json` |
| Add a kit | M2 | `packages/content/kits/*.json` (DSL in PROMPT §6.7) |
| Add an item | M7 | `packages/content/items/*.json` |
| Add a stage | M5 | `packages/content/stages/*.json` |
| Tune an economy/growth curve | M3/M5 | `packages/content/tuning/*.json` |

## Quality bar (content)

- Every piece of authored text is original and passes `pnpm content:validate`.
- Every Wild has a complete kit (normal + basic + ult + ≥1 talent).
- Every rule a number implies is covered by a unit test or referenced by a named setting.