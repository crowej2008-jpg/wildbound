---
title: Resetter Shards and the Held Item refine ladder
type: decision
date: 2026-10-31
status: decided, not yet built (13.3a)
sources: [docs/ASSUMPTIONS.md M13 #41, opencode-session-2026-10 msgs 82, 94-95]
---

# Resetter Shards and the Held Item refine ladder

## Two separate currencies (2026-10-23)
Owner: *"resetter shards and held item shards are different. resetter shards are already in the
source but held item shards are something i came up with."*

| Currency | Source | Used for |
|---|---|---|
| **Held Item Shards** | owner's invention (M11) | **Levelling** held items only |
| **Resetter Shards** | source game; dropped by [Hoopa's Vault](../systems/hoopa-vault.md) | 20 → 1 **Held Item Resetter** |
| **Held Item Resetter** | crafted | **Refining** held items (only currency for refine) |

## Refine ladder (2026-10-31) — supersedes ASSUMPTIONS #41
Owner: *"the first roll is free then it should be 1,1,2,2 and like that pattern till 10."*

| Refine # | 1 | 2–3 | 4–5 | 6–7 | 8–9 | 10–11 | 12–13 | 14–15 | 16–17 | 18–19 | 20–21 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Resetters each | free | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |

- **21 refines** total, **110 Resetters** = **2,200 Resetter Shards** per fully refined item.
- `maxRefine` goes from 5 → 21. No gold, no Held Item Shards in refine.
- ASSUMPTIONS #41's older ladder (1,1,2,3,4,5,6,8,10…20) is **superseded** — update it in 13.3a.

## Confirmed 2026-10-31
Owner kept **his ladder** even after learning the source's ("lets do my ladder for refines"). The ladder
now prices the source-style **re-roll** refine ([held items](../systems/held-items.md)), not a power-up.

## No longer open
Effect per refine: currently **+20%** (→ 5.2× at refine 21). OpenCode recommended **+5%** (→ ~2.05×)
moved into `combat.json`. **Owner hasn't answered.** → [open questions](../open-questions.md)

## Current code (before 13.3a)
`tuning/equipment.json`: `maxRefine: 5`, refine costs `800 + 400 × refine` gold and `10 + 10 × refine`
Held Item Shards. All of that is replaced by 13.3a.

Related: [held items](../systems/held-items.md).
