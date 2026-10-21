# Growth and collection II (M11)

M11 deepens the five M7 layers and adds four account-level systems. The shape comes from
`reference/game-rebuild/kb/` (`potential`, `orbs`, `soul-hearts`, `berries`, `held-items`,
`plate`, `exclusive-trinkets`, `resonance`, `account-boosts`); names and numbers are ours
except where the owner supplied a catalogue (the nine soul-heart sets below).

Everything a player can tune lives in `packages/content`. The engine stays pure and takes the
tables as arguments; the server owns persistence and display views; the client renders and
calls actions. No screen ships with a dead button: an unbuilt hook says "coming later" and is
listed in `docs/SCOPE.md`.

## Renames (owner decision, 2026-10-20)

M7's internal names stay in code and save ids; only the player-facing labels change.

| M7 name | M11 label | Content file |
|---|---|---|
| Talents | **Potential** | `content/equipment/talents.json` |
| Runes | **Orbs** | `content/equipment/runes.json` |
| Spirit Cores | **Soul-hearts** | `content/equipment/cores.json` |
| Charms | **Berries** | `content/equipment/charms.json` |
| Relics | **Held Items** | `content/equipment/relics.json` |

New: **Plates**, **Trinkets**, **Resonance**, **VIP**, **Titles**.

## Resources (owner decision: source names)

`Rewards` is currency-only, so every spendable material is a `CurrencyId`. The two existing
core ids keep their meaning: `shard` = Wild star-up, `stone` = Link Crystal.

| Resource | Layer | Source role |
|---|---|---|
| **Potential Shards** | Potential | unlock/level tiers (duplicate Wilds pay the fodder) |
| **Orb Essence** | Orbs | buy orbs; levels also take duplicate orbs + gold |
| **Soul-heart EXP** | Soul-hearts | piece star-ups (2–5 stars) |
| **Berry Essence** | Berries | cultivate/star-up and dismantle |
| **Held Item Shards** | Held Items | levels |
| **Plate Bottles** | Plates | stages 0–5 and 7+ |
| **Plate Fragments** | Plates | the 5→6 step (source: 375 fragments) |
| **Star Shards** | Trinkets | levels 0–40 |
| **Resonation Shards** | Resonance | extra slots; the crystal itself pays candy/gold |
| **Title Tickets** | Titles | activating/continuing timed titles |

HUD keeps its seven currencies; the new ones live on their layer screens and the Trainer
screen's materials row.

## Shared rules

- **Save v10.** M11.1 added the materials (save v7), M11.5 replaced the single Berry slot with
  two (save v8), M11.7 added `plates` (save v9), and M11.8 added `trinkets` (save v10). Later
  sub-steps add `resonance`, `titles` and `vip`; every migration fills defaults and re-derives
  derived gates on load.
- **One Wild screen, seven tabs:** Upgrade, Evolve, Potential, Orbs, Soul-hearts, Berries,
  Held Items. Plates and Trinkets sit under the Held Items tab's sub-tabs (gear owned by the
  Wild screen) so the tab strip stays usable on a phone.
- **Stat sheet.** The Wild header shows Power plus HP / P.ATK / S.ATK / P.DEF / S.DEF / SPD and
  the percent lines that matter. Each gear tab shows the layer's contribution and the Power
  delta from removing it.
- **Every layer line is a named setting or authored data.** Set-effect timing (turn 3, round
  4, etc.) lives in `content/tuning/combat.json` where it affects combat.
- **Unlock gates** are data in `content/tuning/equipment.json` / `collection.json`; an unmet
  gate shows the requirement, not a disabled mystery button.

## Layer scope

### Potential

Nine tiers, three options per tier, one pick per tier. The existing 15 class trees remain the
catalogue (per-species trees are too much authored content for M11; recorded as an
assumption). Unlocking a tier costs **duplicate copies of the same species** (fodder) plus
**Potential Shards**; re-picking an unlocked tier costs a flat respec fee. Fodder must not be
the Wild itself, locked, or in a squad; the lowest-level duplicate is consumed first. Reset costs
gems, refunds the shard ladder, and does **not** return the consumed fodder. Costs live in
`content/tuning/collection.json`.

### Orbs

