# Berry Grove (M13.8)

The owner's own mode, replacing the Island Challenge (2026-11-04; `wiki/decisions/berry-grove-replaces-island.md`).
Not a source copy. Tuning: `packages/content/tuning/berry-grove.json` (hand-written; every number a stand-in).
Gate: story 3-10 + trainer level 10. Route: `/explore/berry-grove`. Squad: `berryGrove`.

## Garden
- 6 plots. Planting spends one seed: Common / Basic / Intermediate / Greater (`seedCommon` … `seedGreater`),
  growing 2 / 4 / 8 / 12 hours.
- A ripe plot harvests into one random berry of the seed's tier (a fresh berry, as `grantBerry` rolls it) plus
  50 / 100 / 200 / 400 Berry Essence. "Harvest everything ripe" empties every ripe plot.

## Grove Guardians
- 100 stages of six generated enemies (any faction; Lv 8 at stage 1, ×1.025 a stage). 10 wins a day; a loss costs
  nothing. Stages are permanent.
- First clear by band: 1–25 Common ×2 + Basic ×1 seeds, Blue Mulch ×2, Reforge Potions ×2; 26–50 Basic ×2 +
  Intermediate ×1, Purple Mulch ×2, Potions ×3; 51–75 Intermediate ×2 + Greater ×1, Orange Mulch ×2, Potions ×4;
  76–100 Greater ×2, Red Mulch ×2, Potions ×5. Every 10th stage adds a Greater seed and 500 Essence.

## Grove Boss
- One species per UTC weekday (Sun Celebi, Mon Shaymin, Tue Shiny Venusaur, Wed Zygarde, Thu Rayquaza, Fri Dialga,
  Sat Snorlax), at the next Guardian stage's level +2 with HP ×40, ATK ×2, DEF ×2. It cannot fall; the fight runs
  its rounds.
- 3 fights a day. Pay = the band's full pay (by the Guardian stage reached) × the share of the boss's HP taken,
  at least 20 %, each line at least 1. Full pay rises from Blue Mulch ×3 / Essence 300 / Potions 3 / seeds (band 1)
  to Orange ×2 + Red ×3 / Essence 1,200 / Potions 10 / Intermediate ×2 + Greater ×2 seeds (band 4).

## Not decided
- The Island Shop and Tropical Shells (`islandCoin`) have no source now.
- No new berry tier (owner: not yet).
