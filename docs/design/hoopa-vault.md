# Hoopa's Vault (M13.3)

A 300-floor escape run. Opens on server day 15. Route: `/explore/hoopa-vault`.

## Rules (built)
- **Keys:** 5 free Vault Secret Keys a UTC day (claim once); keys persist. A run spends `multiplier` keys;
  a loss, a catch, a Guardian loss or leaving refunds them. Only a Guardian win uses them up.
- **Floors and multiplier:** floors open one at a time (clear N to open N + 1). ×3 once the highest cleared
  floor is 31 or more, ×5 at 71. A ×N run multiplies its pay by N.
- **Run:** escape starts at 10, Hoopa at 0, the target is 40. After each route battle two cards are offered:
  Strong (+10 escape, enemies ×1.5, +50 % drops), Normal (+5), Battle buff (+5, +10 % attack for the run),
  Drop blessing (+5, +25 % drops for the run). A route battle's round cap is the lead (escape − Hoopa); a
  time-out is a loss. Hoopa advances by the rounds fought; if he reaches the escape value you are caught.
- **Exit Guardian:** at 40 escape; a fixed 15-round fight against the floor's team at HP ×3, ATK / DEF ×1.5.
  A win keeps the bag plus the Guardian's pay and clears the floor.
- **Squad:** its own squad (`hoopaVault`).

## From the source
`hupa_treasury_difficulty_json` (40 rows): the floor bands, each with its drop pool and what starts dropping
there (Rare held items from floor 1, Epic 11, Legendary 31, Supreme 71, Mythical 181; purple orbs Lv 1 / 2 / 3
from 6 / 21 / 41; orange Lv 1–4 from 61 / 81 / 121 / 161; red Lv 1–3 from 201 / 241 / 281). The view shows the
next band's note and the next few band starts.

## Stand-ins (labelled)
- Enemies: the Explore enemy curve (level 3 × 1.016^(floor − 1), stars every 15 floors); the Guardian's
  multipliers.
- Pay per route win: Held Item Shards 2 + 0.1 × floor; a 35 % chance of 1–3 Resetter Shards; Guardian
  1–4 Resetter Shards and 10 Held Item Shards; Resetter lumps × 1 / 1.5 / 2 / 2.5 / 3.5 from floors 1 / 101 /
  151 / 201 / 251. The owner's wiki measures about 5 Resetter Shards a run on average.
- Card numbers (escape, enemy multiplier, buffs, weights).

## Not built yet (waiting for the owner)
- **Held-item drops** and **orb drops** by floor band (the source's drop pools 101–120 are not in the dumps;
  only the band notes are). The owner asked to be consulted before the held items are worked on.
- Treasure Finders (deferred to M14); the VIP key purchase.
