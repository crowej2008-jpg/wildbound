---
title: Source retrofit (R) — make built systems match the source exactly
type: milestones
status: in progress — R0, R1, R5 done; resumes 2026-11-01 with R4 after the battle-engine pause; runs before M13.3
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
`gacha_cfg`, `afk_cfg`, `pet_home_cfg`, `modepages-*_cfg`, …; full list in `docs/SOURCE-TABLES.md`), with human notes in
`reference/game-rebuild/kb/<system>.md` ("Current picture" sections). Each step adds a
`scripts/import-<system>.mjs` that reads those tables and writes `packages/content/…` JSON, committed
like the existing generators, so the copy is reproducible and checkable. Use `loadTable(name)` /
`tableRows(name)` from `scripts/source/source.mjs` (set `WILDBOUND_SOURCE` if the dumps are staged
elsewhere).

**Saves:** reset, not migrated, until the retrofit ends — each step that changes the save shape
bumps `SAVE_VERSION`, `MIN_SAVE_VERSION` and `tests/e2e/save-version.ts` together.

**Keep (owner exceptions):** the 84-Pokémon roster/kits, his nine Soul-heart sets, Held Item Shards,
his refine ladder, no real money.

## Steps (each: build → `pnpm check` → wiki + commit; no list-and-wait since 2026-11-01)
| Step | System | What changes (from the kb notes) |
|---|---|---|
| R0 ✅ | Import pipeline | **Built 2026-10-31:** `scripts/source/source.mjs` + `docs/SOURCE-TABLES.md` (377 tables); saves **reset** (v18, `MIN_SAVE_VERSION`). |
| R1 ✅ | Pokémon growth | Source level costs (XP Candies + Gold), level caps up to 340 then via Resonance, evolution lines (e.g. Bulbasaur → Ivysaur → Venusaur instead of Prime/Zenith), star/evolution fodder (own + same-faction copies at set stars), 30/40/50 shards per Pokémon, source base stats/classes, trainer level table (no 80 cap), bag size. |
| R2 | **Gear** (missing today) | 64 pieces = 16 tiers × 4 slots (Core, Cube, trinket slot, Wings), Smithy 3 → 1 crafting with gold, orange/red named sets. Artifact gear (Evo Stones) waits for artifacts. |
| R3 ✅ | Orbs | 12 kinds × 5 colours = 60 orbs; **2 sockets per gear piece** with family typing; caps +3/+5/+7/+10; level = 2 copies + gold ladder; Quick Upgrade; 26 sets (3- and 5-kind, pay at Lv 3/5/7/10); dismantle → Orb Essence. Opens player Lv 50, slots at 9★. **Built 2026-11-01** with stand-ins for the missing orb tables (owner OK; save v23) — `docs/design/orbs.md`. |
| R4 ✅ | Potential | 62 Pokémon (Legendary+) with per-Pokémon trees (15 distinct); tier N at 6+N★; source Potential Shard table (e.g. tier 1: 20,000 unlock … 360,000 total); fodder; reset 16 💎. **Built 2026-11-01** (save v22) — `docs/design/potential.md`. |
| R5 ✅ | **Held Items** | 75 source items (Choice Band, Scope Lens, Icy Rocks…), class-locked, Supreme+ wearers; main stat + 1–6 random lines from the 31-line pool; **re-roll refine** (keep/drop) on Mythic 3 / Supreme 2 slots with the **owner's ladder**; level cap 200 with the source shard table; lock; dismantle 5/8/10/15/20 shards; album. Adds Resetter Shards → Resetters (20 → 1). |
| R6 | Berries, Plates, Trinkets, Soul-hearts | Berries: 19, four tiers, Commons uncultivatable, flat dismantle 50/40. Plates: per type (18 types), stages 0–18, source Bottle/Fragment costs, opens player Lv 34. Trinkets: per Pokémon skills at Lv 10/20/30/40, 300,430 Star Shards to Lv 40, trinket chests. Soul-hearts: keep the owner's nine sets, copy the source's sockets/stars/EXP rules. |
| R7 | Resonance | Crystal evolves at Lv 340; cap 340 + 8 per 12★ Pokémon; 2 free slots, source price ladder (30, 80, 100…), 24h slot cooldown (4 💎/hour to clear); slotted Pokémon **use the crystal's level**. |
| R8 | Account layers | VIP 0–40 from Privilege XP (daily activity's 120-point chest pays 60; no purchases); Titles = the source's 102 by name; Trainer Tokens, Mount/Back Decor/Follower (new to us). |
| R9 | Built modes' data | Campaign (main story rows), M8 modes (Tower **daily** reset, World Boss, Trials, Dungeons, Link Crystal **12★**), summoning rates/duplicates, shops, daily quests/sign-in, Arena/Ranked reward tables, Pet Home rows, Sky Pillar rows. |
| R10 | Close-out | Balance snapshot, e2e, docs, wiki. **Geared tier re-check** (owner 2026-11-01): every Supreme/Mythic/Origin maxed and fully geared through `scripts/balance/tier.ts`; passes when the meta six (God Ash Pikachu, Wobbuffet, Greninja, Shiny Blastoise, Psyduck, Origin Lugia) come out on top — see [E6 tier list](../systems/e6-tier-list.md). **Mode difficulty curves** (moved from E6): campaign, gyms, Tower, Trials, Dungeons, World Boss, Sky Pillar, Arena, Ranked on the copied data — to find bugs, not to retune. |

## R1 — Pokémon growth (built 2026-10-31; owner said "go", stand-ins for the two missing tables)
Source tables: `hero_basic_json` (84 rows), `hero_evolution_json` (1,386 star rows), `_text` (English
names), plus `pokemon-growth.md` / `stats-and-combat.md` notes.
- **Identity:** each species' faction from `race` — the source has **5** (Water, Fire, Grass, Light,
  Dark), not our 6 (Light was split into volt/frost); class from `career` (ATK / DEF / SKILL — ours were
  cycled); quality from `potential` (13 Rare … 17 Mythic, **18 Origin** — a tier we don't have).
- **Star ladder:** the source's per-species star rows (e.g. Darkrai 5★–23★) replace our 1–10★ +
  `Prime/Zenith` stages: each star's level cap (60 … 340), base stats (`growth_attr`), skills, and the
  card name/evolution line (Beldum → Metang → Metagross).
- **Star-up / evolution cost:** the source fodder rules (own copies + same-faction copies at set stars).
- **Shards:** one shard item per species; 30 / 40 / 50 shards make a Pokémon.
- **Not in the dumps:** the per-level XP-candy/gold table (only "Lv 1→2 = 48 candy + 143 gold" is known)
  and the trainer-level table (only cumulative XP at a few levels). Needs the owner to re-extract them,
  or a recorded stand-in.
- Ripple effects: PvP weather, plates, trinket lines, mode enemy pools and campaign squads all key off
  faction/class and get updated in the same step. Kits stay the owner's (M9).

## R5 — Held items (built 2026-10-31)
Owner: *"lets just go off of what we know"* (Gear/Orbs from notes later; R5 first because its data is
complete). Built as listed above, with three gaps recorded: the album (tables not dumped), 24 skills
the round-effect DSL can't express (text only), and the starting items (three Rares until the Vault).
Save v20. Details: [held items](../systems/held-items.md).

## Data check before R2 (2026-10-31)
Complete in the dumps: Potential, Held Items, Berries, Plates, Trinkets, Resonance, Titles (VIP partly).
**Missing:** Gear (8 of 64 piece rows, no set table) and Orbs (no basic/set/socket tables). Proposed
order: R5 Held Items → R4 Potential → R6 → R7 → R8 while the owner re-extracts the gear and orb
tables, then R2 / R3.

## R6 plan (2026-11-01, after the data check)
R6 is mostly a **skill-porting job** (like E3), so it splits into four steps, one session each:
- **R6a Plates** — part 1 ✅ 2026-11-01 (stats, costs, gates, names); part 2 = skills. Stats per stage (stone_up_stage, complete), costs and gates (kb: player Lv 34, Pokémon 6★),
  18 types × 3 grades by the card's type, and the plate skills at tiers 6 / 12 / 18 (~230 texts, 78 Pokémon;
  hero_stone_skill) plus the stage-6 skill swaps (hero_slate_skill, 6 rows).
- **R6b Trinkets** — 81 trinkets, Lv 0–40 for 300,430 Star Shards, stats by level (30 sets), skills at Lv 10 /
  20 / 30 / 40 (~320 texts), trinket chests; Origin trinkets are stats only.
- **R6c Soul-heart rules** ✅ (2026-11-01, save v24) — the owner's nine sets stay; 4 qualities, star caps, star EXP, 10★ unlock.
- **R6d Berries** — tables complete except the berry skills (19 berries × 5 stars, texts in kb / wiki): two
  slots, Elevation (stars), Cultivate (15 elements, caps by breakthrough stage), Breakthrough (trainer Lv
  40–60), Reforge (locks), reset.

## Size
This is effectively re-doing the content of M2–M13.2: expect it to take longer than any milestone
so far. The engine, server boundary, screens and tests mostly stay; data and rules change.
