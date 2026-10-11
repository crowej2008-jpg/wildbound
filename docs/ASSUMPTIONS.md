# Assumptions & open questions

Every entry says (a) what we assumed, (b) why, (c) what would change it. Combat-affecting
assumptions are also named settings in `packages/content/tuning/combat.json` (M1+, currently empty).

## M0

1. **The Python simulator is missing.** `reference/sim/battle_sim.py`, `kits.py`, `test_battle_sim.py`
   and `test_kits.py` do not exist anywhere on this machine (whole-user-profile search). The
   reference model is therefore taken from `kb/stats-and-combat.md`, `kb/pvp-arena.md` and
   `spec/combat-hypotheses-2026-10-05.md` until the owner drops the simulator into `reference/sim/`.
   Consequence: M1 parity tests (= TS twins of `test_*.py`) and `sim:golden` cannot be scripted
   against the Python files; they will encode the documented numbers + reconstructed formulas
   instead, and be reconciled when the files arrive.
2. **Reference is not committed to git.** `reference/` (~37 MB of research text) is in `.gitignore` so
   a clone stays lean and OneDrive doesn't sync 700 MB of media. Every session starts by confirming
   the reference tree exists. Any clean clone needs `reference/` restored from the owner's repo.
3. **Feature text strings are English-first through `t()`.** Localisation scaffold ships in M0
   (`packages/client/src/i18n`); only English exists. Additional locales later.
4. **`tsconfig.typecheck.json` uses DOM libs + `react-jsx` for all files** so one `tsc -p` gate covers
   engine, server, cli and client together. Node-only packages never use DOM APIs; the DOM lib being
   present is harmless and keeps the CLI a single, honest command.
5. **`pnpm check` includes a Playwright browser download on install** (postinstall). A clean clone
   needs network once for the Chromium binary; afterwards `pnpm check` passes offline (modulo new deps).
6. **The IP-guard term list lives once in `packages/cli/src/ipguard.ts`** and both the canonical suite
   (`tests/ip-guard/ip-guard.test.ts`) and `content:validate` read the same table. Only
   `ipguard.ts`/`ipguard.test.ts` are exempt from the text scan, because the guard must list the terms
   to reject.

## M1

1. **Golden parity is a deterministic TS replay, not Python parity.** Same root cause as M0 #1
   (`reference/sim/` absent). `pnpm golden-export` records the folded event log for every scenario in
   `packages/cli/tests/golden/scenarios/`; `packages/cli/src/golden.test.ts` replays deterministic
   battles and must match exactly. Replace/augment with true cross-language parity when the Python
   files arrive.
2. **Deterministic mode forces every roll to `0.999999`.** Chosen so replay is byte-stable and so
   chance-based events are *off* by construction: no crit, no block, no chance control. Guaranteed
   controls (`chance: null`) still land. Recorded as engine behaviour, not a content setting.
3. **Buff duration has exactly one dimension.** `turns` ticks at the end of the holder's own turn
   (`tickUnitBuffs`); `bigRounds` (DoT, confusion) ticks at big-round end (`tickBigRoundBuffs`). A
   buff never carries both. Named setting: `buffTickTiming: "ownTurnEnd"`.
4. **Rage on damage.** The defender gains proportional rage `floor(rageMax × unshieldedLoss ÷ maxHp)`
   for any source including reflect/DoT (not hp-share); the flat `rageHitBase` only for direct hits.
   Placement/`rageOnHit`/`rageCutChance` (cut = `rageMax/8`) are measured values, tunable in
   `tuning/combat.json`.
5. **Every uncertain combat number is a named setting** in `tuning/combat.json` (Appendix A) so the
   Build Lab Rules panel can surface it later: floors (`gFloor`, `pFloor`, `pvpConst`), soul caps,
   crit (`critFloor`, `critSlope`, `critBaseMult`), block (`blockPoints`, `blockKeep`, `blockIntScale`),
   `basicReplace`, rage values, `counterShare`, `redirectChance`, and the booleans (`tpSymmetric`,
   `defendersUseDef`, `healBasis`, `shieldCountsForRage`).

## M2

1. **The stat formula is multiplicative, deviating from the reference.** The reference
   `pokemon_data_cfg.json` model is linear (`basic_attr + level × growth_attr`, plus per-star flat
   cards and `evolution_up_percent` 5–20%); PROMPT §7.1 asks for
   `base × levelCurve × starMult × evolutionMult × qualityMult`. We implement the requested
   multiplicative model with all factors as data in `tuning/growth.json`. Base stats were authored
   from a tier table (HP/ATK by tier) × a per-class factor profile, plus a small deterministic jitter
   from the species id — chosen so the 36 Wilds are balanced and reproducible, not copied.
2. **Power weights are our own fit of the reference shape.** The reference exposes
   `attr_power_weight` rows (a core `power_rate` and a percent `ext_rate`); we keep that shape
   (`F/A/E`, `scale`) but supply our own weights (`tuning/power.json`). `scale` only shifts the
   constant term and is not load-bearing.
3. **Kits group by faction.** M1 shipped one kit per file; M2 groups six per faction file as arrays.
   The loader accepts both shapes. The two M1 kits (`tidewarden`, `twigleaf`) are preserved
   byte-identically except that `twigleaf` gains a `talents.rageCutChance` (the ≥1-talent quality
   bar); that talent is inert in deterministic mode, so the M1 golden replay is unchanged.
4. **`paletteSeed` is authored data.** Each species carries an explicit integer seed rather than
   hashing its id at render time, so portrait colours stay stable even if an id ever changes.
5. **Five content dirs remain empty** (`items`, `stages`, `shops`, `quests`) — they land in later
   milestones and the validator emits a warning, not an error, for them.

## Carried from the reference (to be resolved per system)

- When a reference doc says `(inferred)` or `(open)`, the item becomes a named combat
  setting (Appendix A) and is surfaced in the Build Lab Rules panel.
- Conflicts between reference docs: prefer the later-dated or audited statement; record the conflict here.