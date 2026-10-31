---
title: Private group play and a required backend
type: decision
date: 2026-10-17
status: active
sources: [docs/ASSUMPTIONS.md "Owner content override" 9, docs/SCOPE.md, opencode-session-2026-10 msg 52]
---

# Private group play and a required backend (2026-10-17)

**Decision:** Wildbound will be shared with a **small, invite-only group** of trusted friends through
a shared online service. Therefore the M19 backend (Fastify + SQLite `HttpServer`) is **required**,
not optional.

- Amends the roster override: "never distributed" → "not publicly distributed".
- No public release, store listing, open sign-up, SEO or analytics.
- Minimal accounts (name + secret token, no PII); server-authoritative battles; settlement cron.
- Timing: the backend comes **after the game is made** — owner confirmed on 2026-10-31 that the real
  backend waits for M19 ([server boundary now](server-boundary-now.md)).

Related: [backend](../systems/backend.md), [free-to-play](free-to-play.md).
