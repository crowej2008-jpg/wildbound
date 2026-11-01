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
| 25+ | R steps, M13.3 | each retrofit step bumps both constants (reset, no migration) |

Note: the earlier M13 plan doc called the M13 save "v14" — numbers drifted as sub-steps landed.
