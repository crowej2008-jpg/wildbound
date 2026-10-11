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

## M3

1. **Progression is a deliberate simplification of the reference.** We model stars as a single
   1..`maxStars` axis that multiplies stats (`starStep`) and gates evolution, rather than the
   reference's per-quality star caps; evolution has ≤3 stages (our species `stages.length`); and star
   material is the generic `shard` currency rather than species-copy fodder. Cost curves
   (`candyCost = round(base × level^exponent)`, `gold = candy × goldPerCandy`; `starUp` linear in
   star) match the reference *shape* (Lv1→2 ≈ 48 candies + ~3× gold), not its exact tables. All values
   live in `tuning/growth.json`.
2. **Respawn refusal rules** follow the reference (`kb/pokemon-growth.md`): refused when the Wild is
   locked or present in any squad; it resets level to 1 and refunds `refundRate` (0.8) of invested
   candy+gold, keeping stars and evolution stage.
3. **Starting account is authored data** (`tuning/account.json`): name, starting currencies, and a
   6-Wild seed roster of commons. Starting candy/gold are sized so the M3 e2e can level a Wild to its
   evolution requirement; this is a debug/dev convenience, not a balance decision.
4. **Squad strategies are stored but inert.** `aggressive | balanced | defensive` persist per squad;
   their combat effect (basic-skill rate / targeting) is deferred to M4 when battle setup reads squads.
5. **HUD is intentionally partial in M3.** The player card shows name + level only; the reference's
   avatar, VIP badge and trainer XP bar are deferred to the M5 loop (XP is tracked but not awarded).
6. **`LocalServer` is single-account and client-authoritative-for-now.** One save key, autosaved after
   every mutation, with a one-step backup. Account ids are `w<seq>`; `nextInstanceSeq` guarantees no
   reuse. A real backend (`HttpServer`) arrives only if M12 is not deferred.

## M4

1. **Battle playback folds the log; it never re-simulates.** A battle is generated once (server-side
   `runBattle`) and stored as `{ units, events, winner }`. The client's replay reducer (`initReplay`/
   `stepReplay`/`replayTo`) derives every frame from the first *n* events, so a recorded fight replays
   identically on every run (PROMPT §6.1). "Playback speed" only changes the clock, never the outcome.
2. **Shield bars are approximate.** The engine logs a `shield` event's `shieldAfter` but not the
   absorption of later hits (a `hit` event's `hpAfter` already nets any shield). The replay therefore
   shows the shield badge from the last `shield` event and does not decrement it per hit. Will be
   exact when the engine logs shield absorption explicitly.
3. **The enemy is a mirrored echo squad.** Until the campaign supplies real defender lists (M5), the
   M4 battle fields the player's own squad (reversed order) as a fair, deterministic opponent, so a
   fresh account always has something to fight. The battle seed is server-side randomness
   (`config.rng()`), injectable for tests and library replays.
4. **Minimal vertical slice.** M4 ships the lowest complete level: one campaign replay with play/pause,
   speed, step, restart, skip, HP/rage bars, popups, a compact result panel and a log drawer. Team
   preview, weather/round banner art, buff tooltips and deeper result panels are deferred (see
   docs/SCOPE.md, docs/design/battle-ui.md).
5. **Squad strategies remain inert.** Carried from M3 #4: `aggressive | balanced | defensive` persist
   but battle setup does not yet read them; their combat effect lands with a later milestone.

## Carried from the reference (to be resolved per system)

- When a reference doc says `(inferred)` or `(open)`, the item becomes a named combat
  setting (Appendix A) and is surfaced in the Build Lab Rules panel.
- Conflicts between reference docs: prefer the later-dated or audited statement; record the conflict here.