Keep the four sockets. Orbs have levels 1–6 and four qualities. Levelling consumes two copies
of the same orb (same kind/level, unsocketed) plus gold, or Orb Essence as the fallback. Set
bonuses pay at 2 and 4 equipped pieces. Sockets are per-Wild and free to swap.

### Soul-hearts

Six sockets, one piece per socket, qualities 2–5 stars. A piece's lines scale with its stars;
star-up consumes `expBase + (stars − 1) × expPerStar` Soul-heart EXP (2★→3★ = 80 by default).
Set bonuses pay at 2/4/6 pieces. The M11 catalogue is the owner's nine sets:

| Set | 2 pieces | 4 pieces | 6 pieces |
|---|---|---|---|
| Common | Soul-heart DEF +10% | Soul-heart ATK +10% | DMG reduction +10% on entering battle |
| Flying | Control res +10% | Control res +25% | Control Immunity at the start of turn 3 and every 3rd turn after |
| Fire | +10% damage vs shielded enemies | +30% damage vs shielded enemies | Puncture at the start of turn 3 and every 3rd turn: attacks ignore/nullify shields that turn |
| Superpower | Sp.Atk +10% | Crit intensity +20% | Sp.Atk +30% |
| Water | First round only: Soul-heart DEF +50%, DMG reduction +25% | Restore 25% HP at the end of rounds 4/8/12 | 50% chance to heal 10% max HP when attacked |
| Bug | Lifesteal 5% | Lifesteal 12% | Lifesteal 25% |
| Thunder | Guard break +10% | Guard break +25% | Attacks have a 10% chance to inflict paralysis |
| Rock | Soul-heart DEF +15% | DMG reduction +15% | Restore 10% HP at turn start |
| Grass | Shield 20% max HP at battle start | 50% of excess healing becomes shield | +20% damage while carrying a shield |

**Same-stat ladders take the highest tier, not the sum** (owner decision): Bug at 6 = 25%
lifesteal, Flying = 25% control res, Superpower = +30% Sp.Atk, Rock = 15%, Fire = +30% vs
shields. Distinct effects at 2/4/6 all apply.

**M11.4 built.** `SoulheartHooks` carries the effects a stat line cannot express, so the engine
does not fake them: shield damage bonuses, puncture/immunity cadence, round/turn/on-hit heals,
paralysis, starting and overheal shields, first-round guards, and battle-start stat multipliers.
`foldLoadout` returns one folded `soulheart` payload plus display text. The 2/4/6 lines are
`bonuses[]` on each `CoreSetDef`; every set has six socket-specific pieces. Three 2★ Common
pieces are in the starting inventory so a fresh account can see the 2-piece bonus.

### Berries

Two slots (source has two). Berries are equipped consumables; a real battle consumes one copy
per occupied slot, preview battles do not. Four tiers with four designs each; Commons are fixed,
the rest star up with duplicate copies + Berry Essence. Dismantling pays Berry Essence, and
equipped copies are protected. Costs live in `content/tuning/collection.json` (`berries`).

**M11.5 built.** `Loadout.charms` is now a two-entry array (save v8 migrates the old single
`charm` into slot 1). `equipCharm` targets a slot and refuses to equip more copies than the
account owns. Star-up consumes `upgradeCopies` spare copies plus
`upgradeEssenceBase + (stars − 1) × upgradeEssencePerStar` Berry Essence. Dismantle pays the
tier's `dismantleEssence` for one spare copy. The starting inventory seeds the four Commons and
four Basics; Emberfruit starts at 1★ so the star path is playable immediately.

### Held Items

Class-locked, three lines, one conditional effect. Levels 1–60 in M11 (the reference's 200 is a
later extension). Levelling pays Held Item Shards; refining upgrades the effect with
Held Item Shards + gold. Moving a worn item between Wilds asks for confirmation.

**M11.6 built.** `equipment.json` raises the cap to 60. A level-up costs
`5 + 2 × (level − 1)` Held Item Shards; a refine costs `800 + 400 × refine` gold and
`10 + 10 × refine` Held Item Shards. The effect is active at base strength and scales +20% per
refine. The screen shows the shard balance, `Lv n/60`, the next level/refine costs and keeps the
existing move confirmation. Both caps return an `at_level_cap` error.

### Plates

One plate per Wild, keyed to the species' element. Stages 0–20. Stages 0–5 and 7–20 pay Plate
Bottles; 5→6 pays Plate Fragments. Stats are flat/percent lines. The source's stage-6 skill
swap is out of scope for M11 and shown as "coming later" on the plate card.

