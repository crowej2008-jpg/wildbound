# Faction Tower (M13.7)

`scripts/import-faction-tower.mjs` → `packages/content/tuning/faction-tower.json`. Opens after story 28-10
(source `sys_open_basic` 64, RACE_TOWER). Route: `/explore/faction-tower`. Squads: `factionTower`, `factionTower2`.

## Sources
- **Source dumps:** the towers and milestones (`achievements_cfg` lines 26 / 27 / 28, `race_tower_type` 21 / 22 /
  23), the Powerful Evolve boxes (`item_hero_json` 10251–10253), bought sweeps (`vip_priv_json.race_tower_num` = 2),
  the shop (shop 25). The floor table itself is not in the dumps.
- **Owner's wiki** (`/game-modes/faction-tower`): open days, 20 floors a day, allies, the 4-of-type rule, two teams
  from 701, sweeps and prices, per-floor pay, the floor-910 bonus figure, the shop's Star Shard and Gold rows.

## Rules (built)
- Three towers, 1,000 floors each; each opens on its weekdays (UTC; all three on Sunday).
- 20 floor clears a day per tower; only wins count; a loss costs nothing. Counters reset at 00:00 UTC.
- A team holds the tower's faction plus Light and Dark, at least 4 of the type. It fills from its squad (picks of
  another faction are skipped), then from the strongest eligible roster Pokémon, the tower's own first.
- Floors 1–700: one team vs six enemies. From 701: team 1 vs six, then team 2 (no shared Pokémon) vs six more;
  both must win.
- Each clear: Gold 30,000 + 500 / 5 floors (max 84,500), Star Shards 150 + 25 / 5 floors (max 2,875), Faction Coins
  330 + 10 / 10 floors (max 870). Every 5th floor adds a one-time bonus. Milestone floors (10, 20 … 1,000) pay the
  source rewards; a Powerful Evolve box opens at once into one of its two 5★ Pokémon.
- Sweeps: 2 free a day across the towers, then 2 more for 10 and 20 Diamonds; a sweep of an open tower pays its
  highest floor's clear reward.

## Stand-ins
The every-5-floors bonus (linear through floor 910's 10,650 coins / 29,750 Star Shards); the enemy curve (any
faction, Lv 31 at floor 1 rising ×1.0014 a floor).

## Not built
Leaderboards (per tower; with the server parts / scaling CPUs), the Faction Battle Pass (paid), coin bonuses from
Victory Road badges (M14) and fusion skins.
