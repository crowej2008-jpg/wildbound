---
title: Resetter Shards and the Held Item refine ladder
type: decision
date: 2026-10-31
status: built in R5 (2026-10-31)
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

## No refine limit (2026-11-04)
Owner: *"when i mean upto 10 i mean that is the final cost but you can still reroll"*. The ladder is the price
of refines 1–21; every refine after that costs 10 Resetters, with no limit (`max_refine` removed). The 21-refine,
2,200-shard total above is now the cost of reaching the 10-a-refine price, not a cap.

## Main-stat re-roll (2026-11-04)
Owner: *"have it reroll and the cost be 100 resetter shards"*. A held item's main stat (HP / P.ATK / S.ATK) can be
re-rolled into one of the other kinds at random for **100 Resetter Shards**; level, lines and refines stay.

## Confirmed 2026-10-31
Owner kept **his ladder** even after learning the source's ("lets do my ladder for refines"). The ladder
now prices the source-style **re-roll** refine ([held items](../systems/held-items.md)), not a power-up.

## No longer open
Effect per refine: currently **+20%** (→ 5.2× at refine 21). OpenCode recommended **+5%** (→ ~2.05×)
moved into `combat.json`. **Owner hasn't answered.** → [open questions](../open-questions.md)

## Built (R5, 2026-10-31)
`content/equipment/held-items.json` `refineLadder` = [0, 1, 1, 2, 2 … 10, 10]; the price is per item
(its `refines` count), cap 21. `resetterCompound` = 20 from `item_compound_json`. The old gold + shard
refine and `maxRefine: 5` are gone.

Related: [held items](../systems/held-items.md).
