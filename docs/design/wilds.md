# Wilds, growth, stats and Power

M2 system note. Read before editing `packages/content/species`, `packages/content/tuning/growth.json`,
`packages/content/tuning/power.json`, or `packages/engine/src/growth`.

## Goal

Author 36 original Wilds (six per faction) with kits, and give the engine a deterministic, data-driven
stat and Power model so the roster and gallery can show real numbers at every level, star and stage.

## Species (content)

One file per faction in `packages/content/species/<faction>.json`, each an **array** of six species.
Every species:

| Field | Meaning |
|---|---|
| `id` | stable, lowercase, unique; equals its kit id and its art seed source |
| `name` | canonical display name (the capitalized `id`); may differ from any stage name |
| `stages` | 1–3 display names, index = evolution stage (0 → base form) |
| `faction` | `ember \| tide \| grove \| volt \| frost \| shade` |
| `class` | `striker \| guardian \| adept` |
| `tier` | `common \| rare \| epic \| legendary \| supreme \| mythic` |
| `description` | one original sentence, IP-guard clean |
| `paletteSeed` | integer; the procedural art generator's seed |
| `base` | core stats seed: `hp, pAtk, sAtk, spd, pDef, sDef` |

The roster is 6 species per faction spanning all three classes and all six tiers. **Update
(2026-10-15):** the owner overrode the IP rule and the roster is now the imported creature list (no
longer a balanced six per faction, and no `common`-tier species) — see `roster-import.md`.

## Kit identity (content, DSL from PROMPT §6.7)

Each species has one kit in `packages/content/kits/<faction>.json` (an array), id-matched to the
species and sharing its faction/class/tier. Class identities:

- **Strikers** — high Rage start (engine), single-target burst, row sweeps, lowest-HP hunters.
- **Guardians** — high HP, DMG RDCT, counters, ally shields, taunts, safeguards, Rage manipulation.
- **Adepts** — controls (guaranteed + stated chance), debuffs, heals, team buffs, %max-HP skills.

Required archetypes in the set (PROMPT §9.2): counter Guardian (`tidewarden`), guaranteed-freeze
Adept, stated-chance control Adept, a healer, a shield support, a lowest-HP hunter, a row sweeper, a
%max-HP skill user, and a periodic-immunity tank.

## Stat formula (engine, `packages/engine/src/growth/stats.ts`)

```
stat = round( base[stat]
            * levelCurve(level)
            * starMult(stars)
            * qualityMult[tier]
            * evolutionMult[stage] )
levelCurve(level)   = 1 + max(0, level - 1) * levelGrowth
starMult(stars)     = 1 + (max(1, stars) - 1) * starStep
```

All four factors are data in `tuning/growth.json` (`levelGrowth`, `starStep`, `qualityMult`,
`evolutionMult`, `maxLevelByStage`, `maxStars`). No constant is hard-coded in the engine.

**Deviation from the reference.** The reference measures a *linear* naked stat
(`basic_attr + level × growth_attr` + milestone flats, per star card), with stats-per-level held as
species constants. PROMPT §7.1 asks for a multiplicative `base × curve × star × quality × evolution`
model, so we use that instead and keep only the *shape* (smooth, monotonic, tier/stage-scaled) from
the reference. Percent equipment lines layer on top later (M7) via the combat `SheetInput`, not here.

## Power (engine, `packages/engine/src/growth/power.ts`)

The reference's Power formula is reconstructed exactly from `kb/stats-and-combat.md`:

```
Power = floor( F × (1 + E) + A )

rows with attr_type_2 == 1 (HP, P.ATK, S.ATK, P.DEF, S.DEF):  F += (power_rate / 10) × value
every other weighted row:                                     A += (power_rate / 10) × value
                                                              E += (ext_rate / 100000) × value
```

Weights live in `tuning/power.json` (the `power_rate` / `ext_rate` rows, plus a `scale`). Percent
lines are stored as ratios (1.0 = 100%); the reference stores them in hundredths of a percent, so the
engine multiplies a percent ratio by `scale` (10000) before weighting. HP/ATK % lines are attribute
type 1 in the reference and count into `F` there; in our model the core `F` uses the resolved core
stats and the percent rows use `A`/`E` (documented as a simplification — the difference is negligible
at our scale and the `%→F` fan-out returns with equipment in M7).

Team Power is the sum of the six fighters' Power; the engine already accepts `power` as an input to
the team-Power damage factor (`tpThreshold`).

## Determinism

`resolveCoreStats` and `computePower` are pure: no clock, no RNG. Given the same species, level,
stars, stage and tuning they always return the same numbers.
