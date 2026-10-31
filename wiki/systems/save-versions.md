---
title: Save versions
type: system
updated: 2026-10-31
sources: [docs/CHANGELOG.md, packages/server/src/save.ts]
---

# Save versions

`SAVE_VERSION` in `packages/server/src/save.ts` is **17** (as of `27536b7`). Every bump needs an
additive migration + a migration test; old saves must load.

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
| **18** | M13.3 (planned) | Hoopa's Vault slice + vault squad; refine counts must survive |

Note: the earlier M13 plan doc called the M13 save "v14" — numbers drifted as sub-steps landed.
