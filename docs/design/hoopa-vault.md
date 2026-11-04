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

## Drops (owner 2026-11-04: "follow the source")
- **Held items:** each route win has a 30 % chance (per multiplier copy) of a held item, raised by Strong routes and
  the Drop blessing; the Exit Guardian adds **3** (per copy). A drop draws a quality by its floor band, then any
  name of that quality at equal odds (the owner's wiki measured every name at about 1 in 27). The bag shows only
  the name and quality; the lines roll when the bag is kept, as in the source.
- **Quality bands:** from the source notes — Rare only to floor 10, then each new quality (Epic 11, Legendary 31,
  Supreme 71, Mythical 181) starts at 30 % of the draw and gains 10 points at each later band that raises it, up to
  70 %, with the quality before it taking the rest (the weights are stand-ins; the notes give only the order).
- **Orbs:** from floor 6 each route win has a 20 % chance (per copy) of the band's orb (purple +1 → red +3, as
  the notes list), a random kind. Stand-in chance.
- Resetter Shards average about 5 a run, matching the owner's wiki.

## Not built yet
- Treasure Finders (deferred to M14); the VIP key purchase.
