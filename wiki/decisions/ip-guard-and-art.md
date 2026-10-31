---
title: IP guard and art allowance
type: decision
date: 2026-10-17
status: active
sources: [docs/ASSUMPTIONS.md "Art media allowance", opencode-session-2026-10 msgs 53-60]
---

# IP guard and art allowance (2026-10-17)

**Decision:** option **B** — keep the guard, but allow raster images in
`packages/client/public/art/` only.

The guard (`packages/cli/src/ipguard.ts`, run by tests and `content:validate`) now does two things:
1. Blocks four non-Pokémon franchise terms in shipped code: `nintendo`, `game freak`, `digimon`, `yokai`.
2. Refuses binary media (png/jpg/mp3/ttf…) anywhere under `packages/` **except**
   `packages/client/public/art/` (path traversal like `art/../src/x.png` is still refused).

## Context
- Owner asked "can you get rid of the ip guard"; options A–D were offered; he chose B.
- The agent said it can't *draw* recognisable Pokémon sprites (derivative art, and it only writes
  SVG code). Real sprites must be supplied by the owner and dropped into `public/art/`.
- UI style and battle effects can match the source closely (style isn't protected); logos and
  painted franchise art can't.
- Owner chose **"rename them"** for Ranked regions → Kanto…Galar (allowed in content only).
- Visual reference screenshots were copied to `reference/visual/` (gitignored, never pushed).

Related: [visual identity](../systems/visual-identity.md), [roster override](pokemon-roster-override.md).
