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

## M1 — Combat engine (2026-10-10)

- `@wildbound/engine` combat module: `types`, `settings`, `stats`, `buffs`, `damage`, `targeting`,
  `sustain`, `counter`, `skills`, `battle` — pure and deterministic (no `Math.random`/`Date`), all
  randomness through the injected seeded PRNG (`mulberry32`).
- Battle loop (`runBattle`): big-rounds, SPD-ordered turns, mid-round wipe break, 15-round time-out
  to the defender, full `BattleEvent` log, and a result ledger (damage dealt/taken, healing).
- Kit DSL: zod schemas in `@wildbound/content` (`kitSchema`, `combatSettingsSchema`, …) and
  `content:validate` now parses every kit + tuning file against them.
- Damage pipeline: ATK/DEF + rate, crit (`critSlope × (crit − critRes)`, capped), block piecewise
  (`block − guardBreak`), PvP floors/constants, ult/skill lines, hp-share and DoT paths.
- Rage model: per-action gain, hit-based proportional rage on the defender, flat `rageHitBase` for
  direct hits, `rageOnHit` talents, and `rageCutChance` (attacker loses `rageMax/8`).
- Control suite: silence/confusion/paralysis/stun with Control Res, immunity windows (safeguard),
  confusion self-redirect, confined (untargetable) units.
- Talents/turn hooks: `tidewarden` guardian kit + `allyShelterStack` dmgRdct stacking.
- Tests — 58 engine tests: damage/rules/battle/statistical (20k-trial convergence)/property
  (fast-check). Golden regression: deterministic TS replay (`golden.test.ts`) over committed
  baselines for two scenarios.
- CLI: `pnpm sim <scenario.json>` (renders the event log) and `pnpm golden-export`
  (`pnpm sim:golden`) regenerate baselines.
- Content: `kits/tidewarden.json`, `kits/twigleaf.json`, `tuning/combat.json`.
- Lint/typecheck/test/content:validate green.

### Deviation from the reference

- **Golden parity is self-referential, not Python parity.** With `reference/sim/` absent (M0 note),
  the M1 "golden" lock is a deterministic TypeScript replay suite: `pnpm golden-export` writes event-
  log folds for the scenario fixtures and `golden.test.ts` replays them exactly. When the Python
  simulator arrives, add true cross-language parity scenarios without removing these.

## M2 — Content core (2026-10-11)

- **Schemas** (`@wildbound/content/src/schemas.ts`): `speciesSchema`, `growthSchema`, `powerSchema`,
  `coreStatsSchema` (+ type exports).
- **36 original Wilds** (6 per faction) in `packages/content/species/<faction>.json`: id, name,
  faction, class, tier, description, `paletteSeed`, 1–3 evolution stages, six base stats. Authored
  from a tier/class table with deterministic jitter — no reference rows copied.
- **36 skill kits** in `packages/content/kits/<faction>.json` (arrays of six), covering every
  required archetype: counter, guaranteed-freeze, stated-chance stun, healer, shield, lowest-HP,
  row-sweep, %max-HP, and immunity. The M1 `tidewarden` kit is preserved byte-identically.
- **Growth & Power tuning**: `packages/content/tuning/growth.json` (multiplicative stat formula
  factors) and `tuning/power.json` (Power core/percent weights + scale).
- **Engine growth module** (`@wildbound/engine/src/growth/`): `resolveCoreStats`, `levelCurve`,
  `starMult`, `evolutionMult`, `levelCap`, `computePower`, `teamPower` — pure, tuning injected.
- **Content loaders** (`@wildbound/content`): validated `WILDS`, `KITS`, `COMBAT_SETTINGS`,
  `GROWTH`, `POWER` exports; the client imports these at build time.
- **Validator** (`packages/cli/src/validate-content.ts`): per-dir schemas, per-filename tuning
  schema, duplicate-id detection, species↔kit cross-reference, faction coverage (6 each), array-aware
  empty-field scan. `kit-loader` now accepts single-object or array files.
- **Procedural gallery** (client): `src/art/{palette,creature,WildPortrait}`, `pages/Gallery.tsx`
  at `/gallery` (linked from Home); deterministic seeded SVG, no binary media. i18n label helpers for
  factions/classes/tiers. e2e extended (gallery renders ≥36 portraits; HUD now "Milestone 2").
- Tests — engine growth tests (stats + Power); 13 test files green. `pnpm check` green.

### Deviation from the reference

- **Multiplicative stat formula** (our design; the reference model is linear) — see docs/ASSUMPTIONS.md M2.
- **Power weights are our own fit** of the reference `attr_power_weight` shape.
