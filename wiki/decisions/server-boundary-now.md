---
title: Local server boundary now, real backend later
type: decision
date: 2026-10-31
status: active
sources: [opencode-session-2026-10 msgs 96-97]
---

# Local server boundary now, real backend later (2026-10-31)

Owner asked: *"so could all the server stuff be done after we make the game?"*

| Layer | Wait? | Why |
|---|---|---|
| Remote backend (Fastify + SQLite, auth, shared saves, deploy) | **Yes — M19** | Client already talks to the `GameServer` interface; `HttpServer` drops in later. |
| LocalServer mode actions + views | **No** | It's the save/reward boundary; skipping it would duplicate rules in the client and make the M19 swap harder. |
| Server unit tests | Can be batched at the end of a sub-milestone | Still required before "done". |

Owner: *"ah ok lets work on all of m13.3 then."*

Related: [architecture](../project/architecture.md), [backend](../systems/backend.md).
