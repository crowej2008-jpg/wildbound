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
  Each design carries stat lines (scaled by its level 1–5) and one conditional effect
  (`RoundEffect`), enabled by refining. Level up costs gold + candy; refine costs gold +
  stones. Moving a worn relic between Wilds asks for confirmation in the UI.
- **Runes** (orbs). Unlock: `runes.minStars`. `rune.sockets` sockets per Wild; a Wild may
  swap runes for free. Four colour qualities are the *design* tier; every rune levels 1–6.
  Each rune belongs to a set; holding 3 of a set grants the set's 3-piece lines.
- **Charms** (berries). Unlock: `charms.minStars`. Consumables, four tiers
  (Common/Basic/Intermediate/Greater). Commons are fixed (no stars); higher tiers scale with
  stars. A charm is equipped in one slot and **consumed once per real battle**
  (`challengeStage`); preview battles (`startBattle`) do not consume.
- **Spirit Cores** (soul-hearts). Unlock: `cores.minStars` (reference: 10). Six
  socket-specific pieces; four qualities (2–5 stars). A 2/4/6-piece count grants the set's
  bonus lines and its battle skill (a `RoundEffect`). Their stats feed the soul factor.
- **Talents** (potential). Unlock: `talents.minTier` (Legendary+). A Wild picks one of
  three options on each of nine tiers of a shared 15-tree catalogue; options are static
  battle stat lines (never shown on the growth sheet). Resetting costs gems and clears the
  picks.

## How a line reaches battle

`loadoutDelta()` folds every equipped item into one `StatDelta`; `loadoutEffects()` returns
the `RoundEffect[]`. `packages/server/src/battle.ts` merges the delta into the `SheetInput`
built by `sheetOf()` (core stats add, percent lines add, soul stats add) and passes the
effects as `SpecInput.roundEffects`. At the start of each big round the engine applies any
effect whose `fromRound` matches, as an additive/multiplicative stat change (permanent) or a
timed buff (`bigRounds`). The conditional effects are therefore the *only* new combat
surface, and every layer is covered by a test that runs a battle and asserts the outcome
changes in the intended direction.

## Unlock gates and costs

All gates, costs and socket counts live in `packages/content/tuning/equipment.json`. The
Wildscreen hides a tab whose gate is unmet and shows the requirement instead of a stub.

## Assumptions

- Rune/charms star gates and all costs are not stated by the reference; chosen to match the
  M3 growth curve and recorded in `docs/ASSUMPTIONS.md`.
- The reference's 19 berries, 12 orb kinds and 18 soul-heart sets are narrowed to 16, 12 and
  12 to fit the shipped content size; the shape is unchanged.
- Spirit-core pieces are derived from 12 set definitions rather than authored one-by-one.
