---
title: Battle engine completion (E1–E6)
type: milestones
updated: 2026-11-01
status: done 2026-11-01
sources: [owner 2026-10-31 "could we take a break on the current milestone and finnish all of the battle enigine", docs/PORT-REPORT.md]
---

# Battle engine completion (E1–E6)

Owner (2026-10-31), mid-retrofit: *"could we take a break on the current milestone and finnish all of
the battle enigine"* → plan agreed ("ok"). The [source retrofit](source-retrofit.md) pauses after R5;
R4 Potential resumes afterwards.

| Step | What | Status |
|---|---|---|
| E1 ✅ | New battle triggers and rules (below) | built 2026-10-31 |
| E2 ✅ | All 27 held-item skills active in battle ([held items](../systems/held-items.md)) | built 2026-10-31 |
| E3 ✅ | The kit clauses the parser could not express — 68 kits hand-ported | built 2026-10-31 |
| E4 ✅ | Origin skill levels LV.2 / LV.3 + per-species shards (pulled forward from R9) | built 2026-10-31 |
| E5 ✅ | Re-check the open combat numbers against the kb (faction bonus ×1.43 vs ×1.25, crit slope, class matchups, heal basis) | built 2026-10-31 ([combat numbers](../systems/combat-numbers.md)) |
| E6 ✅ | Tests + campaign/PvP balance re-check | done 2026-11-01: base-kit [tier list](../systems/e6-tier-list.md), Dialga measured, action Rage fixed (+125 / SKILL +250). Mode curves and the geared tier check moved to R10 — R9 replaces every mode's data with the source's, so tuning now would be overwritten. |

Not in scope (wired when their systems are retrofitted): Potential options (R4), plate stage-6 skill
swap and trinket skills (R6), gear/orb set skills (R2/R3).

## E1 — what the engine gained (strictly additive; golden replays unchanged)
- **Triggers:** `onCrit`, `onBlocked`, `onDealDamage` (fires before the target's Rage gain),
  `onControlled`, `onInflictControl`, `afterNormal` / `afterBasic` / `afterUlt`; `maxFires` (once per
  battle); gear can add triggers to a unit (`SpecInput.triggers`) on top of its kit's.
- **Conditions:** `round {from, until, even}`, `targetHasAnyTag`, `selfControlled`.
- **Damage modifiers** (`SpecInput.damageMods`): per-hit `dmg` (into the additive G pair), `atk`,
  `ignoreBlock`, gated by slot / condition / chance.
- **Stats:** `atkPct` (+% P.ATK and S.ATK), `ignoreBlock`, `basicRate` (adds to the basic-skill chance).
- **Buff kind** `rageBlock` (no Rage gain; cleansable). **Heal bases** `casterSAtk`, `casterCurrentHp`.
- **Targeting:** `target: { event: true }` = the unit the trigger's event is about.
- Tests: `packages/engine/src/combat/e1.test.ts`; CI 522 unit / 90 e2e.

## E3 — kit clauses (built 2026-10-31)
- **Parser fixes** (`scripts/port-skills.mjs`): Rage talents are shares of the 1,000 bar — "1/8 additional
  Rage when hit" is **125** (it was read as 1 point in 19 kits); per-action Rage ("normal attacks / basic
  skills generate 1/2 additional Rage", "ultimates generate 1/4") is now granted; "Crit strength" =
  Crit Intensity and "Break" = Guard Break (they were Crit / missing); "+X% ATK" buffs are attack %
  (they were tiny flat adds).
- **Hand ports:** `scripts/data/build-kit-overrides.py` → `kit-overrides.json` rewrites the skills and
  Passive / Talent 3 / Talent 4 rows of **68 kits**; Talent 1–2 stay parsed.
- **Engine:** round cadence, disarm / flinch / nap / crit seal / mind control, endure + invulnerable,
  defend and scaled damage mods, P/S damage reduction, stacking DoTs, targeted immunities, extra actions,
  splash, shield break, layers spent on hit, ally-crit trigger, buffable lifesteal, SPD buffs move turn order.
- **Still not modelled:** 46 bespoke clauses, each listed by kit in `docs/PORT-REPORT.md` (e.g. Deoxys's
  damage transfer, Feraligatr's damage sharing, Rayquaza's mark strikes, Jirachi's Doom Desire, effects
  on DEF which has no effect). Tests: `combat/e3.test.ts`; CI 541 unit / 90 e2e.
- **Owner readings since:** Mew / Shiny Mew gain their Talent 4 Rage from every fallen enemy, not only
  their own kills (2026-10-31, "i want it as every enemies").
- **Owner changes:** Snorlax, Mimikyu, Dialga — see [kit changes](../decisions/kit-changes-2026-10-31.md).

## E4 — Origin skill levels and species shards (built 2026-10-31)
- Source: only the six Origins buy skill levels — ult, basic skill, passive, Talent 4 — LV.2 50 / LV.3
  100 of their own shards. Ordinary Pokémon don't (their talents step up with stars; tier texts not dumped).
- Owner: *"lets do per pokemon shards as with the origin skills"*; shard source: *"No source until R9"*.
- Built: `speciesShards`, compose on the Evolve tab, Skills tab for Origins, the 24 LV.2/LV.3 rows in
  battle (`applySkillLevels`; gaps in `docs/PORT-REPORT.md`). Save v21. ASSUMPTIONS #61.

## E5 — combat numbers (checked 2026-10-31)
Result page: [combat numbers](../systems/combat-numbers.md). Changed: symmetric team-Power cut, Block INT
on the blocker, Counter passes shields, Wobbuffet's Counter 75%, Ranked `baseLevel` 16 (golden
baselines re-exported). Seven questions stay open, each with the test that would answer it.
