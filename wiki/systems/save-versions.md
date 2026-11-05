---
title: Save versions
type: system
updated: 2026-10-31
sources: [docs/CHANGELOG.md, packages/server/src/save.ts]
---

# Save versions

`SAVE_VERSION` in `packages/server/src/save.ts` is **19** (R1). **During the source retrofit saves are
reset, not migrated** (owner, 2026-10-31): `MIN_SAVE_VERSION` equals `SAVE_VERSION`, older saves are
refused as `outdated_save` and LocalServer starts a fresh account. Migrations (additive + test) resume
after the retrofit, once friends have real saves.

| v | Milestone | Added |
|---|---|---|
| 2 | M5 | campaign/idle/daily slices |
| 3 | M6 | gacha + shop state |
| 4 | M7 | equipment loadouts |
| 5 | M8 | PvE modes, Link Crystal |
| 6 | M10 | `pvp: { arena, ranked }` |
| 7 | M11.1 | ten M11 materials (currency record normalised) |
| 8 | M11.5 | Berries: `charm` → `charms[2]` |
| 9 | M11.7 | per-Wild plates |
| 10 | M11.8 | trinkets by species |
| 11 | M11.9 | resonance slots |
| 12 | M11.10 | `vip.lastClaimDay` |
| 13 | M11.11 | titles owned/equipped |
| 14 | M13.0a | `campaign.gyms` |
| 15 | M13.0b | `serverEpoch` (server-day gates) |
| 16 | M13.1 | `petHome` |
| 17 | M13.2 | `skyPillar` + squad mode |
| **18** | R0 | **Reset baseline** — `MIN_SAVE_VERSION` 18; older saves retired, fresh account started |
| 19 | R1 | species star ladders: `evolutionStage` removed, stars = source stars, five factions (reset) |
| 20 | R5 | held items: `RelicInstance` = level 0–200, main-stat group, rolled lines, refines, pending roll, lock; Resetter currencies (reset) |
| 21 | E4 | `speciesShards`; Origins' `skillLevels` (reset) |
| 22 | R4 | `potential` per Wild; old talent paths removed from loadouts (reset) |
| 23 | R3 | `equipment.orbs` + `loadout.orbs` (8 sockets) replace runes (reset) |
| 24 | R6c | Soul-heart `quality` (reset) |
| 25 | R6b | `trinketItems` (each holder's own levelling item, by species) (reset) |
| 26 | R6b | Faction Tower Coins and the six trinket-chest currencies (reset) |
| 27 | R6d | berry instances (`equipment.berries`, `loadout.berries`) replace the stand-in charms; Mulch and Reforge Potions (reset) |
| 28 | R7 | source Resonance (`resonance` slots, cooldowns, evolved, level; `WildInstance.ownLevel`); `pve.linkCrystal` removed (reset) |
| 29 | R8 | source VIP: `privilegeXp` currency; `state.vip` removed (reset) |
| 30 | R8 | `titles.cards`; Starter Trainer owned; `titleTicket` removed (reset) |
| 31 | R8 | `trainerTokens` (levels, fragments, treasure totals by season) (reset) |
| 32 | R9 | `signIn` calendar; 3★ / 5★ Pokémon Shards (reset) |
| 33 | R8 | `fashion` (ladders, piece stars and shards, worn); three level stones (reset) |
| 34 | R9 | daily dungeons: runs, best grades, drawn chests (reset) |
| 35 | R9 | Tower: daily climbs, Hard floor; weekly counters and milestone claims removed (reset) |
| 36 | R9 | World Boss per-window score (reset) |
| 37 | R9 | Trials removed from PvE progress (reset) |
| 38 | R9 | source summoning: per-machine free timers, box credits, lifetime draws; VIP credits, Wishing Well faction; pity and species wish removed; `preciousShard` (reset) |
| 39 | R9 | the Bag: `preciousGiftbox` currency (reset) |
| 40 | M13.3 | Hoopa's Vault: `hoopaVault` slice and squad, `vaultKey` currency (reset) |
| 41 | M13.4 | Rift Barriers: `rift` slice and squad, `timeCoin` / `timeCredit` (reset) |
| 42 | M13.6 | Misty Woods: `misty` slice and squad (reset) |
| 43 | M13.7 | Faction Tower: `factionTower` slice, squads `factionTower` / `factionTower2` (reset) |
| 44 | M13.8 | Berry Grove: `berryGrove` slice and squad, four seed currencies (reset) |
| 45 | M13.9 | Dig Site: `digSite` slice (reset) |
| 46 | M14.1 | Victory Road: `victoryRoad` slice (reset) |
| 47 | M14.2 | King's Trial: `kingsTrial` and `counters` slices (reset) |
| 48 | M14.3 | Pokémon Paradise: `paradise` slice, ball / scanner currencies (reset) |
| 49 | M14.4 | Joint Team: `jointTeam` / `wildArea` slices, squad, six currencies (reset) |
| 50 | M14.5 | Clash of Isles: `isles` slice, squad, `islandVoucher` (reset) |
| 51 | M15 | Account systems III: `account3` slice, seven currencies (reset) |
| 52 | M16 | Guild + events: `guild` / `events` slices, five currencies (reset) |
| 53 | M17 | Guild War + Relic Battlefield: `guildWar` / `relic` slices, squads, `relicCoin` (reset) |
| 54 | follow-up | Pokémon Park: `park` slice and squad (reset) |
| 55 | follow-up | Weekend Bash + Flower Event: `weekend` slice, four currencies, counters keep last week (reset) |
| 56 | M18.1 | SPT Temple: `temple` slice and squad (reset) |
| 57 | M18.2 | Cross-Server Clash: `clash` slice, squad, `predictionCoin` (reset) |
| 58+ | later steps | each step that changes the save bumps both constants (reset, no migration) |

Note: the earlier M13 plan doc called the M13 save "v14" — numbers drifted as sub-steps landed.
