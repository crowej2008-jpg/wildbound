# Dig Site (M13.9)

The owner's own mode, replacing the Ultra Wormhole (2026-11-04; `wiki/decisions/dig-site-replaces-ultra-wormhole.md`).
Tuning: `packages/content/tuning/dig-site.json` (hand-written; every number a stand-in). Gate: story 10-10 + trainer
level 50. Route: `/explore/dig-site`. No squad (no battles).

## Wall
- 13 × 10 cells, each 2–6 rock deep; 2–5 bedrock pieces (never dug); 2–4 items placed without overlap, each with a
  shape. Walls are free and unlimited; starting a new one leaves the old one (keeping what was free).
- Pick: −2 at the spot, −1 on the four sides, shake +3. Hammer: −2 at the spot, −2 on the sides, −1 on the corners,
  shake +6. At shake 100 the wall collapses. When every item is uncovered the wall ends by itself.
- The view shows an item or bedrock only on cleared cells, so nothing buried leaks.

## Finds (weights)
Soul hearts blue 28 (2 × 2), purple 17, orange 8, red 3 (3 × 3) — each a random set and socket at 0★; Soul Stone 12
(200 EXP), Great Soul Stone 5 (800 EXP); 11 fossils (1.2 each, Old Amber 0.6); 15 treasures (1.1 each).

## Lab and museum
- 3 lab slots. Shells / roots / heads fossils cure in 2 h for 100,000 Gold, the ancient ones 4 h / 250,000, Old Amber
  8 h / 500,000. Collect when done.
- **Museum** (owner, 2026-11-04): a big part of power. 234 spots in 31 groups, written by `scripts/generate-museum.mjs`:
  the 26 fossils and treasures (8 groups), the 19 berries (4 groups by tier), the 75 held items (5 groups by tier),
  the 60 orbs (12 kinds × 5 colours; a group per colour) and the 54 soul hearts (9 sets × 6 sockets; a group per set).
- The player chooses what to donate, and the donated copy is used up: fossils and treasures from storage; a berry,
  held item, orb or soul heart by picking one owned copy that is not worn or locked. One per spot.
- Every filled spot gives all Pokémon flat HP and P.ATK / S.ATK. A full group gives flat HP / ATK, % HP / % ATK and two
  rarer lines (Crit, Crit Resistance, Crit Intensity, Block, Block Intensity, Guard Break, DMG Boost / Reduction,
  Control Boost / Resistance, PvP DMG Boost / Reduction). Groups have ranks 1–5: flat HP 20,000–240,000, ATK
  1,700–20,000, 2–8 %, rarer lines 1–4 %. Every group together: +117 % HP / ATK; a full museum roughly doubles a geared
  Pokémon's HP and about 2.5× its ATK (stand-ins). The lines join the account-wide fold (titles and fashion).
- Spare fossil / treasure copies → Soul-heart EXP (fossil 400, treasure 150).
