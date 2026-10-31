# AGENTS.md

This file is the working agreement between the human owner and OpenCode for the Wildbound project.
Read `PROMPT.md` first. At the start of **every** session, read `wiki/index.md` (then the pages it
points to for the work at hand), `docs/SCOPE.md` and `docs/ASSUMPTIONS.md` before writing or editing
any code. The wiki is the project's memory across sessions and tools — see "Project wiki" below.

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
  there. **Copy the source exactly (owner decision 2026-10-31):** every system that exists in the
  source game is copied exactly from `reference/game-rebuild/` — its rules, numbers, tables, rows,
  names and text. Only the owner's brand-new features and his explicitly recorded changes differ
  (see `wiki/decisions/copy-the-source-exactly.md`); when unsure whether something is a deliberate
  change, ask. No network calls except loading the app's own
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
node scripts/source/index-tables.mjs   rebuild docs/SOURCE-TABLES.md from reference/ (owner's PC)
```

CI runs `pnpm check` on every push (`.github/workflows/check.yml`, results in the Actions tab).

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
- **M11 Growth and collection layers II** — Potential, Orbs, Soul-hearts, Plates, Trinkets, Held
  Items, Resonance, Berries, VIP/privileges, titles.
- **M12 Ancient Artifacts and Suppression** — the artifact collection, Relic Tablets/materials,
  Suppression, Ruins Adventure.
- **M13 Explore modes** — Hoopa's Vault, Rift Arena, Gods Trials, Sky Pillar, Faction Tower, Misty
  Woods, Pet Home, Island Challenge, Ultra Wormhole.
- **M14 Combat and co-op modes** — Victory Road + King's Trial, Paradise, Joint Team + Dynamax/Wild
  Area, Clash of Isles, Shovel Carnival.
- **M15 Guild, merge and events (simulated)** — guild, merge, the event calendar, shop restocks; no
  dead buttons.
- **M16 Guild war and Relic Battlefield** — the guild stronghold war and its seasons.
- **M17 Cross-server PvP** — Cross-Server Clash, Championship, SPT Temple (bot-driven).
- **M18 Visual-identity pass** — 2D sprites, source-accurate UI palette, battle effects.
- **M19 Hardening and backend (the shared service — required)** — a11y/perf/saves/docs, Fastify +
  SQLite `HttpServer`, deployment guide.
- **M20 Build Lab** — full tool, Rules panel, kit editor, sweeps with CIs, CLI parity (last milestone).

## Reference material

`reference/game-rebuild/` is a read-only copy of the owner's research wiki and repo. `reference/sim/`
is reserved for the Python battle simulator (`battle_sim.py`, `kits.py`, and tests). See PROMPT.md
section 3 for the read order and per-system mapping.

## Project wiki (`wiki/`)

`wiki/` is an LLM-maintained knowledge base of this project: owner decisions (with dates and his
words), how each system works, milestone status, open questions and the owner's unscheduled ideas.
Agents write it; the owner reads it (it opens as an Obsidian vault). It **links to** `docs/` rather
than copying it — `docs/SCOPE.md`, `ASSUMPTIONS.md` and `CHANGELOG.md` stay the detailed records.

Layout: `index.md` (catalog — read first), `log.md` (append-only), `open-questions.md`, `overview.md`,
`project/`, `decisions/`, `systems/`, `milestones/`, `ideas/`, `sources/`. Every page has YAML
frontmatter (`title`, `type`, `updated`, `sources`, plus `status`/`milestone`/`date` where useful) and
uses relative markdown links.

Workflows:

- **Session start:** read `wiki/index.md`, `wiki/project/owner-rules.md` and `wiki/open-questions.md`.
- **Owner makes a decision:** add or update a page in `decisions/` (date, his words, what changes),
  update the affected `systems/` pages, and remove it from `open-questions.md` if it was there.
- **Sub-milestone done:** update the system page(s), `milestones/m<N>.md`, `milestones/history.md`
  (date, commit, test counts), `overview.md` "where things stand", `index.md` "Now" line and
  `systems/save-versions.md` if the save bumped. Commit the wiki with the milestone.
- **Ingest a source** (session export, spreadsheet, friend feedback, plan doc): summarise it in
  `sources/`, update every page it touches, append to `log.md`.
- **Query:** answer from the wiki first; file answers worth keeping as new pages and link them from
  `index.md`.
- **Lint** (when asked, or every few milestones): check pages against the code and `docs/`, flag
  contradictions and stale claims in `open-questions.md`, add missing cross-links.
- Every change appends a `log.md` entry: `## [YYYY-MM-DD] <ingest|query|lint|update> | <title>`.
- Facts only: write what the owner said or what the repo shows; mark the agent's own recommendations
  as such. Keep pages short (aim under 120 lines).
