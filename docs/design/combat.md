# Combat engine design note

Milestone 1. Ports the measured combat model to `packages/engine/src/combat`.

Sources (re-read in this order before coding):

| Need | File |
|---|---|
| Measured model, formulas, open questions | `reference/game-rebuild/kb/stats-and-combat.md` |
| Arena rules (15 rounds, defence is a stored copy) | `reference/game-rebuild/kb/pvp-arena.md` |
| Audited hypothesis register (confirmed / refuted / open) | `reference/game-rebuild/spec/combat-hypotheses-2026-10-05.md` |
| 1,278 saved fights: control, crit, block, order, targeting, Rage, sustain, time-out | `reference/game-rebuild/live/sessions/2026-10-04-offline-mining.md` |
| Restated spec + Appendix A settings | `PROMPT.md` §6 and Appendix A |

The Python reference simulator (`reference/sim/battle_sim.py`, `kits.py`) is absent from this
machine (documented in `docs/ASSUMPTIONS.md` §1). PROMPT §6 is therefore the authoritative
restatement, and every unsettled number is a named setting in `content/tuning/combat.json`
mirrored by `DEFAULT_COMBAT_SETTINGS` in the engine.

## Battle shape

- Big round = all living units act once, effective SPD descending, re-sorted every round.
  A unit that cannot act still gets its slot (a skip; no action Rage, no skill).
- Ties: attacker side first, then position (assumption — setting `tieBreak`).
- Winner: attackers win only if every defender is dead by the end of `maxRounds`; otherwise
  defenders win (time-out — 274/274 observed). If a side is wiped mid-round, that decides it.

## Damage pipeline (per hit)

`raw = atk × rate` where atk is exactly proportional to the attack stat (P or S per skill).

`dmg = raw × G × P × K × Soul × Team × classMult`, floored at `gFloor`/`pFloor`.

- **G** = `max(gFloor, 1 + attacker.dmgBoost − target.dmgRdct)` (additive pair, measured).
- **P** = PvP only: `max(pFloor, 1 + attacker.pvpBoost − target.pvpRdct − pvpConst)`.
- **K** = `1 + ultBoost − ultRed` for ults, `1 + skillBoost − skillRed` for basics, else 1.
- **Soul** = `1 + soulCap·x / (|x| + soulHalf)`, `x = attacker.spiritAtk − target.spiritDef`.
- **Team** = `min(1, (ownPower ÷ enemyPower) ÷ tpThreshold)`; only the weaker side is cut
  (`tpSymmetric=false`). Powers are inputs to the battle (Power itself lands in M2).
- **classMult** = class-matchup table, default empty (`classMult` setting).

Crit and block roll independently (independently confirmed). Then `final = max(1, floor(dmg))`,
min with target current HP.

- **Crit**: rate `clamp(critSlope × (crit − critRes), critFloor, 1)`; multiplier
  `max(critBaseMult, critBaseMult + critPower − 0.5 × critRes × (1 − ignore))`.
  In PvP the 1.2 floor wins almost always.
- **Block**: rate piecewise-linear over `target.block − attacker.guardBreak` through
  `blockPoints` (measured: ~3% at ≤ −40, ~50% at +50, 100% at +100). Kept
  `max(0, blockKeep − blockIntScale × attacker.blockPower)`; with defaults a blocked hit keeps
  exactly 80%. The held-damage question (does kept% apply before or after floors) is an
  assumption: **before the final floor** — see `docs/ASSUMPTIONS.md`.
- **Percent-of-max-HP** skills: `dmg = hpShare × maxHp`, every factor and both rolls ignored.
- **Weather**: a battle-level `±dmg` modifier applied per faction set (Ranked's +30% for one
  faction).

## Rage & skill choice

