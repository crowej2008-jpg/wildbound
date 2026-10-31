---
title: Open questions and known drift
type: hub
updated: 2026-10-31
---

# Open questions and known drift

## Waiting on the owner
| # | Question | Blocks | Raised |
|---|---|---|---|
| 1 | Held Item refine effect: keep **+20%/refine** (5.2× at refine 21) or switch to **+5%** (≈2.05×), moved into `combat.json`? | 13.3a | 2026-10-31 ([refine](decisions/resetter-shards-and-refine.md)) |
| 2 | Titles: keep King of Arena + Alliance Champion as the 14-day pair, or source-exact (King of Arena 7-day; Arena Sovereign V as 14-day)? | nothing | 2026-10-21 |
| 3 | Arena Refresh is free and unbounded — cap it per day? | nothing | 2026-10-18 |
| 4 | Island Challenge: the change list says "replace island with a different mode", but 13.8 is locked as full Island + alliance contest. Which? | 13.8 | [change list](ideas/change-list-2026-10.md) |
| 5 | Gods Trials Origin gap: seasonal star bonus, minimal Origin slice, or a real Origin system (change-list #12)? | Gods Trials | 2026-10-22 |
| 6 | When does the [co-op boss tower](ideas/coop-boss-tower.md) enter the roadmap (M14?), and what are "awakened levels"? | — | Claude chats |
| 7 | Undefined change-list terms: gold wings, ecology, purple things, mecha, beast egg. | — | [change list](ideas/change-list-2026-10.md) |
| 8 | Friend feedback on the M13 plan — not yet turned into a change list. | — | Claude chats |

## Repo docs that are out of date (lint, 2026-10-31)
- `README.md` says current milestone **M5/M6**; reality is M13.3.
- `PROMPT.md` §1 still says "about 36 original creatures"; the roster is 84 Pokémon.
- `docs/ASSUMPTIONS.md` #41 refine ladder (1,1,2,3,4,5,6,8…) is superseded by the owner's
  free-then-1,1,2,2…10 ladder ([decision](decisions/resetter-shards-and-refine.md)).
- `docs/design/README.md` "Planned notes" list (economy, growth, server-api, squads, time) never written.
- M11's original plan numbers (20 VIP tiers, 10 Resonance slots, 48 orbs, Held Items Lv50/200) differ
  from what shipped — CHANGELOG is right ([collection layers](systems/collection-layers.md)).
- The `reference/` folder (research wiki, screenshots) is gitignored, so cloud agents can't check
  "the source" — ask the owner or work from his machine.
