---
title: Faction Tower
type: system
milestone: M13.7
status: built
updated: 2026-11-04
sources: [opencode-session-2026-10 msg 80, docs/SCOPE.md, owner wiki game-modes/faction-tower, achievements_cfg, items_cfg, modes3_cfg]
---

# Faction Tower (M13.7) — gate: clear 28-10

- **Three towers, 1,000 floors each** (3,000 in all): Water (Mon / Thu / Sun), Fire (Tue / Fri / Sun), Grass
  (Wed / Sat / Sun). 20 floors a day in each open tower; floors are permanent.
- **Teams:** the tower's type plus Light and Dark, at least 4 of the type; one team of six to floor 700, two teams
  (squads `factionTower` / `factionTower2`) against twelve enemies from 701.
- **Pay:** each floor 30,000 Gold / 150 Star Shards / 330 Faction Coins, rising to 84,500 / 2,875 / 870 by ~550;
  a one-time bonus every 5 floors (stand-in curve through the floor-910 figure); source milestones every 10 / 25
  floors (5-Star Pokémon Shards, Powerful Evolve box Pokémon).
- **Sweeps:** 2 free a day (shared), then 10 / 20 Diamonds; a sweep pays the highest floor.
- **Shop:** trinket chests, Star Shards, Gold; daily restock.
- Not built: leaderboards (server parts later), the Faction Battle Pass (paid), badge / fusion-skin coin bonuses.
- Design: `docs/design/faction-tower.md`; ASSUMPTIONS #103.

Different from the M8 [Tower](pve-modes.md) and the [co-op boss tower idea](../ideas/coop-boss-tower.md).
