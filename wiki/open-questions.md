---
title: Open questions and known drift
type: hub
updated: 2026-10-31
---

# Open questions and known drift

## Waiting on the owner
| R | [Source retrofit](milestones/source-retrofit.md): who builds it (OpenCode on the owner's PC can read `reference/` and run tests), and may test saves be reset instead of migrated? | R0 | 2026-10-31 |
| # | Question | Blocks | Raised |
|---|---|---|---|
| 1 | ~~What is a refine?~~ **Answered and built (R5, 2026-10-31):** the source's re-roll with keep/drop on Mythic 3 / Supreme 2 slots, priced on the owner's ladder. | — | 2026-10-31 ([held items](systems/held-items.md)) |
| 2 | Titles: keep King of Arena + Alliance Champion as the 14-day pair, or source-exact (King of Arena 7-day; Arena Sovereign V as 14-day)? | nothing | 2026-10-21 |
| 3 | Arena Refresh is free and unbounded — cap it per day? | nothing | 2026-10-18 |
| 4 | Island Challenge: the change list says "replace island with a different mode", but 13.8 is locked as full Island + alliance contest. Which? | 13.8 | [change list](ideas/change-list-2026-10.md) |
| 5 | Gods Trials Origin gap: seasonal star bonus, minimal Origin slice, or a real Origin system (change-list #12)? | Gods Trials | 2026-10-22 |
| 6 | When does the [co-op boss tower](ideas/coop-boss-tower.md) enter the roadmap (M14?), and what are "awakened levels"? | — | Claude chats |
| 7 | Undefined change-list terms: gold wings, ecology, purple things, mecha, beast egg. | — | [change list](ideas/change-list-2026-10.md) |
| 8 | Friend feedback on the M13 plan — not yet turned into a change list. | — | Claude chats |
| 9 | **PvP DMG Boost cap 50%** — base game (owner, from his friend, 2026-11-01: *"he said 50% for for pvp dmg boost"*, *"the cap is from the base game"*); not in the kb. Owner: *"drop it for now"* — Wildbound has no cap. Revisit when Orbs/Gear/Potential (R2–R4) add PvP DMG Boost sources. Also open: is PvP DMG Reduction capped? | R3 orbs | 2026-11-01 |

## Source tables still missing (stand-ins in use)
- Pokémon level-up candy/gold per level, trainer-level XP, per-species milestone stats
  (`hero_upstage_attr_json`), level-unlocked talent stat bonuses.
- **Gear:** the dumps hold only 8 of the 64 `god_eqm_basic_json` rows and no `god_eqm_suit_json`.
- **Orbs:** `hero_orb_basic_json`, `hero_orb_suit_json`, `hero_orb_pos_json` are not dumped (only
  `hero_orb_decompose_json`). These block an exact R2 / R3. Can the owner re-extract them from
  the bot's cache? (ASSUMPTIONS #50–51). Owner 2026-10-31: *"lets just go off of what we know"* — R2/R3
  will use the kb notes with labelled stand-ins (ASSUMPTIONS #55).
- **Held-item album:** `held_item_total_collect` / `held_item_group_collect` are not dumped (kb has only
  the totals), so the album is deferred (ASSUMPTIONS #56).
- **Held-item skill numbers the text leaves out (E2 stand-ins):** Smooth Rock / Heat Rock chance (50 %),
  Rocky Helmet duration (to round end), Terrain Extender's reading, Damp Rock's reading (+25 %).

## Known test problems
- Two mobile e2e tests in `tests/e2e/m11.spec.ts` (Trinkets, VIP) are flaky on CI — see [dev environment](project/dev-environment.md).

## Repo docs that are out of date (lint, 2026-10-31)
- `PROMPT.md` §1 still says "about 36 original creatures"; the roster is 84 Pokémon.
- (Fixed in R5: ASSUMPTIONS #56 now records the owner's ladder.) `docs/ASSUMPTIONS.md` #41 refine ladder (1,1,2,3,4,5,6,8…) is superseded by the owner's
  free-then-1,1,2,2…10 ladder ([decision](decisions/resetter-shards-and-refine.md)).
- `docs/design/README.md` "Planned notes" list (economy, growth, server-api, squads, time) never written.
- M11's original plan numbers (20 VIP tiers, 10 Resonance slots, 48 orbs, Held Items Lv50/200) differ
  from what shipped — CHANGELOG is right ([collection layers](systems/collection-layers.md)).
- The `reference/` folder (research wiki, screenshots) is gitignored, so cloud agents can't check
  "the source" — ask the owner or work from his machine.
