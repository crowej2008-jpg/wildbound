# Skill kits — combat DSL expansion + faithful port (M9)

Milestone 9. Expands the combat DSL with the primitives the owner's imported kits need, then re-ports
**all 84** creatures' kits from the captured skills sheet.

Reference read: `docs/design/combat.md` (the measured model and the M1 DSL), `docs/design/roster-import.md`
(the owner override and the 17-kit first port), `reference/game-rebuild/kb/stats-and-combat.md` (formula
shapes only) and the owner's sheet (`wiki-pokemon-skills-filled.xlsx`, scraped to `pokemon_skills.json`:
84 creatures × Basic Attack + Basic Skill + Ult + Passive (6 only) + Talent 1–4; **579 rows**).

## Why

The 17 kits ported in the override are best-effort: ally-wide buffs, rage generation, cleanses,
on-being-hit passives, conditional talents and heal-over-time were **dropped** because the DSL had no way
to express them (`roster-import.md` §Skills). The owner wants the effects *faithful*, not approximated, so
this milestone **expands the engine** instead of dropping effects — and finishes the port for every
creature, not just 17.

## Taxonomy of the sheet (what must be expressible)

Counted across all 579 rows:

**Targeting.** single (the column rule); all enemies; N random; frontline; backline; horizontal row;
enemies in a row/column; the opponent with **lowest HP** / **highest ATK** / **highest HP**; "N random in
the back row"; "the units next to the main target" (splash); "at the same position in its team" (Zacian);
allies (all teammates, the lowest-HP ally, a controlled ally); self.

**Damage / effects.** P/S rates with multi-hit ladders; **true damage** (13); **% of current / max /
missing HP** (5+); "% of S.ATK per turn" DoTs — burn, poison, frost, flame, bleed; DEF-shred / "armor
crunch"; extra damage vs a state ([DEF], DoT-affected, controlled, imprisoned); **recast-on-kill**;
damage/scaling per stack ("each mark increases N% S.ATK", "each layer provides N% dmg reduction").

**Control.** freeze (11), burn (14), poison (6), paralyze (8), silence (5), stun, flinch (5), sleep /
shallow sleep / nap / nightmare (16), confinement / darkness confinement (4), **taunt (forced targeting,
not a skip)**, seal (crit seal), petrification, confuse, bleed; **"cannot be dispelled" (13)**;
**immunity (11)**.

**Support.** heal (32); **heal-over-time / regen (8)**; shield (21); lifesteal / absorb (5);
**cleanse / dispel / purify (27 dispel + purify)**; reflect.

**Rage.** start at half/full; "N/N additional rage on normal/basic"; "N/N extra rage when hit"; "N%
chance to cut the attacker's rage"; steal / refund; "regenerates N% rage".

**Stacks / resources.** per-creature counters — Frost stacks, light energy, [sanction] marks,
[offer of power], [short circuit], [flame] stacks, [feather dance] layers, [zen control] — plus "each
stack deals true damage", "stacks up to N", "cannot be dispelled".

**Triggers.** on being hit (17); on death — ally / enemy / any (9); turn start (9); end of turn;
on kill; HP-below-half; battle start; **cooldowns (5)**; per-turn caps ("works up to N times per turn").

**Talents.** recurring stat bundles — "increases HP by N% and S.ATK by N%" (48×), "increases crit by N%,
crit res by N%, crit intensity by N%, block by N%, block intensity by N%, guard break by N%" (36×) — plus
the unique mechanic; most carry **(lv.N) ladders**.

## Principles

1. **Strictly additive.** Every new field is optional; absent = today's behaviour. The M1 golden lock, the
   parity fixtures (`tidewarden`/`twigleaf`) and the statistical tolerances must stay green **unchanged**.
2. **Engine stays pure.** New rolls go through `ctx.rng()`; no clock, no `Math.random`. New magnitudes are
   data, never code.
3. **Data over code.** Anything the sheet varies is a DSL field; global knobs become new `combat.json`
   settings mirrored in `DEFAULT_COMBAT_SETTINGS`.
