---
title: Source-fidelity audit
type: project
status: preliminary — from docs only; each row must be checked against reference/ before fixing
updated: 2026-10-31
sources: [docs/CHANGELOG.md, docs/ASSUMPTIONS.md, docs/design/collection.md plan, reference/game-rebuild/kb/held-items.md]
---

# Source-fidelity audit

Built systems that differ from the source, now that the rule is
[copy the source exactly](../decisions/copy-the-source-exactly.md). This list comes from the repo docs
(what OpenCode said it changed); it is **not** a full comparison against `reference/` yet.

## Mechanics differ (biggest)
| System | Wildbound now | Source |
|---|---|---|
| [Held Items](../systems/held-items.md) | 27 invented designs; fixed lines; refine = +20% to the effect, max 5; Lv cap 60 | 75 items (Choice Band, Scope Lens, Icy Rocks…); 1–6 **random lines** from a 31-line pool; refine = **re-roll one line, keep/drop**, Mythic 3 / Supreme 2 slots; Lv cap 200; lock; dismantle 5/8/10/15/20 shards |
| [Resonance](../systems/collection-layers.md#resonance) | 6 slots, stat share × crystal level | 10 slots; a slotted Wild **fights at the crystal's level**; 24h cooldown on removal |
| [Orbs](../systems/collection-layers.md#orbs) | 16 orbs, 4 sets, 2/4-piece | 12 kinds × 4 qualities, 12 sets, 3/5-piece, 6 family-typed sockets |
| [VIP](../systems/collection-layers.md#vip) | 7 tiers from lifetime XP | 20 tiers (points from activity chests) |
| Summoning duplicates | Grant fresh Wilds | Check source (likely shards) |
| [M8 Tower](../systems/pve-modes.md) | Climbs reset weekly | Climbs reset daily |
| M8 modes | Enemies from a difficulty curve; invented trial/dungeon/boss names | Authored floor/area tables and names |
| [Link Crystal](../systems/pve-modes.md) | 10★ gate | 12★ gate |
| Trainer level | Cap 80 (Sky Pillar gates capped to 80) | Cap 200 |
| Evolution | Generated `X / X Prime / X Zenith` | Check source forms |
| Species stats/classes | Class template × tier multiplier; classes cycled | Source stats/classes per species |

## Numbers and names differ ("counts follow the source, values are ours")
- [Campaign](../systems/campaign.md) 182×10: chapter/gym names, enemies, levels, rewards, idle rates generated.
- [Pet Home](../systems/pet-home.md): XP thresholds, income values, tile layout, all 132 shop rows.
- [Sky Pillar](../systems/sky-pillar.md): wing names, conditions, rewards, enemy curves.
- [Titles](../systems/collection-layers.md#titles): 102 "original" titles (source has named ones like King of Arena, Megastar Four).
- [PvP](../systems/pvp.md): Arena/Ranked reward tables were a "scaled fit"; ghost curves fitted.
- Potential, Berries (16 vs 19), Plates, Trinkets: authored lines/curves rather than source rows.

## Already source-faithful (as far as the docs say)
Combat model (measured), Ranked scoring/tier names/regions, Hoopa's Vault run rules, 20 Resetter
Shards → 1 Resetter.

## Suggested order
1. Fix **Held Items** inside 13.3a (Hoopa's Vault depends on it).
2. Build every remaining M13 mode exactly from the source.
3. A dedicated retrofit milestone for the rest, mechanics first, then numbers/names.
