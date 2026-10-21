# Equipment layers (M7)

> **M11 update (2026-10-20):** the player-facing labels changed to **Potential, Orbs,
> Soul-hearts, Berries and Held Items**; code ids and save fields are unchanged. The M7
> screens described here were not actually wired until **M11.0**. See
> `docs/design/collection.md` for the M11 deepening and new layers.

Five layers sit on a Wild, each its own tab on the Wild screen, and all five funnel the
same thing into battle: **stat lines** (flat core values, fractional percent lines, soul
stats) plus, for some layers, one **conditional round effect** that fires part-way into a
fight. The engine owns every rule; the server owns persistence; the client only renders.

Reference: `reference/game-rebuild/kb/held-items.md`, `orbs.md`, `berries.md`,
`soul-hearts.md`, `potential.md`, `artifacts.md`. PROMPT §7.3. Names and numbers here are
original; only the *shape* of each system is taken from the research.

## Vocabulary and data

Everything an instance needs is **data** in `packages/content/equipment/*.json`; the engine
takes the tables as arguments (it never imports content, keeping the package pure).

```ts
type StatKind = 'core' | 'percent' | 'soul';
interface StatLine { kind: StatKind; field: string; base: number; perLevel: number }
type StatDelta = { core: Partial<CoreStats>; percent: Partial<PercentLines>; soul: Partial<SoulStats> };
interface RoundEffect { tag: string; field: CombatField; add?: number; mult?: number; fromRound: number; bigRounds?: number }
```

A `StatLine` is `base + perLevel × (value − 1)` where `value` is the instance's level (relics,
runes), its stars (charms, cores) or 1 (talents). Each layer's catalogue is a definition
list; an account owns *instances* of relics/runes/cores and *counts* of charms.

## The five layers

- **Relics** (held items). Unlock: the Wild is **Supreme** or **Mythic** (`relic.minTier`).
  A relic design is class-locked and only designs of the Wild's class show in the picker.
  Each design carries stat lines (scaled by its level 1–60) and one conditional effect
  (`RoundEffect`) that is active at base strength and scales +20% per refine. Level-up costs
  Held Item Shards (`5 + 2 × (level − 1)`); refine costs gold + Held Item Shards
  (`800 + 400 × refine` / `10 + 10 × refine`). Moving a worn relic between Wilds asks for
  confirmation in the UI.
- **Runes** (orbs). Unlock: `runes.minStars`. `rune.sockets` sockets per Wild; a Wild may
  swap runes for free. Four colour qualities are the *design* tier; every rune levels 1–6.
  Each rune belongs to a set; **M11.3 re-authored every set at 2/4 pieces** (the old single
  3-piece threshold is gone). Level-up consumes two same-kind, same-level unsocketed copies plus
  gold, or the Orb Essence fallback.
- **Charms** (berries). Unlock: `charms.minStars`. Consumables, four tiers
  (Common/Basic/Intermediate/Greater) with four designs each. Commons are fixed (no stars);
  higher tiers scale with stars. M11.5 gives each Wild **two Berry slots**; a real battle
  consumes one copy per occupied slot (`challengeStage`), while preview battles (`startBattle`)
  do not consume. Star-up spends duplicate copies + Berry Essence; dismantling a spare copy
  pays Berry Essence.
- **Spirit Cores** (soul-hearts). Unlock: `cores.minStars` (reference: 10). Six
  socket-specific pieces; qualities 2–5 stars. The M11 catalogue is the owner's nine sets
  (Common, Flying, Fire, Superpower, Water, Bug, Thunder, Rock, Grass). A 2/4/6-piece count
  grants the set's stat lines and its `SoulheartHooks` effects. Star-up consumes Soul-heart
  EXP (`expBase + (stars − 1) × expPerStar`). Their stats feed the soul factor.
- **Talents** (potential). Unlock: `talents.minTier` (Legendary+). A Wild picks one of
  three options on each of nine tiers of a shared 15-tree catalogue; options are static
  battle stat lines (never shown on the growth sheet). New tiers cost duplicate Wilds +
  Potential Shards (M11.2); resetting costs gems and refunds the shard ladder, not the fodder.

## How a line reaches battle

`foldLoadout()` folds every equipped item into one `StatDelta`, a `RoundEffect[]` and a
folded `SoulheartHooks` payload with display text. Same-stat soul-heart ladders keep only the
highest reached tier; distinct 2/4/6 effects all apply. `packages/server/src/battle.ts`
merges the delta into the `SheetInput` built by `sheetOf()` (core stats add, percent lines
add, soul stats add), passes the round effects as `SpecInput.roundEffects` and the soul
hooks as `SpecInput.soulheart`. At the start of each big round the engine applies any
`RoundEffect` whose `fromRound` matches; `combat/soulheart.ts` handles the dynamic hooks
(shield damage, puncture/immunity cadence, heals, paralysis, starting/overheal shields and
battle-start multipliers). Every layer is covered by a test that runs a battle and asserts
the outcome changes in the intended direction.

## Unlock gates and costs

All gates, costs and socket counts live in `packages/content/tuning/equipment.json`. The
Wildscreen hides a tab whose gate is unmet and shows the requirement instead of a stub.

## Assumptions

- Rune/charms star gates and all costs are not stated by the reference; chosen to match the
  M3 growth curve and recorded in `docs/ASSUMPTIONS.md`.
- The reference's 19 berries and 12 orb kinds are narrowed to 16 and 16 to fit the shipped
  content size; the shape is unchanged. The owner supplied all nine soul-heart sets used in M11.4.
- Spirit-core pieces are generated from the nine authored set definitions (six pieces each)
  rather than stored one-by-one.