- Bar 1,000. Start `rageStart` (500) except Strikers (1,000 — a Striker's first action is its ult).
- Normal/basic action: attacker `+ragePerAction` (250). Ultimate: `rage = max(0, rage − 1000)`.
- Being hit: `rageHitBase + floor(rageHitScale × hpLost ÷ maxHp)`, where **hpLost is the actual
  HP loss** (the shielded part does not count; observed). The flat base still applies on a hit
  even when a shield ate it.
- On its action: rage ≥ 1000 → cast ultimate if the unit has one; otherwise basic replaces normal
  with `basicReplace` (0.20); else normal attack.
- Traits (data): `rageOnHit` extra on being hit; `rageCutChance` chance to cut the attacker's
  Rage by `rageMax ÷ 8` (i.e. 125); per-class `ragePerAction` modifiers.
- A controlled skip gives no action Rage; controlled units still gain Rage when hit (observed).

## Controls & status

- Guaranteed controls (no stated chance) ignore Control Res; only an immunity buff stops them.
- Chance controls: `p = clamp(chance × (1 − (target.controlRes − attacker.controlBoost)), 0, 1)`.
- Hard controls (freeze/stun/sleep/confinement/taunt-like) cost exactly one own turn, never
  refresh or stack while live, and grant no post-control immunity.
- **Confusion**: the holder acts; its normal attacks hit its own side with `redirectChance`
  (the source game's Mind Control: ~82% allies); ultimates are never redirected.
- **Silence**: no ultimate.
- **Paralysis-like**: casts its ultimate if Rage is full, else skips.
- Buffs/debuffs: same tag → refresh duration, never stack; stacking buffs carry a per-stack tag
  capped at N. Durations tick at the end of the holder's own turn (`buffTickTiming`).

## Sustain

- `heal = base% × target.maxHp × (1 + healer.healBoost) × (1 + target.receiveHealBoost)`
  (Treatment multiplies, receive-treatment adds — observed).
- Shields: `share × caster.maxHp`, absorb first, do not count toward the Rage hpLost term.
- Lifesteal: `heal = damage dealt × rate`.

## Counter reflect

`floor(counterShare × T × (1 + counterBoost))`, T = HP the caster lost across the previous big
round from any source (shield-soaked loss excluded), none in round 1. A separate HP change after
the base hit: no factor, no shield, no crit, no block; every target of the hit takes the full
amount. Default `counterShare = 0.75`.

## Kits (DSL)

JSON in `packages/content/kits`, validated by zod (`schema.ts` in the content package):

- skills: `slot`, `type`, `rates[]`, `rule` (`column|row|all|lowest_hp|random|self`), `targets`,
  `hpShare`, `damageType`, `control {kind, chance|null, turns?, redirectChance?}`,
  `selfBuffs[]`, `targetDebuffs[]`, `counter`, `heal {target, rate, group?}`,
  `shield {target, share}`, `lifesteal`, `dot {share}`.
- talents: `statMods[]`, `rageOnHit`, `rageCutChance`, `safeguard {active, cycle}`, `turnHooks[]`.
- turn hooks are named and registered in engine code; unknown names are a zod/refinement error.
- E1 (2026-10-31): triggers `onCrit`, `onBlocked`, `onDealDamage`, `onControlled`,
  `onInflictControl`, `afterNormal|afterBasic|afterUlt`, `maxFires`; conditions `round`,
  `targetHasAnyTag`, `selfControlled`; `target.event`; heal bases `casterSAtk`, `casterCurrentHp`;
  buff kind `rageBlock`; stats `atkPct`, `ignoreBlock`, `basicRate`. Units may also carry gear
  `triggers[]` and `damageMods[]` (`{tag, slot?, condition?, chance?, dmg?, atk?, ignoreBlock?}`).

Appendix B's `tidewarden` ships as `content/kits/tidewarden.json` with its required tests.

## Event log

Typed, append-only events (PROMPT §6.8): `roundStart`, `action {unit, skill}`, `hit`, `reflect`,
`heal`, `shield`, `buffApplied`, `buffExpired`, `control`, `rageChange`, `death`, `immunity`,
`roundEnd`, `result`. A skipped turn logs `action {skill: null}`. Every battle carries a
`battleId` and the `seed`.

## Golden

The Python reference and its tests are missing, so PROMPT §6.9's parity suite cannot run today.
The committed M1 substitute is a deterministic regression suite: `pnpm sim:golden` runs
deterministic battles (crit, block and chance controls forced off), writes expected JSON to
`tests/golden/`, and a Vitest suite replays the same squads and seeds and must reproduce
winner, rounds and per-unit damage exactly. When `reference/sim` arrives, run it on the same
inputs and diff the event fold — that becomes the real §6.9 gate.

Statistical behaviour (crit rate, block rate, chance controls, basic-skill replacement, Rage-cut
chance) is tested over 20,000 trials with stated tolerances rather than matching a Python RNG.