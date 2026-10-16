# Wildbound

A mobile-first web game: collect original Wilds, grow them, assemble a squad of six, and watch
automatic, deterministic turn-based battles. A rebuild of the design documented in
`reference/game-rebuild/` (screens, systems, economy shape, measured combat model) with entirely
original content.

- Start here: [`PROMPT.md`](./PROMPT.md) (the master specification) and [`AGENTS.md`](./AGENTS.md)
  (working agreement + commands).
- Progress and the milestone map: [`docs/SCOPE.md`](./docs/SCOPE.md). Current milestone: M6
  (summoning and shops).
- Open questions: [`docs/ASSUMPTIONS.md`](./docs/ASSUMPTIONS.md).

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
packages/server   GameServer boundary (LocalServer now, HttpServer later)
packages/client   React app (mobile-first)
packages/cli      pnpm sim, golden-export, content:validate
tests/            ip-guard, e2e
reference/        read-only research (gitignored)
```

Current milestone: **M5 — Campaign, idle and daily loop**.