**M11.7 built.** `content/equipment/plates.json` has six plates (one per faction), each with two
authored lines. The Wild's species faction selects the plate; stage 0 adds nothing. A level costs
`10 + 5 × stage` Plate Bottles, except the 5→6 step which costs 375 Plate Fragments. `plates` is
per-Wild save state (v9) and survives migration. The plate card sits under the Held Items tab's
Plates sub-tab and shows stage, next/final lines, both balances, the next cost, and the deferred
stage-6 skill swap. The plate folds into Power and real battles even when the Wild has no stored
loadout.

### Trinkets

One signature trinket per species, levels 0–40, paid with Star Shards. Flat HP/P.ATK/S.ATK
lines with a small species-flavoured percent line. Shiny variants are cosmetic and deferred.

**M11.8 built.** `content/equipment/trinkets.json` has one keepsake per species (84), each with
flat HP / P.ATK / S.ATK lines and one authored percent line (Strikers: Crit Intensity, Guardians:
DMG Reduction, Adepts: Skill Boost). Level 0 adds nothing; a level costs `10 + 5 × level` Star
Shards. The level is keyed by species id, so every copy of that species shares it. The trinket
folds into Power and real battles even when the Wild has no stored loadout. The Trinkets sub-tab
shows the level, next/final lines, Star Shard balance, next cost, the shared-copy rule, and the
deferred shiny variant. `trinkets` is save state (v10) with a `{}` migration default.

### Resonance

Six slots. Two open; the rest cost Resonation Shards. A slotted Wild gains a share of the Link
Crystal's level as a stat bonus (the reference shares the crystal's level directly; our
per-Wild level economy cannot absorb an instant max level, so the share is an explicit,
tunable percentage — recorded as an assumption). The crystal itself keeps its M8 candy/gold
upgrade.

### VIP

Account level track fed by lifetime XP/spend-equivalent activity. Each tier grants a badge and
small, data-driven perks (idle cap, shop discount, free-draw count). No real money ever.

### Titles

Three slots: Common, Premium, Rare. A title is permanent or timed; timed titles last 7 or 14
days and expire lazily on load/open. At max stage, a timed title offers **Continuation**, which
pays a Title Ticket to extend from `max(now, expiresAt)`. Stats are flat HP/P.ATK/S.ATK or
percent Total lines. M11 ships:
- permanent trainer-star and collection titles from existing milestones;
- **King of Arena** (7d) and **Alliance Champion** (14d) from the existing Arena/Ranked modes;
- guild-war and event titles in the catalogue as locked "coming later" rows (M15/M16).

The 15-stage event ladder is schema-supported but has no live source until events.

## Sub-steps

| Step | Deliverable |
|---|---|
| M11.0 | Retrofit the five M7 screens (new labels, stat sheet, layer deltas, server tests, e2e equip→Power) |
| M11.1 | Currencies, save v7, Trainer tab replacing More, materials row |
| M11.2 | Potential: fodder, shards, 9 tiers, reset — **built** |
| M11.3 | Orbs: levels, duplicates, Orb Essence, 2/4 sets — **built** |
| M11.4 | Soul-hearts: nine sets, effects, star-up — **built** |
| M11.5 | Berries: two slots, stars, dismantle — **built** |
| M11.6 | Held Items: levels 1–60, refine — **built** |
| M11.7 | Plates |
| M11.8 | Trinkets |
| M11.9 | Resonance |
| M11.10 | VIP |
| M11.11 | Titles |
| M11.12 | Docs, balance pass, full e2e, `pnpm check` |

Each step ends green and commits. Acceptance for every layer: unit tests prove its lines change
a battle outcome, its screen exists, and every unbuilt hook shows an honest "coming later".

## Assumptions to record in `docs/ASSUMPTIONS.md`

1. Class trees stand in for per-species Potential trees.
2. Orbs keep four sockets (source has up to twelve).
3. Held Items cap at 60 for M11 (source 200).
4. Resonance grants a stat share, not an instant level.
5. Same-stat set ladders take the highest tier.
6. Timed titles expire on lazy load/open, no scheduler.
7. Plate stage-6 skill swap and shiny trinkets are deferred.
8. VIP is activity-driven; there is no real-money path.
