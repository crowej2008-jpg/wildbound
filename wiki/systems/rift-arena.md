---
title: Rift Arena
type: system
milestone: M13.4 (Barriers + Merchant), M13.5 (Ring Battle + Quiz)
status: 13.4 built 2026-11-04 (hiring, bans, credit upgrades cut)
updated: 2026-10-31
sources: [opencode-session-2026-10 msg 80 (source survey), docs/SCOPE.md]
---

# Rift Arena — gate: clear 10-10 + Lv10

Split in two by owner decision ([M13 scope](../decisions/m13-scope-and-gates.md)). Source shapes from
the 2026-10-22 survey (to be re-checked against `reference/` when building):

## 13.4 — Rift Barriers + Mystic Merchant
- Season Tue 07:00 → Sun 22:00; **250 floors** (100 + 150); 5 lives/day; boss every 5 floors.
- Ranking by highest floor, then clear time; mail settlement.
- Time Coins/Credits convert to gold at season end. Merchant stock gated by floor, purchase limits.

## 13.5 — Ring Battle + Quiz (cut by the owner 2026-11-04)
- Ring ranks Apprentice → King; +35 win / −20 loss with promotion stop (like [Ranked](pvp.md)).
- 6 free matches/day + bought; deterministic bots; weather bonus; season chests, Ring shop.
- Quiz: two pick windows/day, pays mission vouchers only. Hires: voucher cost by quality, one free hire,
  duplicates star up, usable in Ring.

Reference screenshots of Rift exist in `reference/visual/screens/rift/` (owner's machine only).
Idea backlog item: "better currency-reward rate in rift" ([change list](../ideas/change-list-2026-10.md)).

## Source check (2026-11-04)
The source's **New Rift Arena** (`underground_new_*`, modepages-pvp_cfg / modes2_cfg) replaces the 2026-10-22
survey: season Tue 07:00 → Sun 22:00; level sync; season bans; hiring (1 free a season, only Pokémon you do not
own, taken back at season end); **Rift Barriers** 250 floors (Easy 1–100, Advanced 101–250), boss every 5th,
5 lives a day, floor rewards at 20 / 40 / 60 / 80 / 100 (Gold + XP Candies), drops of Time Coins (94) and Time
Credits (93); Time Credits upgrade a hired Pokémon's equipment (`underground_new_develop_json`, 3 kinds);
challenge-count chests (`underground_new_box_reward_json`, 3 … 30 challenges); the Mystic Merchant opens a slot
per milestone floor (only its 6 orb-box rows are in the dumps). Ring Battle ranks (`underground_new_dan_json`,
27 rows, +35 / −20) and the Prediction tasks (`underground_new_guess_task_json`) are 13.5.
Server-wide parts wait for the shared backend: [decision](../decisions/rift-server-parts-later.md).
Gaps: the full Merchant stock, the season ban list, the hire list, per-floor enemy stats.

Purpose for the Advanced track (owner 2026-11-04): milestones every 25 floors and the Mystic Merchant —
[decision](../decisions/rift-purpose.md), docs/design/rift-arena.md.
