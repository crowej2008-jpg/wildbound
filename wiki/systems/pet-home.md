---
title: Pet Home
type: system
milestone: M13.1
status: built
updated: 2026-10-31
sources: [docs/design/pet-home.md, docs/ASSUMPTIONS.md M13 #44-45, docs/CHANGELOG.md M13.1]
---

# Pet Home (M13.1) — gate: clear 1-10

**A merge board, not resident placement.** The agent first planned habitats/decorations; owner said
"look at the source for pet home" → replaced with the source's merge game.

- 5×5 board: **21 playable tiles** + 4 inert corners; padlocks cost the current Home level's price.
- **17 Home levels**; merge cap 8 → 16; +10 Home XP per open and per merge; one-time level rewards.
- **50 free summons/day**, then paid brackets 10/30/80/250/600.
- Income: authored 5-second rate, doubles per merge level; settled lazily in **5-minute ticks**,
  **8-hour** offline cap.
- Two shops, nine offers per page: **Home Exchange** (Home Coins) and **Orb Atelier** (Orb Essence,
  opens Home Lv10). Shared 30/day refresh counter: 40 gems for 1–10, 80 for 11–30.
- 84-entry album. Paid assistant removed.
- Data: `tuning/pet-home.json` (17 levels, 21 tiles, 16 income rows, 132 shop rows), via
  `scripts/generate-pet-home.mjs`. Save v16.
- Route: `/explore/pet-home`.
