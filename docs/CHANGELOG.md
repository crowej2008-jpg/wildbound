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
