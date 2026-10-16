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
forms are listed. The `Skills` tab has real kits for **17** creatures (`Skills captured? = Yes`);
the other 67 have no captured skills.

## Pipeline

`scripts/import-roster.mjs` is the reproducible generator (`node scripts/import-roster.mjs`). It emits
`packages/content/species/<faction>.json` and `packages/content/kits/<faction>.json`.

- **Attribute → faction.** Fire→ember, Water→tide, Grass→grove, Dark→shade, Light alternates
  volt/frost (six factions, five attributes, joined on Light). Every faction is populated, which the
  PvE pools need.
- **Rarity → tier.** Rare→`rare`, Epic→`epic`, Legendary→`legendary`, Supreme→`supreme`,
  Mythic/Origin/Shiny Mythic→`mythic`. No creature lands on `common`; the gacha still works because it
  tolerates a sparse tier and the summoner fills boxes from the pool (no code change was needed).
- **Class.** Ported kits set their class from their kit (physical → striker, magical → adept, the tank
  → guardian); the rest cycle `striker → guardian → adept` by index.
- **Base stats.** A per-class template at `rare` scaled by a per-tier multiplier
  (`common .65 · rare 1 · epic 1.35 · legendary 1.8 · supreme 2.4 · mythic 3.2`).
- **Stages.** The sheet lists final forms only, so every creature gets three growth stages
  (`"<Name>"`, `"<Name> Prime"`, `"<Name> Zenith"`). This keeps evolution and the Link Crystal's
  "at final stage" gate meaningful (single-stage creatures would unlock the crystal immediately).
- **Description/palette.** Generated from name/attribute + a stable hash seed for the art generator.

## Skills

**17 creatures carry their real kits**; the other 67 use the three original class archetypes.

Each captured kit is a best-effort translation of the sheet into the five-slot content DSL
(`packages/content/src/schemas.ts`):

| Sheet | DSL |
|---|---|
| `Basic Attack` | `skills.normal` |
| `Basic Skill` | `skills.basic` |
| `Ult` | `skills.ult` |
| `Passive`, `Talent 1–4` | `talents` (stat mods + rage/crit hooks) |
| "single enemy" | `rule: 'column'` |
| "enemy frontline/backline" | `rule: 'row'` |
| "entire team" | `rule: 'all'` |
| "N random enemies" | `rule: 'random'`, `targets: N` |
| `N`% damage | `rates: [N/100]`, `type P/S` from P.ATK/S.ATK |
| Freeze / Stun / Confuse | engine control kinds `freeze`/`stun`/`confusion` |
| Flinch | `silence` |
| Paralyze | `paralysis` |
| Burning / Poison | `damageType: 'dot'` + `hpShare` (% max HP per turn) |
| "reduces ATK/P.DEF/S.DEF" | `targetDebuffs` on `dmgBoost`/`dmgRdct` |
| "converts N% to healing" | `lifesteal: N/100` |
| "survive fatal damage once" | `talents.safeguard { active: 1, cycle: 99 }` |
| Crit / Crit Res / Crit Intensity | `crit` / `critRes` / `critPower` |
| Block / Block Intensity / Guard Break | `block` / `blockPower` / `guardBreak` |
| HP/P.ATK/S.ATK %, Rage-on-hit | `talents.statMods`, `rageOnHit`, `rageCutChance` |

**Approximations (dropped, no DSL home).** Ally-wide buffs (backline Crit, ally ATK/Crit Res),
rage *generation* talents, buff cleanses, on-being-hit passives (Calyrex), conditional talents
(Strength-Ward, Lonewolf, Ruse), shields from talents, and heal-over-time (Regrowth). Heal amounts
were converted from "% of ATK" to a fraction of max HP (shipped `healBasis: targetMaxHp`). The 67
creatures without captured skills are honestly archetype kits, not invented move text.

## M1 parity kits as fixtures

The golden regression lock (`packages/cli/tests/golden/`) replays scenarios against the `tidewarden`
and `twigleaf` kits. So no original Wild is left in the shipped roster, those two kits now live as
fixtures in `packages/cli/tests/golden/kits/parity.json`; `golden.test.ts` and `pnpm golden-export`
load content kits **plus** that fixtures directory. The kits themselves are byte-identical, so the
baselines still replay.

## Ripple changes

- `packages/content/stages/chapter{1,2,3}.json` — enemy `speciesId`s remapped to common/rare/epic
  creatures and `stage` set to `0`, so chapters 1-3 stay clearable by a grown starter squad
  (`packages/server/src/campaign-balance.test.ts`).
- `packages/content/tuning/account.json` — `startingRoster` re-pointed at six low-tier creatures.
- `packages/content/tuning/pve.json` — world-boss rotation re-pointed at existing species ids.
- `packages/cli/src/validate-content.ts` — the "exactly six species per faction" rule is relaxed to
  "every faction has at least one species" (recorded in `docs/ASSUMPTIONS.md`).
- `packages/server/src/local-server.test.ts` — the granted-Wild fixture id moved to `kyogre`.
- Client/e2e text that named the old 36-Wild roster was updated.

## Tests

`pnpm check` is green: 253 unit tests, `content:validate` (84 species ↔ 84 kits), the golden lock,
and 50 Playwright tests.
