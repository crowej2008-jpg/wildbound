---
title: Source retrofit (R) — make built systems match the source exactly
type: milestones
status: planned — owner approved the goal 2026-10-31; runs before M13.3
updated: 2026-10-31
sources: [owner 2026-10-31, reference/game-rebuild/kb/*.md, reference/game-rebuild/data/h5-client/*]
---

# Source retrofit (R)

Owner, 2026-10-31: *"lets fix up everything to match the source."* Rule:
[copy the source exactly](../decisions/copy-the-source-exactly.md). Runs **before** M13.3 (Hoopa's
Vault needs the real Held Items) and before any new mode.

## How to copy exactly
The source's own config tables are on the owner's PC: `reference/game-rebuild/data/h5-client/2026-10-0{2,3,4}/*_cfg.json`
(~35 MB: `pokemon_data_cfg`, `items_cfg`, `boosts_cfg`, `runes_cfg`, `potential_cfg`, `vip_cfg`,
`gacha_cfg`, `afk_cfg`, `pet_home_cfg`, `modepages-*_cfg`, …), with human notes in
`reference/game-rebuild/kb/<system>.md` ("Current picture" sections). Each step adds a
`scripts/import-<system>.mjs` that reads those tables and writes `packages/content/…` JSON, committed
like the existing generators, so the copy is reproducible and checkable.

**Keep (owner exceptions):** the 84-Pokémon roster/kits, his nine Soul-heart sets, Held Item Shards,
his refine ladder, no real money.

## Steps (each: list → owner OK → build → `pnpm check` → wiki + commit)
| Step | System | What changes (from the kb notes) |
|---|---|---|
| R0 | Import pipeline | Shared loader for the h5-client tables; decide save policy (migrate or reset test saves). |
| R1 | Pokémon growth | Source level costs (XP Candies + Gold), level caps up to 340 then via Resonance, evolution lines (e.g. Bulbasaur → Ivysaur → Venusaur instead of Prime/Zenith), star/evolution fodder (own + same-faction copies at set stars), 30/40/50 shards per Pokémon, source base stats/classes, trainer level table (no 80 cap), bag size. |
| R2 | **Gear** (missing today) | 64 pieces = 16 tiers × 4 slots (Core, Cube, trinket slot, Wings), Smithy 3 → 1 crafting with gold, orange/red named sets. Artifact gear (Evo Stones) waits for artifacts. |
| R3 | Orbs | 12 kinds × 5 colours = 60 orbs; **2 sockets per gear piece** with family typing; caps +3/+5/+7/+10; level = 2 copies + gold ladder; Quick Upgrade; 26 sets (3- and 5-kind, pay at Lv 3/5/7/10); dismantle → Orb Essence. Opens player Lv 50, slots at 9★. |
| R4 | Potential | 62 Pokémon (Legendary+) with per-Pokémon trees (15 distinct); tier N at 6+N★; source Potential Shard table (e.g. tier 1: 20,000 unlock … 360,000 total); fodder; reset 16 💎. |
| R5 | **Held Items** | 75 source items (Choice Band, Scope Lens, Icy Rocks…), class-locked, Supreme+ wearers; main stat + 1–6 random lines from the 31-line pool; **re-roll refine** (keep/drop) on Mythic 3 / Supreme 2 slots with the **owner's ladder**; level cap 200 with the source shard table; lock; dismantle 5/8/10/15/20 shards; album. Adds Resetter Shards → Resetters (20 → 1). |
| R6 | Berries, Plates, Trinkets, Soul-hearts | Berries: 19, four tiers, Commons uncultivatable, flat dismantle 50/40. Plates: per type (18 types), stages 0–18, source Bottle/Fragment costs, opens player Lv 34. Trinkets: per Pokémon skills at Lv 10/20/30/40, 300,430 Star Shards to Lv 40, trinket chests. Soul-hearts: keep the owner's nine sets, copy the source's sockets/stars/EXP rules. |
| R7 | Resonance | Crystal evolves at Lv 340; cap 340 + 8 per 12★ Pokémon; 2 free slots, source price ladder (30, 80, 100…), 24h slot cooldown (4 💎/hour to clear); slotted Pokémon **use the crystal's level**. |
| R8 | Account layers | VIP 0–40 from Privilege XP (daily activity's 120-point chest pays 60; no purchases); Titles = the source's 102 by name; Trainer Tokens, Mount/Back Decor/Follower (new to us). |
| R9 | Built modes' data | Campaign (main story rows), M8 modes (Tower **daily** reset, World Boss, Trials, Dungeons, Link Crystal **12★**), summoning rates/duplicates, shops, daily quests/sign-in, Arena/Ranked reward tables, Pet Home rows, Sky Pillar rows. |
| R10 | Close-out | Balance snapshot, e2e, docs, wiki. |

## Size
This is effectively re-doing the content of M2–M13.2: expect it to take longer than any milestone
so far. The engine, server boundary, screens and tests mostly stay; data and rules change.
