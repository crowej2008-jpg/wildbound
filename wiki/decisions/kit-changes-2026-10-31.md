---
title: Owner kit changes (2026-10-31)
type: decision
date: 2026-10-31
status: built
sources: [owner chat 2026-10-31, docs/ASSUMPTIONS.md #59-60]
---

# Owner kit and combat changes (2026-10-31)

Made while reviewing the [E3 hand-port readings](../milestones/battle-engine.md). Each is the owner's
own change to a source skill (see [copy the source exactly](copy-the-source-exactly.md)).

| Pokémon | Sheet | Owner's words | Built |
|---|---|---|---|
| Mew / Shiny Mew T4 | "every 1 fallen enemies restore 25% Rage" | *"i want it as every enemies"* | Rage on any enemy death, not only Mew's kills |
| Snorlax ult | "the lower self HP, the higher the damage, capped at 60%" | *"make it 2% damage per 1% lost"* | +2% damage per 1% HP lost, no cap |
| Mimikyu T4 | "Extra attacks do not gain Rage" | *"make the extra attacks give rage"* | extra actions gain the normal action Rage — which, after the rule below, is 0 for Mimikyu (Striker) |
| Dialga ult | "Grant backline allies 200 rage" | *"fill all team members including himself rage bar to the max"* | every ally, Dialga too, to 1,000 after the ultimate |

**Dialga fallback (not built).** A friend of the owner suggested Dialga's ultimate fill only Dialga and 2 allies. The owner: keep it as built; "if we decide dialga is too broken we will change and test this". E6 checks Dialga's numbers specifically.

Code: `scripts/data/build-kit-overrides.py` (comments name the date). Tests: `packages/cli/src/port.test.ts`.

## Combat rule
| Rule | Source | Owner's words | Built |
|---|---|---|---|
| Team-Power cut | a team well below the other's Power deals less damage (both sides) | *"i dont want there to be a cut for weaker teams against stronger teams"* | no cut (`teamPowerCut` false) |
| Action Rage | every Pokémon gains +250 Rage from a normal attack / basic skill (measured, all classes) | *"pokemon only get +250 rage if they are a skill class"* | only SKILL class (`adept`) gains it; Strikers and Guardians gain 0 (`ragePerActionClasses`) |
