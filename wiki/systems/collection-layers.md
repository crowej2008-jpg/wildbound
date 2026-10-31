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

## Potential
Duplicate Wilds of the same species are fodder (lowest level/stars consumed first; locked and squad
Wilds protected). Tier unlock = authored fodder + `20 + tier × 10` Potential Shards. Respec 5 shards;
reset 50 gems refunds shards, **not** fodder.

## Orbs
4 sets × 4 orbs = 16 orbs, 4 qualities, Lv1–6, 2- and 4-piece set bonuses. Level-up: two same-kind,
same-level, unsocketed copies + gold, **or** Orb Essence (`essenceBase + (level−1) × essencePerLevel`).
[Pet Home](pet-home.md)'s Orb Atelier sells orbs.

## Soul-hearts
The owner's nine sets — see **[soul-hearts](soul-hearts.md)**. Star-up costs Soul-heart EXP
(`expBase + (stars−1) × expPerStar`; 2→3★ = 80).

## Berries
16 Berries (four per tier). **Two slots** (save v8). Star-up = spare copies (2) + Berry Essence (`20 + 20 × star`). Dismantle a
spare for 5/10/20/40 Essence by tier. Real battles consume one copy per occupied slot.

## Held Items
See **[held items](held-items.md)** (levels, refine, Resetter retrofit).

## Plates
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
