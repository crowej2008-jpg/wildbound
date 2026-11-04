---
title: Pet Home
type: system
milestone: M13.1
status: built
updated: 2026-11-04
sources: [docs/design/pet-home.md, docs/ASSUMPTIONS.md M13 #44-45, docs/CHANGELOG.md M13.1]
---

# Pet Home (M13.1) — gate: clear 1-10

**A merge board, not resident placement.** The agent first planned habitats/decorations; owner said
"look at the source for pet home" → replaced with the source's merge game.

- 5×5 board: **21 playable tiles** + 4 inert corners; padlocks cost the current Home level's price.
- **17 Home levels**; merge cap 8 → 16; +10 Home XP per open and per merge; one-time level rewards.
- **50 free summons/day**, then paid brackets 10/30/100/200/500 (after 0/100/200/300/400 paid; R9 source).
- Income: Home Coin 2^level per 5 s (2 → 65,536, source `_petShowCfg`); settled lazily in **5-minute ticks**,
  **8-hour** offline cap.
- Level rewards (R9 source): 20 Gems at Lv 1–2, then 1–2 Rare Orb Chests (one +1 orb, colour by weight).
- Two shops, nine offers per page; **every row sells one orb at a fixed level** (R9 source, 61.5 M–1 B Home Coins
  or 5,250–144,000 Orb Essence); bands overlap by Home level and pool: **Home Exchange** (Home Coins) and **Orb Atelier** (Orb Essence,
  opens Home Lv10). Shared 30/day refresh counter: 40 gems for 1–10, 80 for 11–30.
- 84-entry album. Paid assistant removed.
- Data: `tuning/pet-home.json` (17 levels, 21 tiles, 16 income rows, 132 shop rows), numbers from
  `scripts/import-pet-home.mjs` (R9, ASSUMPTIONS #89). Save v16.
- Route: `/explore/pet-home`.
