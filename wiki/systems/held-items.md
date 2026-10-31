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
- **Superseded 2026-10-31:** the +20%/+5% question is gone — refine becomes the source's re-roll
  ([copy the source exactly](../decisions/copy-the-source-exactly.md)). Still open: which cost ladder.

## How the source game refines (found 2026-10-31 in `reference/game-rebuild/kb/held-items.md`)
**Refine in the source is a re-roll, not a power-up.**
- Items carry **random extra lines** by quality: Rare 1 · Epic 2 · Legendary 3 · Supreme 5 · Mythic 6,
  drawn at equal odds from a pool of 31 (faction Ult/Skill DMG up/RED, Crit, Crit Res, Crit INT,
  Block, Block INT, Guard Break, Control Boost/Res, Absorb, two healing lines).
- A refine re-rolls **one** line into a brand-new line + value; the player **keeps or drops** it.
- Only some slots can ever be refined: Mythic 3, Supreme 2, lower 0. The main stat never.
- Cost in Held Item Resetters by refine count: 1,1,2,3,4,5,6,8,10,12,14,16,18,20, then 20.
- The item's special effect does **not** grow with refines.

Wildbound's M7/M11 refine (+20% to the special effect, fixed lines, no re-roll) is an invention that
doesn't match this. The owner's "first roll is free" wording fits the re-roll model. Which model to
build is an [open question](../open-questions.md).

## Ideas from Claude chats (not in plan)
The [co-op boss tower](../ideas/coop-boss-tower.md) idea rewards "one mythic held item of choice
(usable only when Hoopa stage is above 181)".
