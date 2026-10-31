---
title: Architecture
type: project
updated: 2026-10-31
sources: [AGENTS.md, README.md, opencode-session-2026-10 (msg 34 "how was the engine designed")]
---

# Architecture

```
content (JSON + zod)  ──►  cli (kit-loader adapter, validator, pnpm sim)
                                 │
engine (pure mechanics)  ◄───────┘   content DSL → engine KitDef
   ▲
server (GameServer boundary: LocalServer now, HttpServer in M19)  ──►  client (React, mobile-first)
```

| Package | Role | Hard rules |
|---|---|---|
| `packages/engine` | Combat, growth, economy, time, rewards, every mode's state machine | Zero runtime deps. No `Math.random`/`Date.now`/`new Date()`; seeded `mulberry32` RNG and injected clock. Never parses JSON. |
| `packages/content` | Species, kits, items, stages, tuning tables + zod schemas | All tunables live here. Pokémon names allowed **only** here. |
| `packages/server` | `GameServer` interface; `LocalServer` (browser, IndexedDB saves); per-mode `*.ts` actions + `*-view.ts` | Owns saves, rewards and validation. See [save versions](../systems/save-versions.md). |
| `packages/client` | React screens | No game rules in the client. |
| `packages/cli` | `pnpm sim`, `golden-export`, `content:validate`, IP guard | `kit-loader.ts` is the single DSL → engine adapter. |

## Why the "server" exists already
Every mode needs LocalServer actions + a view now; only the networked backend waits for
[M19](../systems/backend.md). Owner asked on 2026-10-31 whether server work could wait — answer:
the remote backend yes, the local boundary no ([decision](../decisions/server-boundary-now.md)).

## Patterns every new mode follows
1. `docs/design/<mode>.md` first.
2. Content JSON (often generated once by `scripts/generate-*.mjs` and committed — the runtime never generates).
3. Engine module under `packages/engine/src/<mode>/` with unit tests.
4. `server/src/<mode>.ts` + `<mode>-view.ts`; save version bump + migration test.
5. Client route under `/explore/<mode>`; Explore card flips from planned to live.
6. e2e spec; `pnpm check`; docs (SCOPE, ASSUMPTIONS, CHANGELOG); commit + push.

Related: [combat engine](../systems/combat-engine.md), [dev environment](dev-environment.md).
