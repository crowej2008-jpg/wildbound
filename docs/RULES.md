# Rules

Every gameplay rule with its evidence level and, where applicable, its tuning setting name.
Evidence levels: **seen** (measured in the reference research), **fitted** (reference fitted it),
**inferred** (reference inferred), **open** (unsettled in the reference), **own** (our design).

The canonical combat settings table lives in `packages/content/tuning/combat.json`
(definitions in PROMPT.md Appendix A). Growth and Power tables live in
`packages/content/tuning/{growth.json,power.json}`.

## Engine invariants

| Rule | Evidence | Setting | Milestone |
|---|---|---|---|
| Deterministic engine: seeded PRNG + injected clock; no `Math.random`/`Date` | own (PROMPT §2.2) | n/a | M0 foundation, enforced from M1 |
| Deterministic mode forces every roll to `0.999999` (no crit/block/chance control; guaranteed `null` control still lands) | own | n/a (engine mode) | M1 |
| Buff duration has one dimension: `turns` ticks at holder turn end; `bigRounds` at big-round end | own | `buffTickTiming: "ownTurnEnd"` | M1 |

## Combat

| Rule | Evidence | Setting | Milestone |
|---|---|---|---|
| Big-rounds of SPD-ordered turns; mid-round wipe break; time-out after N rounds goes to the defender | fitted | `maxRounds`, `tieBreak: "attackersFirst"` | M1 |
| Two damage pipelines (P/S) with ATK × rate vs DEF; PvP floor/constant applied | fitted | `pFloor`, `pvpConst`, `defendersUseDef` | M1 |
| Crit chance `critSlope × (crit − critRes)` clamped, ×`critBaseMult` power | fitted | `critFloor`, `critSlope`, `critBaseMult` | M1 |
| Block is piecewise on `block − guardBreak` after `blockPoints` breakpoints, keeping `blockKeep` | fitted | `blockPoints`, `blockKeep`, `blockIntScale` | M1 |
| Ult/skill boost-vs-reduction lines are additive pairs | inferred | `ultBoost/ultRed`, `skillBoost/skillRed` | M1 |
| Rage: per-action gain; defender gains proportional rage on unshielded loss; flat `rageHitBase` for direct hits; `rageOnHit`/`rageCutChance` (cut `rageMax/8`) | fitted | `rageStart`, `rageStrikerStart`, `rageMax`, `ragePerAction`, `rageHitBase`, `rageHitScale`, `ultRageCost` | M1 |
| Control suite (silence/confusion/paralysis/stun) resolves through Control Res; immunity (safeguard) windows; confusion self-redirect; confined/untargetable units | inferred | `controlBoost`, `controlRes`, `redirectChance` | M1 |
| Counter/reflect deals `counterShare` of the incoming hit back | fitted | `counterShare` | M1 |
| Healing scales off the chosen basis; shields scale off caster max HP | open | `healBasis`, `shieldCountsForRage` | M1 |

## Growth and Power (M2)

| Rule | Evidence | Setting | Milestone |
|---|---|---|---|
| Stat formula is multiplicative: `base × levelCurve × starMult × evolutionMult × qualityMult` (our model; the reference is linear) | own | `tuning/growth.json` | M2 |
| `levelCurve = 1 + (level−1)×levelGrowth`; level 1 → 1 | own | `levelGrowth` | M2 |
| `starMult = 1 + (stars−1)×starStep`; star 1 → 1 | own | `starStep` | M2 |
| Level cap is per evolution stage | own | `maxLevelByStage` | M2 |
| Evolution and quality multipliers index by stage and tier | own | `evolutionMult`, `qualityMult` | M2 |
| Power `= floor(F×(1+E)+A)` where `F = Σ coreRate/10 × stat`, `A = Σ powerRate/10 × value`, `E = Σ extRate/100000 × value` | fitted (shape) | `tuning/power.json` | M2 |
| Team Power is the plain sum of the six members' Power | own | n/a | M2 |
