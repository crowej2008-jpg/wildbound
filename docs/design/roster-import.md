# Roster import (owner override, 2026-10-15)

This note records how the owner's Pokémon-themed roster was imported to replace the 36 original Wilds.
It is the "system note" for the content override required by the working agreement.

## Why (policy)

The owner explicitly overrode PROMPT §2.1 ("Originality / IP") for this **private, never-distributed**
build, because the game's creatures are to be the roster they collected (`wiki-pokemon-skills.xlsx`,
mirrored from their own wiki). The rule text in `PROMPT.md` and `AGENTS.md` was amended, the IP guard
in `packages/cli/src/ipguard.ts` was scoped to the remaining franchise terms (see
`docs/ASSUMPTIONS.md` → "Owner content override"), and all of it is recorded in `docs/CHANGELOG.md`.

## Source

The sheet's `Roster` tab: **84 rows** of `name · rarity · attribute` (attribute ∈ Light, Dark, Fire,
Grass, Water; rarity ∈ Rare, Epic, Legendary, Supreme, Mythic, Origin, Shiny Mythic). Only final
forms are listed. The sheet's `Skills` tab was **not** ported: our five-slot kit DSL and class
identities are original, and copying another game's skill text is exactly what the rule still
discourages. Skills are therefore generated from the three class archetypes.

## Pipeline

`scripts/import-roster.mjs` is the reproducible generator (`node scripts/import-roster.mjs`). It emits
`packages/content/species/<faction>.json` and `packages/content/kits/<faction>.json`.

- **Attribute → faction.** Fire→ember, Water→tide, Grass→grove, Dark→shade, Light alternates
  volt/frost (we have six factions and the sheet has five attributes joined on Light). Every faction
  is populated, which the PvE pools need.
- **Rarity → tier.** Rare→`rare`, Epic→`epic`, Legendary→`legendary`, Supreme→`supreme`,
  Mythic/Origin/Shiny Mythic→`mythic`. No creature lands on `common`; the gacha still works because
  the retained `twigleaf` kit is `common` (so the tier is never empty).
- **Class.** Cycled `striker → guardian → adept` by index within the import for a deterministic mix.
- **Base stats.** A per-class template at `rare` scaled by a per-tier multiplier
  (`common .65 · rare 1 · epic 1.35 · legendary 1.8 · supreme 2.4 · mythic 3.2`).
- **Stages.** The sheet lists final forms only, so every creature gets three growth stages
  (`"<Name>"`, `"<Name> Prime"`, `"<Name> Zenith"`). This keeps evolution and the Link Crystal's
  "at final stage" gate meaningful (single-stage creatures would unlock the crystal immediately).
- **Description/palette.** Generated from name/attribute + a stable hash seed for the art generator.

## Retained M1 parity kits

The golden regression lock (`packages/cli/tests/golden/`) replays scenarios against the `tidewarden`
and `twigleaf` kits, so those two kits keep their mechanics **byte-for-byte**. They re-use the sheet's
matching creatures (`Kyogre`, `Sceptile`) for the display name and are otherwise unchanged. Their
faction/class/tier stay as shipped, so the two creatures may not match the sheet's rarity (Sceptile
displays as `common`) — a deliberate trade to keep parity.

## Ripple changes

- `packages/content/stages/chapter{1,2,3}.json` — enemy `speciesId`s remapped to common/rare/epic
  creatures and `stage` set to `0`, so chapters 1-3 stay clearable by a grown starter squad
  (`packages/server/src/campaign-balance.test.ts`).
- `packages/content/tuning/account.json` — `startingRoster` re-pointed at six low-tier creatures.
- `packages/content/tuning/pve.json` — world-boss rotation re-pointed at existing species ids.
- `packages/cli/src/validate-content.ts` — the "exactly six species per faction" rule is relaxed to
  "every faction has at least one species" (recorded in `docs/ASSUMPTIONS.md`).
- Client/e2e text that named the old 36-Wild roster was updated.

## Tests

`pnpm check` is green: 253 unit tests, `content:validate` (84 species ↔ 84 kits), the golden lock,
and 50 Playwright tests.
