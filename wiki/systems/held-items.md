---
title: Held Items
type: system
milestone: M7, M11.6, retrofit planned in M13.3a
status: built; refine retrofit pending
updated: 2026-10-31
sources: [docs/CHANGELOG.md M11.6, tuning/equipment.json, opencode-session-2026-10 msgs 94-95]
---

# Held Items

(Code id: **relics**.)

## Built today (M11.6)
- 27 designs, class-locked. Levels **1–60**, costing `5 + 2 × (level − 1)` Held Item Shards.
- Refine: `maxRefine: 5`; costs `800 + 400 × refine` gold and `10 + 10 × refine` Held Item Shards.
- Effect active at refine 0, **+20% per refine**.
- Worn items ask for confirmation before moving to another Wild.

## Planned in M13.3a (decided, not built)
- New currencies: **Resetter Shard**, **Held Item Resetter**; compound **20 → 1**.
- Refine pays **Resetters only**; ladder: first free, then 1,1,2,2 … 10,10 → **21 refines**,
  110 Resetters. Details: [Resetter decision](../decisions/resetter-shards-and-refine.md).
- **27 mythic variants** so [Hoopa's Vault](hoopa-vault.md)'s 181+ floors have a mythic pool.
- UI: both balances, compound button, "Free" on first refine.
- Existing refine counts must survive the save migration.
- **Open:** keep +20%/refine (5.2× at max) or switch to +5% (≈2.05×)? → [open questions](../open-questions.md)

## Ideas from Claude chats (not in plan)
The [co-op boss tower](../ideas/coop-boss-tower.md) idea rewards "one mythic held item of choice
(usable only when Hoopa stage is above 181)".
