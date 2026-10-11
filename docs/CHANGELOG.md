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

## M3 — Account, roster, growth, squads (2026-10-11)

- **Engine roster module** (`@wildbound/engine/src/roster/`): `types` (WildInstance/AccountState/
  Squad/Currency/Strategy, front/back slots), `costs` (level/star/evolve cost + eligibility),
  `actions` (leveledUp/starredUp/evolved/respawn), `squad` (`autoFormation`), all pure and tuning-
  injected; unit tests for costs, actions and formation.
- **Content tuning**: `growth.json` gains a `progress` block (`levelUp`/`starUp`/`evolve`/`respawn`)
  and `tuning/account.json` (starting name, currencies, 6-Wild seed roster, debug grant amounts).
  `tuningSchema`/`accountSchema` added; validator now checks `account.json` and resolves its starting
  roster against the species set.
- **Server** (`@wildbound/server`): `GameServer` gains the M3 action set; `save.ts` (versioned codec +
  migrate + one-step backup), `storage.ts` (`SaveStore` + `MemoryStore` + `IndexedDbStore`),
  `config.ts` (`buildConfig` from content), `local-server.ts` (`LocalServer` with autosave and derived
  Power/team-Power snapshots). Server tests cover grant/level/evolve/squad/auto-formation/persistence/
  corrupt-recovery/export-import/reset.
- **Client**: `ServerProvider` context + global `Hud` (currencies with debug `+`, UTC clock, error
  banner); `Wilds` roster (filters, sort, team Power), `WildDetail` (Upgrade/Evolve tabs), `Squad`
  editor (modes, front/back, pick-and-assign, Auto Formation, strategy), `More` debug screen. Vite
  `base` corrected to `/` so deep routes (e.g. `/wilds/:id`) load assets on refresh.
- **e2e**: new `m3.spec.ts` (roster seeding, detail tabs, Auto Formation, debug grant persistence, level
  persistence across reload); `boot.spec.ts` updated to Milestone 3.
- Tests — 120 unit tests (17 files) + 12 Playwright tests green; `content:validate` PASS; `pnpm check`
  green.

### Deviation from the reference

- **Simplified progression**: one 1..`maxStars` star axis (gates evolution, multiplies stats) instead
  of the reference per-quality star cap; evolution ≤3 stages; generic `shard` star material instead of
  species-copy fodder. See docs/ASSUMPTIONS.md M3 and docs/design/account.md.
- **Simplified HUD**: no avatar/VIP/XP bar yet (arrives with the M5 loop).

## M4 — Battle UI, replay from the event log (2026-10-11)

- **Engine replay reducer** (`@wildbound/engine/src/combat/replay.ts`): `initReplay`/`stepReplay`/
  `replayTo` fold the immutable `BattleEvent[]` a battle already produced into per-frame visual state
  (HP/rage/shield/alive/round/winner/buff tags), plus `lastActor`/`lastTarget` highlights. Pure and
  content-free; 9 unit tests (immutability, prefix determinism).
- **Server battle setup** (`@wildbound/server/src/battle.ts`): `slotToPosition` (front slots 0–2 →
  positions 4–6, back 3–5 → 1–3), squad → `SpecInput[]` (growth stats + kit conversion identical to
  the CLI), and `startBattle(config, state, mode, seed?)` → `BattleView` (`{ seed, mode, winner,
  rounds, events, units, teams }`). Enemy is a mirrored "echo" of the player's squad so a fresh
  account can always fight; the seed is server-side randomness. `GameServer` gains `startBattle`;
  `LocalServer` implements it without mutating the save. 5 server tests (incl. same-seed determinism
  and fold-to-winner).
- **Client Battle screen** (`/combat`, `pages/Combat.tsx` + `components/BattleField.tsx` +
  `components/ResultPanel.tsx`): play/pause, 1×/2×/4× speed, single-step forward/back, restart,
  skip-to-end; 6v6 field with HP + rage bars, shield badge, buff chips, actor/target highlight, and
  floating damage/heal/crit/block/miss popups; round header; compact result panel (winner, rounds,
  seed, per-unit dealt/taken/healed) and an expandable battle-log drawer. `ServerProvider` exposes
  `startBattle`; the Combat tab is now live (was a "built in M4" placeholder); HUD reads "Milestone 4".
- **e2e**: new `m4.spec.ts` (replay to a result, restart replays identically, step + speed cycle, log
  availability); `boot.spec.ts` updated (Milestone 4; Summon is the remaining coming-later tab).
- Tests — 134 unit tests (19 files) + 18 Playwright tests green; `content:validate` PASS; `pnpm check`
  green.

### Deviation from the reference

- **The battle is generated once and replayed, never re-simulated per frame.** The client folds the
  server's `BattleEvent[]`; there is no per-frame randomness, so a recorded fight always replays
  identically (PROMPT §6.1).
- **Shield bars are approximate**: `hit.hpAfter` already nets shields and the engine does not log
  shield absorption, so the shield badge shows the last `shield` event's value (see ASSUMPTIONS M4).
- **Minimal vertical slice**: one campaign battle vs a mirrored echo squad; other modes, a real
  defender list, team preview and result-panel depth arrive with the campaign loop (M5) and later.
- **Squad strategies remain inert** (carried from M3); battle setup does not yet read them.
