# AGENTS.md

This file is the working agreement between the human owner and OpenCode for the Wildbound project.
Read `PROMPT.md` first. At the start of **every** session, read `docs/SCOPE.md` and
`docs/ASSUMPTIONS.md` before writing or editing any code.

## Mission

Build Wildbound, a complete, playable, mobile-first web game: collect original creatures, grow them,
assemble a team of six, and watch automatic turn-based battles. It is a rebuild of the design
documented in `reference/game-rebuild/` (screens, systems, economy shape, and the measured combat
model), **not** a copy of that game's content. The owner's main goal is the Build Lab tool.

Architecture required by the master prompt:

- Headless, deterministic game engine in TypeScript (combat, growth, economy, time, rewards).
- Web client in React with every screen in section 8 of PROMPT.md.
- A `GameServer` boundary: local in-browser implementation first, real backend later (drop-in).
- Build Lab tool (screen + `pnpm sim` CLI) for testing builds and new creatures.
- About 36 original creatures plus skills, items, stages, tuning tables, and procedural art.

## Non-negotiable rules (from PROMPT.md section 2)

- **Originality / IP.** All creatures, art, sprites, sounds and UI text are original and procedural,
  and no franchise names, logos or text from any other game may ship. **Owner override (2026-10-15):**
  this private, never-distributed build uses the owner's own Pokémon-themed roster (collected in
  `reference/`), so Pokémon species and skill names are permitted in `packages/content` — and only
  there. Do not copy rows/ids/names/tables from `reference/game-rebuild/data/` into shipped content —
  use those dumps only for formula shapes and curves. No network calls except loading the app's own
  files; no analytics, ads, or trackers. The IP guard test in `tests/ip-guard/ip-guard.test.ts` stays
  green for the remaining franchise terms. **Art allowance (2026-10-17):** the guard's binary-media
  check exempts `packages/client/public/art/` only — 2D sprite image files may live there; every other
  image/audio/font file under `packages/` is still refused and all other art/audio stays procedural
  (docs/ASSUMPTIONS.md).
- **Engineering.** TypeScript strict mode everywhere; no uncommented `any`. `packages/engine` is pure
  and deterministic: no `Math.random`, `Date.now`, or `new Date()`; randomness comes from an injected
  seeded PRNG (mulberry32), time from an injected clock. Everything tunable is data in
  `packages/content`, never code. Every rule you implement needs a unit test. Uncertain rules go in
  `docs/ASSUMPTIONS.md` and, if they affect combat, are named settings in
  `packages/content/tuning/combat.json`. No TODO stubs in shipped screens — out-of-scope features
  show an honest "coming later" state and are listed in `docs/SCOPE.md`. Commit after every passing
  step; never commit failing tests.
- **Process.** One milestone at a time (see below); run all checks, report, and stop. Read the named
  reference files first, then write `docs/design/<system>.md` before coding each system. Only ask the
  human for taste decisions (names, art direction), once at the end of a milestone.
- If a reference doc conflicts with another, prefer the later-dated or audited statement and note the
  conflict in `docs/ASSUMPTIONS.md`.
- If you find a bug in `reference/sim`, do not edit the reference; copy the fixed logic into the
  engine and document the difference in `docs/CHANGELOG.md`.
- Keep files small and focused (aim under 300 lines); extract helpers rather than growing files.
- Never delete tests to get green. Never weaken a threshold without recording why.

## Commands (must always work from the repo root)

```
pnpm install          install all workspace dependencies
pnpm dev              run the client dev server
pnpm build            typecheck-agnostic build of all packages (client -> static site)
pnpm test             Vitest unit suite across all packages
pnpm lint             ESLint (flat config) across the repo
pnpm typecheck        tsc --noEmit across all packages
pnpm e2e              Playwright end-to-end suite (builds + previews the client)
pnpm sim -- <args>    CLI combat simulator (delivered M1)
pnpm content:validate content schema / reference / IP-guard validation
pnpm check            full gate: lint + typecheck + test + content:validate + build + e2e
```

`pnpm check` must pass before any milestone is declared done.

## Milestones (execute strictly in order; stop after each)

- **M0 Foundations** — workspace, tooling, folder layout, this file, docs, IP guard, `pnpm check`, hello-world client.
- **M1 Combat engine** — simulator port, event log, DSL, tests, golden parity, `pnpm sim`.
- **M2 Content core** — species schema, 36 Wilds, kits, stat formula, Power, growth tuning, content validator, procedural creature gallery.
- **M3 Account, roster, growth, squads** — LocalServer, saves, level/star/evolve, squad editor, Wild screen, HUD.
- **M4 Battle UI** — battle screen replay from event log, effects, speed, results.
- **M5 Campaign, idle and daily loop** — chapters, auto-battle, idle income, quests, mail, clock, tutorial.
- **M6 Summoning and shops** — machines, pity, wish, history, shops with restock + currencies.
- **M7 Equipment layers** — Relics, Runes, Charms, Spirit Cores, Talents, screens, battle impact.
- **M8 Trials, Tower, World Boss, Link Crystal** — all PvE modes + endgame growth.
- **M9 Skill kits** — expand the combat DSL with the primitives the imported kits need, then port all 84 creatures' kits faithfully from the owner's skills sheet; re-tune balance.
- **M10 PvP** — Arena, ghosts/bots, weekly settlement via Mail, ranked ladder with weather.
- **M11 Social and events (simulated)** — guild, events, settings, help; no dead buttons.
- **M12 Hardening and (optional) backend** — accessibility/perf/saves/docs, optional Fastify+SQLite HttpServer, deployment guide.
- **M13 Build Lab** — full tool, Rules panel, kit editor, sweeps with CIs, CLI parity (last milestone).

## Reference material

`reference/game-rebuild/` is a read-only copy of the owner's research wiki and repo. `reference/sim/`
is reserved for the Python battle simulator (`battle_sim.py`, `kits.py`, and tests). See PROMPT.md
section 3 for the read order and per-system mapping.