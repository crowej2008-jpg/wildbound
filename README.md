# Wildbound

A mobile-first web game: collect Wilds, grow them, assemble a squad of six, and watch automatic,
deterministic turn-based battles. A rebuild of the design documented in `reference/game-rebuild/`
(screens, systems, economy shape, measured combat model). The roster is the owner's own 84 Pokémon
from his wiki (private, invite-only build — see `docs/ASSUMPTIONS.md` › Owner content override).
Free to play: no real-money purchases.

- **Start here:** [`wiki/index.md`](./wiki/index.md) — the project wiki: owner decisions, how each
  system works, milestone status and open questions. It opens as an Obsidian vault.
- The master specification is [`PROMPT.md`](./PROMPT.md); the working agreement and commands are in
  [`AGENTS.md`](./AGENTS.md).
- Status table: [`docs/SCOPE.md`](./docs/SCOPE.md). Rule decisions:
  [`docs/ASSUMPTIONS.md`](./docs/ASSUMPTIONS.md). Per-step changes: [`docs/CHANGELOG.md`](./docs/CHANGELOG.md).

## Status (2026-10-31)

- **Built:** M0–M11 (engine, roster and skill kits, campaign, summoning, shops, PvE modes, PvP,
  collection layers), M13.0a (182×10 campaign), M13.0b (Explore hub), M13.1 Pet Home, M13.2 Sky Pillar.
  Save v17; 510 unit tests and 90 e2e tests green.
- **Current milestone:** **M13 — Explore modes**. Next step: **M13.3 Hoopa's Vault** (not started).
- **Deferred:** M12 (artifacts) and Gods Trials. Full plan: [`wiki/milestones/roadmap.md`](./wiki/milestones/roadmap.md).

## Quick start

```bash
pnpm install     # also downloads the Playwright Chromium build once
pnpm dev         # client dev server on http://localhost:5173
pnpm check       # lint + typecheck + unit + content:validate + build + e2e
```

## Layout

```
packages/engine   pure, deterministic TypeScript (no DOM, no Date, no Math.random)
packages/content  authored data + zod schemas + tuning tables
packages/server   GameServer boundary (LocalServer now, HttpServer in M19)
packages/client   React app (mobile-first)
packages/cli      pnpm sim, golden-export, content:validate
scripts/          one-time content generators (campaign, Pet Home, Sky Pillar, roster, skills)
tests/            ip-guard, e2e
docs/             scope, assumptions, changelog, design notes
wiki/             project wiki (LLM-maintained; read wiki/index.md first)
reference/        read-only research (gitignored)
```
