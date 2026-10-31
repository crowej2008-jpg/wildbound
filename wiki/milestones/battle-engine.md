---
title: Battle engine completion (E1–E6)
type: milestones
updated: 2026-10-31
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
| E3 | The ~180 kit clauses `docs/PORT-REPORT.md` records as not modelled (68 per-action Rage, 12 empty triggers, ~110 one-off rules) | next |
| E4 | Skill levels LV.2+ (24 skills) — model them if the source ties them to stars | pending |
| E5 | Re-check the open combat numbers against the kb (faction bonus ×1.43 vs ×1.25, crit slope, class matchups, heal basis) | pending |
| E6 | Tests + campaign/PvP balance re-check | pending |

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
