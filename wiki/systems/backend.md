---
title: Shared backend
type: system
milestone: M19
status: pending (required)
updated: 2026-10-31
sources: [docs/SCOPE.md, docs/ASSUMPTIONS.md override #9, opencode-session-2026-10 msgs 52, 96]
---

# Shared backend (M19) — required

- `HttpServer implements GameServer` over **Fastify + SQLite**: server-side saves, minimal accounts
  (name + secret token, no PII), server-authoritative battles, shared ghosts/rankings, settlement
  cron (engine clock is injected, so the server passes real time), deployment guide.
- Hosting idea: one small VPS / Fly.io / Render with a SQLite volume; static client from the same
  process; unlisted, allow-listed, robots-disallowed.
- Fixes known local-only limits: static PvP ghosts ([PvP](pvp.md)), simulated guilds/alliances.
- Comes **after** the game is made ([decision](../decisions/server-boundary-now.md)).
- Needed for: co-op features like the [co-op boss tower idea](../ideas/coop-boss-tower.md) and real
  guild play (owner wants guild size 8).
