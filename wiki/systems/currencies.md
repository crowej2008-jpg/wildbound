---
title: Currencies and materials
type: system
updated: 2026-10-31
sources: [docs/CHANGELOG.md M6, M11.1, M13.1; docs/ASSUMPTIONS.md M13 #40-41]
---

# Currencies and materials

All currencies are `CurrencyId`s, so any of them can appear in `Rewards`. The HUD shows seven primary ones.

| Group | Currencies | Spent on |
|---|---|---|
| Core | `gold`, `gems` (earnable only), `candy` | everything; gems for resets/refreshes |
| Summon | Common / Premium tickets | [summoning](summoning-and-shops.md) |
| Mode coins (M6) | arenaToken, guildCoin, homeCoin, forestCoin, islandCoin, wildCoin | each mode's shop |
| Growth | `shard` (Wild star-up), `stone` (Link Crystal) | [roster](roster.md) growth, [Link Crystal](pve-modes.md) |
| M11 materials | Potential Shards, Orb Essence, Soul-heart EXP, Berry Essence, Held Item Shards, Plate Bottles, Plate Fragments, Star Shards, Resonation Shards, Title Tickets | one per [collection layer](collection-layers.md) |
| Planned (13.3) | **Resetter Shards**, **Held Item Resetters**, Vault Secret Keys | [held items](held-items.md), [Hoopa's Vault](hoopa-vault.md) |

Notes
- Canonical list: `CURRENCY_IDS` in `packages/engine/src/roster/types.ts`.
- The debug button grants 1,000 of each M11 material for testing (`tuning/account.json`).
- **Held Item Shards** are the owner's own invention; **Resetter Shards** come from the source — they
  must stay separate ([decision](../decisions/resetter-shards-and-refine.md)).
- No real-money sources anywhere ([free-to-play](../decisions/free-to-play.md)).
