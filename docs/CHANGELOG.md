# Changelog

Every milestone appends a note here. Bugs found in the reference and worked around in the engine
are recorded here with the difference (never edit `reference/`).

## M0 — Foundations (2026-10-09)

- Scaffolded the pnpm workspace: packages engine / content / server / client / cli, plus tests/.
- Deterministic PRNG (`mulberry32`) with tests — the foundation rule for the whole engine.
- `GameServer` boundary type (typed `Result` + `ServerError`), tests included.
- Hello-world React client: Home screen, five-tab bottom nav, i18n scaffold (`t()`), design tokens,
  light/dark + reduced-motion support; out-of-scope tabs show an honest "coming later" state.
- IP guard test (Appendix C) + shared guard implementation in the CLI; wired into
  `pnpm content:validate` and the `pnpm check` gate.
- Playwright e2e (boot + coming-later states) over mobile and desktop viewports.
- Docs: SCOPE, ASSUMPTIONS, RULES, CONTENT, CHANGELOG, design/ index.
- `reference/` mirror of the research repo (36.6 MB, text only) placed read-only and gitignored.

### Deviation from the reference

- None yet. **Note:** `reference/sim/` is missing (the Python battle simulator files were not
  found anywhere on the machine); M1 proceeds from the documented formulas until the owner supplies
  them — see docs/ASSUMPTIONS.md.