4. **Every rule tested.** A unit test per primitive; a statistical test (with a tolerance) per new
   stochastic one; the validator keeps 84 ↔ 84 and cross-references every tag/op/condition.
5. **Honest remainder.** Only clauses with no faithful encoding are approximated, each recorded in
   `docs/ASSUMPTIONS.md`; the port script emits a machine-readable "unparsed clause" report.

## The v2 DSL (additive to the M1 shape)

### Targeting
- `rule` gains `frontline`, `backline`, `highest_hp`, `highest_atk`, `highest_spd`, `same_position`,
  `adjacent`.
- `side?: 'enemy' | 'ally'` (default `enemy`) selects the pool, so a skill can buff allies.
- `rowFilter?: 'front' | 'back'` narrows any rule (e.g. "N random in the back row").
- `filters?: ('dot' | 'controlled' | 'debuffed')[]`.
- `condition?: Condition` gates whether the skill resolves.

### Damage
- `hpShareBasis?: 'current' | 'max' | 'missing'` (default `current` — today's behaviour).
- `trueDamage?: boolean` — skips G/P/K/Soul/Team/classMult/weather, the crit/block rolls and shields.
- `ignoreShield?: boolean`; `ignoreDefense?: number` (a fraction, inert while `defendersUseDef` is false).
- `dot?: { share, basis: 'targetMaxHp' | 'casterAtk' | 'targetCurrentHp', type: 'P' | 'S', turns,
  maxStacks?, undispellable? }` — today's `hpShare` DoT maps to `basis: 'targetMaxHp'`.
- `bonusVs?: { condition: Condition; mult: number }` (extra damage vs a state).
- `recastOnKill?: { max: number }`.

### Effects list
`SkillDef.effects?: Effect[]`, resolved **after** the damage step, in order. Ops:
`buff`, `dot`, `control`, `heal` (with `over?: turns` → regen), `shield` (`basis: casterHp | casterAtk`),
`cleanse` (remove negative), `dispel` (remove positive), `rage` (`delta` / `pct` / `steal`),
`resource` (add / consume stacks), `revive`, `damage` (a secondary instance).
Each effect carries `target: TargetSel` (side + rule + n + filters + condition) and an optional `chance`.

### Conditions
`selfHpBelow` / `targetHpBelow` (fractions); `selfHasTag` / `targetHasTag`; `targetStackAtLeast {tag, n}` /
`selfStackAtLeast`; `targetControlled`, `targetHasDot`, `allyUnderControl`; `targetRow: front | back`;
`targetTrait: string` (matched against `kit.traits`).

### Talents / triggers
```jsonc
"talents": {
  "statMods": [],                                  // existing
  "rageOnHit": 0, "rageCutChance": 0, "safeguard": {},   // existing
  "rageStart": { "pct": 0.5 },                     // "gain half/full rage when engaged"
  "rageOnAction": { "normal": 0, "basic": 0, "ult": 0 },
  "passive": { "effects": [], "triggers": [] },    // the Passive slot (6 creatures)
  "triggers": [
    { "on": "beingHit", "chance": 0.4, "condition": {}, "effects": [],
      "cooldown": 0, "perTurn": 1, "once": false }
  ]
}
```
`Trigger.on` ∈ `battleStart · turnStart · endOfTurn · roundStart · beingHit · afterAction · onKill ·
allyDeath · enemyDeath · anyDeath · hpBelow · underControl · buffExpired`. All names are registered in
engine code; an unknown name is a validator error. `beingHit` fires from `channelHit` (it has the
attacker), death events from the death path, `turnStart`/`endOfTurn` from the round loop.

### Stacks / resources
New `Combatant.resources: Record<string, number>` with a `stack` buff kind (`clamp 0..max`,
`undispellable?`). Scaling and conditions read `resources[tag]`; effects add or consume it. This is the
home for Frost stacks, light energy, [offer of power], [sanction], [flame], [feather dance], [zen control].

### Cooldowns & caps
`cooldown?: { turns?: number; rounds?: number }` and `perTurn?` on effects and triggers.

### New stat fields
`CombatField` gains `pDef` / `sDef` (already on `StatSheet`, just exposed to buffs), so "reduce P.DEF" is
stored faithfully and becomes live only if `defendersUseDef` is switched on.

### Level ladders
The sheet's "(lv.N)" rows become `scalesWithLevel?: [level, value][]` on a stat mod, an effect magnitude
or a buff amount; absent = the flat base value.

## New settings (`packages/content/tuning/combat.json`)

| Setting | Shipped | Meaning |
|---|---|---|
| `defendersUseDef` | `false` (unchanged) | when true, `pDef`/`sDef` cut incoming damage on the `defK` curve |
| `defK` | tunable | half-point of the DEF curve |
| `dotTickTiming` | `ownTurnStart` (today) | when DoTs tick |
| `trueDamageIgnoresShield` | `true` | true damage bypasses shields |
| `cleanseOrder` | `oldestFirst` | which negative buffs a cleanse removes |
| `defaultResourceCap` | `99` | cap for a resource with no explicit `max` |

## Port pipeline

`scripts/port-skills.mjs` (committed, reproducible) turns `pokemon_skills.json` into content kits:

1. **Parse** each row with a rule library covering the sheet's recurring templates.
2. **Emit** `packages/content/kits/<faction>.json` with `effects` / `triggers` / DoTs / resources.
3. **Report** every clause no rule matched to `docs/design/skill-port-report.md` for hand-authoring.
   M9 is done when that residual list is empty (or each leftover is explicitly recorded in ASSUMPTIONS).
4. `scripts/import-roster.mjs` keeps owning species / base stats (unchanged).

Sheet → DSL slot map (extends `roster-import.md`): Basic Attack → `normal`, Basic Skill → `basic`,
Ult → `ult`, Passive → `talents.passive`, Talent 1–2 → `talents.statMods`, Talent 3–4 →
`talents.triggers` / `effects`. "(lv.N)" ladders → `scalesWithLevel`.

## Sub-steps (each its own commit; `pnpm check` green before the next)

1. **M9.1 Targeting + damage primitives** — new `rule`s, `side`, `rowFilter`, `filters`, `hpShareBasis`,
   `trueDamage`, `ignoreShield`, structured `dot`, `bonusVs`, `recastOnKill`.
2. **M9.2 Effects list + conditions + cleanse/dispel/immunity** — `effects[]`, `Condition`, `cleanse`,
   `dispel`, immunity wiring, `undispellable`.
3. **M9.3 Resources + scaling + cooldowns** — `resources`, `stack` kind, `scalesWithLevel`, `cooldown`,
   `perTurn`.
4. **M9.4 Talents** — `triggers[]`, `passive`, `rageStart`, `rageOnAction`.
5. **M9.5 DEF switch** — `CombatField` `pDef`/`sDef`, the `defK` curve behind `defendersUseDef`.
6. **M9.6 The port** — `scripts/port-skills.mjs`, parse 579 rows, close the report.
7. **M9.7 Re-tune** — campaign curve + `combat.json` deltas; re-run the statistical suite.

## Tests

- **Unit** per primitive: targeting shapes, each condition, each effect op, stack caps, cooldown and
  per-turn caps, every trigger hook.
- **Statistical**: DoT totals, resource accumulation, trigger rates, cleanse counts.
- **Validator**: 84 ↔ 84; every `tag` / `op` / `on` / `condition` referenced exists; `scalesWithLevel`
  monotone.
- **Golden**: parity fixtures byte-identical and replaying; the M1 golden lock unchanged.
- **Balance**: `packages/server/src/campaign-balance.test.ts` stays green (re-tuned in M9.7).

## Approximations policy

Only clauses with no faithful encoding are approximated. Each gets an ASSUMPTIONS entry with *what would
change it* — for example "[DEF] Pokémon" needs per-species traits the sheet does not carry, so it becomes
`targetTrait: 'def'` against an (initially empty) trait set; the bonus simply never fires until traits are
authored.
