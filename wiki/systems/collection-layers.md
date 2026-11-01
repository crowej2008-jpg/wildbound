---
title: Collection layers (M7 + M11)
type: system
milestone: M7 engine, M11 content/UI
status: built
updated: 2026-10-31
sources: [docs/design/collection.md, docs/design/equipment.md, docs/CHANGELOG.md M11.0-M11.12]
---

# Collection layers (M7 + M11)

Every layer folds into a Wild's stat sheet via `foldLoadout` and counts toward Power. Costs live in
`tuning/collection.json` (M11) and `tuning/equipment.json` (M7). Names follow the source
([decision](../decisions/m11-names-and-materials.md)).

> **Heads-up:** M7's client tabs were never wired; M11.0 built them. The *built* numbers below come from
> the CHANGELOG and differ from M11's original plan (e.g. VIP 7 tiers not 20; Resonance 6 slots not 10;
> 16 orbs not 48). Trust the built numbers.

## Potential (R4: source copy, 2026-11-01)
62 Pokémon (Legendary+), 15 trees, 67 options. Tier N at 6 + N★, any order; unlock = 1 of 3 options +
fodder (own faction / W-F-G / own copy by quality) + shards (20,000 … 75,000), level to 6 with shards
(8,370,000 for everything). Potential Core stands in on 21 species (tiers 5–9). Reset 16 💎 returns
everything. Details: `docs/design/potential.md`.

## Orbs (R3: source copy with stand-ins, 2026-11-01)
12 kinds (6 twin pairs, defensive/offensive), 5 colours (caps +3/+5/+7/+10/+10), 8 sockets (2 rows × 4 gear
pieces) with family rules, opens at player Lv 50 / 9★ (row 2 at Lv 240). Level = 2 free copies + Gold (Quick
Upgrade fuses 3 → 1). 26 sets, tiers at the lowest orb level. Dismantle → Orb Essence (not red). Stand-ins
for the missing orb tables: `docs/design/orbs.md`, ASSUMPTIONS #65.

## Soul-hearts
The owner's nine sets — see **[soul-hearts](soul-hearts.md)**. Star-up costs Soul-heart EXP
(`expBase + (stars−1) × expPerStar`; 2→3★ = 80).


**R6c (2026-11-01):** source qualities blue / purple / orange / red (caps 2 / 3 / 4 / 5★, stars from 0), the
source star EXP table, 10★ unlock; the owner's nine sets stay. ASSUMPTIONS #66.
## Berries
16 Berries (four per tier). **Two slots** (save v8). Star-up = spare copies (2) + Berry Essence (`20 + 20 × star`). Dismantle a
spare for 5/10/20/40 Essence by tier. Real battles consume one copy per occupied slot.

## Held Items
See **[held items](held-items.md)** (levels, refine, Resetter retrofit).

## Plates
**R6a part 1 (2026-11-01):** source plates — 54 by card type, one stat table, stages 0–18, 630 Bottles +
2,625 Fragments, player Lv 34 / 6★, Pokémon Lv 47 / 60 gates. Skills pending (part 2).

One per faction (6). Stages 0–20; cost `10 + 5 × stage` Plate Bottles, except 5→6 = **375 Plate
Fragments**. Stage-6 skill swap "coming later". Save v9.

## Trinkets
One per species (84). Lv0–40; `10 + 5 × level` Star Shards. Level is **per species** (all copies
share it). Strikers → Crit Intensity, Guardians → DMG Reduction, Adepts → Skill Boost. Shiny variants
later. Save v10.

## Resonance
Six slots (two open); unlock `50 + 50 × slot` Resonation Shards. A slotted Wild gains per-crystal-level
shares (4 HP, 1 P.ATK, 1 S.ATK, 0.5 P/S.DEF, 0.05 SPD) × [Link Crystal](pve-modes.md) level. On the
Trainer screen. Save v11.

## VIP
Seven tiers (Visitor → Crown) from **lifetime XP** (0–250,000) — nothing is bought. Perks: extra idle
hours, shop discount, daily Common Ticket supply. Save v12.

## Titles
102 titles (85 permanent, 15 × 7-day, 2 × 14-day), three slots (Common/Premium/Rare), Title Tickets
for activation/upgrade/Continuation, lazy expiry, account-wide stat lines. Guild/event titles locked
until M15/M16. Save v13. One taste question open — see [open questions](../open-questions.md).
