---
title: Wildbound overview
type: overview
updated: 2026-10-31
sources: [PROMPT.md, AGENTS.md, docs/SCOPE.md, opencode-session-2026-10]
---

# Wildbound overview

Wildbound is Jayden's mobile-first web game: collect creatures, grow them, field a squad of six and
watch automatic, deterministic turn-based battles. It rebuilds the *design* of a mobile Pokémon idle
game documented in the owner's research repo (`reference/game-rebuild/`), with the owner's own
84-creature Pokémon roster (see [Pokémon roster override](decisions/pokemon-roster-override.md)).

## Who it is for
- Jayden plus a small invite-only group of friends — never a public release
  ([private group + backend](decisions/private-group-and-backend.md)).
- Free to play: no real money anywhere ([free-to-play](decisions/free-to-play.md)).

## The owner's main goal
The **[Build Lab](systems/build-lab.md)** — a tool to test builds and new creatures with the combat
simulator. It is deliberately the **last** milestone (M20).

## Where things stand (2026-10-31)
- **Built:** M0–M11, M13.0a, M13.0b, M13.1 [Pet Home](systems/pet-home.md), M13.2
  [Sky Pillar](systems/sky-pillar.md). Last commit `27536b7`, save v17, 510 unit + 90 e2e tests green.
- **Next:** the [source retrofit](milestones/source-retrofit.md) — owner rule since 2026-10-31 is
  [copy the source exactly](decisions/copy-the-source-exactly.md). Then M13.3
  [Hoopa's Vault](systems/hoopa-vault.md).
- **Skipped/parked:** M12 artifacts ([decision](decisions/m12-artifacts-deferred.md)),
  [Gods Trials](systems/gods-trials.md).
- Full plan: [roadmap](milestones/roadmap.md).

## Architecture in one breath
pnpm monorepo: `engine` (pure deterministic TypeScript) → `content` (JSON + zod) → `server`
(`GameServer` boundary, `LocalServer` in the browser today) → `client` (React). See
[architecture](project/architecture.md).
