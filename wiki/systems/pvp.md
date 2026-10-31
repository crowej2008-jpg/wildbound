---
title: PvP — Arena and Ranked
type: system
milestone: M10
status: built
updated: 2026-10-31
sources: [docs/design/pvp.md, docs/ASSUMPTIONS.md M10, opencode-session-2026-10 msgs 51, 59-66]
---

# PvP — Arena and Ranked (M10)

All opponents are **deterministic ghosts/bots** until the [backend](backend.md) exists.

## Arena (`/arena`, `/arena/rankings`)
- 5 free challenges/day + bought (price ladder); 3 opponents (easy/mid/hard); credits up on win, down
  on loss; 8 bands; daily participation chests (first 10 battles); best-rank achievements.
- **Weekly settlement Monday via "Arena Rewards" mail**, then credits reset by band — computed lazily in
  `normalize` (no cron).
- Refresh is **free and unbounded** (no source data) — flagged, see [open questions](../open-questions.md).

## Ranked (`/ranked`)
- 8 regions × 12 tiers. Regions: **Kanto → Johto → Hoenn → Sinnoh → Unova → Kalos → Alola → Galar**
  (owner: "rename them"). Tiers: Vanguard I–III · Elite I–III · Commander I–III · Legend · Overlord · King.
- `+35 / −20` scoring with the threshold stop and a promotion match; best-of-3; 6 free attempts/day;
  season Mon 03:00 → Sun 22:00 UTC; per-season **faction weather +30%**; region advances each season.
- Parity check: 42 straight wins reach 1,310 (Overlord), matching the 2026-10-04 audit.

## Balance (M10.6)
Ghost pools are **tier-banded**: Arena rare+epic (base Lv6, slope 1.24); Ranked rare+legendary+epic
(base Lv12, slope 1.18). Supreme/mythic reserved for M17. Pinned by `pvp-balance.test.ts`.
Known limit: static ghosts → a squad past the top rung clears everything (fix = M19 matchmaking).

## Nav
The source has six tabs (Home · Explore · Pokémon · Combat · Trainer · Bag) and reaches PvP from the
Explore map. Our label is **"Wilds"**, never the franchise roster name. PvP hub `/pvp`; Championship card
is a "coming later" stub (M17).
