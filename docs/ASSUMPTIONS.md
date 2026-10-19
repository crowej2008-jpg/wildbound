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
4. **Squad strategies are stored but were inert.** `aggressive | balanced | defensive` persist per
   squad; their combat effect (skill preference / targeting) goes live in **M10** (opt-in via
   `BattleConfig.strategies`, default `balanced` = old behaviour) — see `docs/design/pvp.md`.
5. **HUD is intentionally partial in M3.** The player card shows name + level only; the reference's
   avatar, VIP badge and trainer XP bar are deferred to the M5 loop (XP is tracked but not awarded).
6. **`LocalServer` is single-account and client-authoritative-for-now.** One save key, autosaved after
   every mutation, with a one-step backup. Account ids are `w<seq>`; `nextInstanceSeq` guarantees no
   reuse. A real backend (`HttpServer`) arrives with **M19** (now required — see item 9 of the owner
   content override and `docs/SCOPE.md`).

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

## M5

1. **The campaign difficulty curve is authored for the M5 roster and was re-tuned here.** Before this
   pass, chapters 2-3 fielded legendary/mythic/supreme enemies at 2-4 stars and stage 2-3 while the
   starter roster is six *commons* and summoning is deferred to M6 — so a fresh account could not clear
   chapter 1 beyond stage 2, failing the M5 done criterion ("play from first launch to chapter 3"). The
   18 stages were re-authored to use only common/rare species with a gentle level/star curve: chapter 1
   is clearable with the starting budget, chapter 2 after ~1-2 simulated days of idle + daily quests, and
   chapter 3 as income accrues. `campaign-balance.test.ts` pins a grown squad (Lv26, 3 stars, stage 1)
   clearing through the end of chapter 3; see docs/design/balance.md. *Why:* the milestone's done
   criterion is explicit and M5 has no summoning. *What would change it:* M6+ adds stronger obtainable
   Wilds, so later chapters can field higher tiers; the curve should be revisited then.
2. **`debugClockOffset` is minutes, converted to milliseconds only at the clock boundary.**
   `debugAdvanceClock(n)` stores `n` minutes; `LocalServer.now()` and the Idle screen compute
   `clock + offset × 60_000`. This replaces an early units bug where the offset was added as
   milliseconds (so fast-forwarding did nothing); `m5.test.ts` now fast-forwards 12h and claims a full
   idle cap to lock it. *Why:* the debug buttons are labelled in hours and the save field is documented
   in minutes. *What would change it:* nothing — this is the intended unit.
3. **Daily reset rolls over on the UTC day key.** Quests, activity points and the quick-collect counter
   reset when `dayKey(now)` changes (`@wildbound/engine/src/daily`). *Why:* PROMPT §5 fixes the game
   clock to UTC; the header shows a UTC clock. *What would change it:* the reference's local-server
   reset time, if it proves different.
4. **Idle is capped and hand-claimed.** 12h cap, 3 quick collects/day for gems, per-minute rate from the
   best cleared stage. *Why:* simplest loop that matches the reference's "offline income" shape without
   its auto-collect. *What would change it:* an auto-collect or a different cap in the reference.
5. **Starting account remains a dev convenience.** `tuning/account.json` seeds 40k candy / 120k gold /
   20 stones / 200 shards so a session can level and evolve immediately; the M5 curve above is sized
   against it. *Why:* carried from M3 #3. *What would change it:* a server-driven account with real
   onboarding rewards (M19).


## M6

1. **A duplicate draw grants a fresh instance, not shards.** The reference converts duplicate
   Wilds into fodder/shards; Wildbound has no duplicate-conversion sink yet (equipment layers are
   M7), so every draw appends a new `WildInstance`. `isNew` is decided by whether the species was
   already in the roster *before the batch*; the same species drawn twice in one batch is new once.
   *What would change it:* an M7+ duplicate→shard rule, which would replace this in one place.
2. **The wish is species-level, not faction-level.** `setWish` picks one species of the pool; inside
   its tier that species' weight is `wishBoost ×` the others. The reference's wish shape is
   broader. *What would change it:* a faction/quality wish if the Build Lab surfaces one.
3. **`wishUnlockDraws = 0`.** The reference gates the wish behind ~200 lifetime draws; the tuning
   field exists (and gates `applySummon`) but is authored to 0 so the feature is live in M6. *What
   would change it:* balance tuning the field up; no code change.
4. **Free draws are per-machine and go on a cooldown when spent.** Common: 5/day, 5-min cooldown;
   Premium: 1/day, 1440-min cooldown. A free draw is only eligible for a *single* draw (a ten-draw
   always spends tickets/gems). The counter refills when `dayKey(now)` rolls over. *Why:* PROMPT
   §7.5 numbers, interpreted as "one free draw per cooldown window" rather than an instant refill.
5. **Summon cost priority is free → ticket → gems.** For a single draw, a free draw is spent first,
   then the machine's ticket, then gems (Premium only; Common has no gem price and simply fails).
   A ten-draw spends 10 tickets, or the gem bundle (1,620 Premium). All pricing lives in
   `tuning/gacha.json`.
6. **Boxes are spend-down, not auto-granted.** Credits accrue at 1/draw (Common, box = 100 credits
   ⇒ 100 draws) or 20/draw (Premium, box = 400 credits = 20 draws). Claiming subtracts exactly
   `boxCreditsNeeded`, so credits can bank past one box.
7. **Six shops match `docs/design/shops.md`.** Daily `[0,12,18] UTC` (gems), Forest/Island daily
   (00:00 UTC), Guild every 7 days, PvP every 30 days, Wilds manual (`wildCoin` refresh cost, 3
   refreshes/day). One-time lines stay bought forever; per-window `limit` lines reset on restock.
   *What would change it:* a per-shop table if the reference's differs.
8. **Currencies grow to 13; the HUD strip shows 7.** `ticketCommon`/`ticketPremium` are now
   earnable/spendable; the eight mode/shop coins (`arenaToken`, `guildCoin`, `homeCoin`,
   `forestCoin`, `islandCoin`, `wildCoin`) exist in the save and reward bundles but their main
   sources land with their modes (M8/M10/M15). The M6 reward bundles can already pay any of them.
9. **Save schema is v3 with a lenient M6 migration.** A v1/v2 save missing `gacha`/`shops` gets
   defaults from the injected config; a state missing the *core* account fields (profile, roster,
   squads, currencies, `nextInstanceSeq`) is rejected as `corrupt_save`. The migration never
   invents a schema from nothing.
10. **Deferred to M15 (social):** VIP tiers, daily/weekly gift crates, and the "Supreme Gift"
    storefront. The M6 shop screens show only the six `docs/design/shops.md` stock tables.

## M8

1. **Tower climbs reset weekly, sweeps reset daily; floors are permanent.** PROMPT §7.6 says the
   tower's *climbs* reset weekly; the reference's faction tower resets ~20 climbs *per day*. We
   follow PROMPT: `climbsPerWeek = 20` (reset on the UTC ISO-week boundary via `weekKey`) and
   `sweepsPerDay = 2` (reset on the UTC day). The highest floor cleared never resets. *What would
   change it:* a reference statement that floors reset, or a per-milestone climb budget.
2. **Every mode's enemy squad is generated from a difficulty curve, not authored floor tables.**
   The reference ships hundreds of hand-authored tower floors, trial areas and dungeon stages; the
   milestone's done criterion is "each mode is playable with rewards and weekly resets", so each
   definition carries an enemy *pool* (faction/tier filter) + a level curve (`baseLevel × slope^n`,
   stars and evolution stage rising every N indices) and the server generates `StageEnemy[]` from
   it. *What would change it:* authoring real floor tables in `packages/content/pve/`.
3. **World-boss ranking is against a local ghost ladder.** There is no backend, so a fight's damage
   is ranked against the player's own stored best runs plus deterministic bots (`ghostCount`,
   seeded in code as `0x5eed`). This mirrors how M10 Arena ghosts will work. Damage is the summed
   per-unit `damageDealt` for the attacker side. Attempts and claimed milestones reset daily.
4. **The Link Crystal's star gate ships as `starThreshold = 10`.** PROMPT §7.1 says
   "340 + 8 per Wild at 12 stars", but our roster's `maxStars` is 10, so a 12★ gate is unreachable.
   It is a named setting in `packages/content/tuning/pve.json`; the shipped value is the roster star
   cap. The crystal unlocks when a Wild is in its **final evolution stage *and* at that stage's
   level cap** (a finished Wild), not merely on evolving — otherwise a 1-stage species would unlock
   it at level 1. *What would change it:* a roster whose star cap exceeds 12.
5. **Trials cost no stamina/attempts.** The reference's god trials consume area attempts; PROMPT
   does not mention a trial cost, so trials are always open (subject to their own rule). Only the
   **first clear each UTC day** pays a trial's reward bundle; later clears are still valid fights
   with no payout. `moonfall` is additionally gated to listed weekdays.
6. **Mode payouts use the full `Rewards` type.** Tower/trial/boss/dungeon payouts can include any
   currency (including the mode coins that lack a main source until their modes ship). The server
   applies them through the same M5 reward plumbing (`applyGrant`).
7. **Save schema is v5.** `pve` (tower/trials/worldBoss/dungeons/linkCrystal) is filled with
   defaults on a v1–v4 save; the crystal's unlock is re-derived on load (`normalize`), so a migrated
   save that qualifies unlocks automatically.
8. **The Crystal raises the level cap; a Wild's leveling respects it.** `levelUp` computes
   `effectiveLevelCap(wild, formCap, crystal)` and passes it into `leveledUp` (which otherwise
   clamps to the form cap). The Wild screen shows the same cap and cost. *What would change it:* a
   decision to make the crystal cosmetic, which would be a content change, not code.

## Carried from the reference (to be resolved per system)

- When a reference doc says `(inferred)` or `(open)`, the item becomes a named combat
  setting (Appendix A) and is surfaced in the Build Lab Rules panel.
- Conflicts between reference docs: prefer the later-dated or audited statement; record the conflict here.

## Owner content override (2026-10-15)

1. **Pokémon roster shipped in this private build.** The owner asked for the game's creatures to be
   the Pokémon-themed roster they collected (`wiki-pokemon-skills.xlsx`, from their own wiki) and
   stated the build is private and never distributed. On that basis the owner **explicitly overrode**
   the §2.1 originality rule for this build (AGENTS.md / PROMPT.md amended). Consequence:
   `packages/content` now carries Pokémon species and skill names. *What would change it:* the owner
   distributing the build, or asking for the original roster again.
2. **The IP guard is scoped, not removed.** `FORBIDDEN_WORDS` in `packages/cli/src/ipguard.ts` keeps
   the remaining franchise terms (`nintendo`, `game freak`, `digimon`, `yokai`) and the binary-media
   scan. Its tests were updated to match — a deliberate, recorded weakening (AGENTS.md: "never
   weaken a threshold without recording why").
3. **The M1 parity kits live as test fixtures, not content.** The golden regression lock
   (`packages/cli/tests/golden/`) replays scenarios against the `tidewarden` and `twigleaf` kits, so
   those two kits were moved byte-identically to `packages/cli/tests/golden/kits/parity.json` and are
   loaded *in addition to* the content kits by `golden.test.ts` / `pnpm golden-export`. No original
   Wild remains in the shipped roster.
4. **Attribute → faction map.** The sheet has five attributes (Light, Dark, Fire, Grass, Water) and
   we have six factions, so Fire→ember, Water→tide, Grass→grove, Dark→shade and Light alternates
   volt/frost. *What would change it:* a decision to re-theme the factions to the sheet's attributes.
5. **The species-coverage rule is relaxed.** `content:validate` used to require exactly six species
   per faction; it now requires *at least one* so the imported roster (18/19/19/7/7/14) validates
   while every faction stays represented for the PvE pools. *What would change it:* a decision to cap
   faction sizes, which is a content change, not code.
6. **Evolution stages are generated.** The sheet lists final forms only, so each creature gets three
   stages (`"<Name>"`, `"<Name> Prime"`, `"<Name> Zenith"`). Single-stage creatures broke two things:
   `evolve` could never fire, and the Link Crystal's "at final stage" gate unlocked for a level-60
   Wild immediately (see `local-server.test.ts`). *What would change it:* authored evolution lines.
7. **Chapters 1-3 were re-pointed at low-tier creatures.** The original stage enemies named
   `speciesId`s that no longer exist; they now use common/rare/epic creatures at `stage: 0` so the
   grown-starter balance test still holds. `docs/design/roster-import.md` lists the exact changes.
8. **Only 17 of 84 creatures have captured skills.** The sheet's `Skills` tab covers 17; the other 67
   use the three original class-archetype kits (honestly labelled, not invented move names). The 17
   are a best-effort translation into the content DSL — ally-wide buffs, rage generation, cleanses,
   on-hit passives, conditional talents and heal-over-time have no DSL home and were dropped; heal
   amounts were converted from "% of ATK" to a fraction of max HP. The full mapping and the dropped
   list are in `docs/design/roster-import.md`. *What would change it:* more captured skills, or new
   DSL primitives for the dropped effects.
9. **Distribution scope: a small, trusted group — not the public (owner decision, 2026-10-17).** The
   owner plans to let a few trusted people play through a **shared online service**, so the M19
   backend is **required**, not optional. This **amends item 1**: "never distributed" becomes "not
   publicly distributed — shared with a small private group only". No public release, store listing,
   open sign-up or marketing; the build stays private and invite-only. *Why:* the owner chose the
   shared-service route for a handful of players and wants the visual-identity pass to land before
   the backend. *What would change it:* public distribution, or a decision to return to
   single-player-only.
10. **M10 uses the franchise's Ranked region and tier names (owner decision, 2026-10-17).** The
    Ranked ladder's eight regions ship as the franchise's (**Kanto, Johto, Hoenn, Sinnoh, Unova,
    Kalos, Alola, Galar**) and its twelve tiers as the reference's own (**Vanguard I–III, Elite I–III,
    Commander I–III, Legend, Overlord, King**). Like the roster (item 1), these are permitted **only**
    in `packages/content` (the `tuning/pvp.json` table) and are display strings — no code branches on
    them. This is the same private, small-group scope as item 9. *What would change it:* a decision to
    re-theme the ladder to original region/rank names, which is a content edit only.

## M9 (design) — skill kits

The full sheet (all 84 creatures) is now captured, so M9 expands the DSL and re-ports every kit
(`docs/design/skill-kits.md`). Decisions that affect combat:

1. **DEF stays inert by default.** The measured model (1,278 fights) found P.DEF/S.DEF have no damage
   effect, so `defendersUseDef` ships `false`; the new `pDef`/`sDef` buff fields are stored faithfully
   and cut damage only if the switch is turned on (through the new `defK` setting). *Why:* prefer the
   measured model (PROMPT §2). *What would change it:* the sheet clearly treats P.DEF/S.DEF as
   meaningful, so a play-test decision to make them live is a setting flip + re-tune, not a data change.
2. **Taunt becomes forced targeting, not a skip.** The sheet's taunt makes enemies attack the taunter;
   the M1 engine treated taunt as a generic skip. M9 re-models it as a redirect toward the taunter.
   *What would change it:* evidence the reference taunt truly skips a turn.
3. **"[DEF] Pokémon" needs species traits the sheet does not carry.** Encoded as `targetTrait: 'def'`
   against an initially empty trait set, so the bonus never fires until traits are authored.
   *What would change it:* a traits column in the sheet, or traits derived from base stats.
4. **"(lv.N)" ladders are stored, not interpolated blindly.** Explicit level steps become
   `scalesWithLevel`; a single stated value is used flat. *What would change it:* per-level rows for
   more talents in the sheet.
5. **DoT basis is per-effect.** Burn/frost "% of S.ATK" DoTs scale from the caster's S.ATK; poison and
   generic DoTs from the target's max HP — whichever the sheet states. *What would change it:* a
   measured DoT formula.
6. **Cleanse/dispel strip whole buffs, not stacks.** A cleanse removes negative buffs in `cleanseOrder`;
   "cannot be dispelled" is a buff flag, not a separate mechanic. *What would change it:* a reference
   statement about stack-level removal.

### M9.1–M9.5 implementation notes (additive DSL v2)

7. **`hpShareBasis` defaults to `max`, not `current`.** The M1 `hpShare` skill reads the defender's
   *maximum* HP (`eff(defender,'hp')`), and that measured behaviour is locked by the golden/parity
   tests, so the default keeps `max`; `current` and `missing` are opt-in per skill.
   *What would change it:* a re-measurement showing the shipped `%` skills read current HP.
8. **The `defK` DEF curve is `reduction = def / (def + defK)`** (half damage at DEF == `defK`), used only
   when `defendersUseDef` is switched on; `defK` ships `1000`. No reference measurement exists for the
   shape — it is the standard saturating curve. *What would change it:* a measured DEF→damage table.
9. **Trigger names are the implemented set:** `battleStart`, `roundStart`, `roundEnd`, `turnStart`,
   `turnEnd`, `onHit`, `onKill`, `onDeath`, `onAllyDeath`, `hpBelow`. The design note's first draft used
   `beingHit`/`afterAction`/`endOfTurn`; the code names above are canonical.
   *What would change it:* a cleaner taxonomy agreed with the owner during the M9.6 port.
10. **Trigger nesting is capped** by `triggerDepthCap` (default 4) so two on-hit retaliations cannot
    recurse forever; on-death triggers may resolve effects after their owner has died.
    *What would change it:* a reference rule for chained retaliation.
11. **A secondary `damage` rider defaults to the P type** when it declares no `type` (triggers have no
    carrying skill). *What would change it:* evidence that riders inherit the passive's own type.
12. **`perTurn`/`cooldown` live on triggers,** not on individual effects: the sheet's "works up to N
    times per turn" and "cooldown N turns" clauses attach to a whole named mechanic.
    *What would change it:* a sheet clause that caps a single effect of a multi-effect skill.

### M9.6 the port (faithful, never approximated)

13. **The sheet's LV.2 / LV.3 notes are recorded as upgrade text, not modelled.** Each slot's captured
    description carries the base (LV.1) clause plus "LV.2:/LV.3:" upgrade notes. Wildbound skills have no
    per-skill level track, so the port treats the **base description as authoritative** and counts every
    note-bearing slot in `docs/PORT-REPORT.md` under "sheet LV.2+ upgrade text" instead of guessing which
    level a battle is at. *Why:* inventing a per-skill level track (or silently taking the LV.3 numbers)
    would approximate, and the owner asked for faithful, not approximated. *What would change it:* a
    per-skill level system, at which point the notes become `scalesWithLevel` steps.

14. **Port methodology: the port only replaces `skills` + `talents`, and writes a residual ledger.**
    `scripts/port-skills.mjs` (dev script, not shipped) reads `scripts/data/pokemon-skills.json` (the
    committed scrape: 84 creatures × Basic Attack / Basic Skill / Ult / Passive / Talent 1–4 = 579 rows)
    and rewrites only each kit's `skills`/`talents`, preserving every `id`/`name`/`faction`/`class`/`tier`
    that `scripts/import-roster.mjs` owns — so the port is re-runnable and idempotent. A clause the rule
    library cannot express is **counted, never invented**: `docs/PORT-REPORT.md` lists the modelled
    tallies and the "not modelled" categories, and every distinct unparsed pattern with an example.
    *Why:* AGENTS.md/§2 — the port may expand the engine, but a clause with no faithful home is recorded.
    *What would change it:* new DSL primitives (each would shrink one residual category).

15. **Default durations when the sheet states none.** A DoT with no stated duration ticks **2** turns
    (the `dot.turns` default); an untimed control lasts the engine's **1** turn; an untimed stat/debuff
    buff is left with no duration (it persists until dispelled or the fight ends) — the port never invents
    a duration. A **talent** stat bundle with no duration is an **engage-time** buff (Talent 1–2 are
    battle-long, so they are modelled as `battleStart` buffs with `turns: 99`, i.e. the whole fight, since
    `maxRounds` is 15). *Why:* the sheet omits a duration on many short clauses; these are the engine's own
    defaults and "for the fight" is the faithful reading of a persistent talent. *What would change it:* a
    sheet column or reference statement giving explicit durations.

16. **A bare "damage" clause with no P.ATK/S.ATK word infers its type from the creature's own rows.**
    The port scans all of that creature's sheet rows for a P.ATK/S.ATK hint; if any row states one, the
    bare clause uses it; otherwise the class default applies (striker → P, otherwise S). *Why:* the sheet
    omits the type on some multi-hit riders; using the creature's own other lines is the closest faithful
    signal. *What would change it:* an explicit type on the clause, or a measured per-class rule.

17. **"Start with half / full rage" maps to the shipped rage settings.** `rageStart` (half) = the
    `rageStart` setting (500) and full = `rageStrikerStart` (1000); the sheet's wording is kept in the kit
    as `talents.rageStart`. *What would change it:* per-creature measured starting rage in the reference.

18. **A staged mark becomes one-tick DoTs.** Rayquaza's passive states its staged mark deals "at end of
    turn 1 … 90%" and "at end of turn 2 … 115%", so it is ported as two one-tick `dot`s (turns 1 each,
    the second carrying the larger figure) rather than a single ramping DoT. *What would change it:* a
    DSL primitive for a per-turn ramp.

19. **Conditional damage riders are recorded, not approximated.** Clauses like "increasing the damage
    against backline enemies by 25%" or "plus damage equal to 40% of the HP it has lost" have no faithful
    DSL home yet, so they appear in the `docs/PORT-REPORT.md` residual tail rather than being folded into
    a flat damage number (which would silently over- or under-state the skill). The full scored list of
    residual patterns is the to-do set for the Build Lab / a later DSL pass. *What would change it:* a
    `bonusVs`-style condition that can express each clause, or explicit authoring by the owner.

20. **Sheet clauses with no engine primitive are recorded, not stubbed.** "Cooldown N turns" /
    "CD: N turns" in a skill slot (Wildbound skills have no cooldown), "Fatal damage instead brings you to
    1 HP" (no cheat-death primitive), "Splash: … ignoring defense", "shields do not block it", per-layer
    scaling clauses and "Occurs N times per battle" are counted in the report's residual tail. None is
    approximated. *What would change it:* an engine primitive for each (cheat-death, splash, per-battle
    uses, skill cooldown), added in a later milestone.

## Art media allowance (2026-10-17)

1. **Raster sprite art is permitted under `packages/client/public/art/` — and nowhere else.** The owner
   chose the hybrid art path (image sprites where supplied, the procedural SVG portrait as the fallback),
   so the IP guard's binary-media check exempts that one directory. Every other image/audio/font file
   under `packages/` is still refused, so all other art and audio stay procedural; the franchise-term
   scan (`FORBIDDEN_WORDS`) is unchanged. Implemented as `ART_MEDIA_ALLOWLIST` + a pure
   `isAllowedMediaPath()` in `packages/cli/src/ipguard.ts`, with tests in both guard suites.
   *Why:* the owner asked to relax the media check (option B) while keeping the term scan, rather than
   removing the guard. *What would change it:* the owner removing the allowance, or extending it to
   another directory.
2. **Franchise art is the owner's risk and is separate from this allowance.** The guard only decides
   what the build will *allow*; it is not a legal shield. If actual franchise sprite files are dropped
   into `packages/client/public/art/`, that is the same small-group exposure already accepted for the
   roster names (2026-10-15, above), now extended to images. Original 2D sprites remain the default.

## M10 (PvP — Arena and Ranked)

1. **Arena and Ranked opponents are deterministic ghosts, not real players.** The game is
   local-first, so "matchmaking" is a pure function of `(day, credits, reroll, slot)` — the same
   save + day + rank always meets the same trio, and Ranked seeds off the season/phase/tier. Ranked
   stores the seed only, so a reload cannot reroll an opponent. *What would change it:* the M19
   backend serving real defence snapshots (PROMPT §7.7 already allows saved local squads).
2. **The absolute PvP numbers are ours; the shape is the reference's.** Credits per win/loss, the
   band cut-offs, band places and reset values are not published, so `tuning/pvp.json` ships own
   tunables with the reference's shape: a win adds, a loss deducts, credits decide the place, and
   the weekly settlement pays the band then resets credits to that band's floor. *What would change
   it:* published numbers.
3. **Ranked scoring matches the 2026-10-04 audit exactly.** Below a tier's threshold a win adds 35
   and a **loss also adds 20** (losses count up); the points **stop** at the next threshold; at the
   stop the next match is the **promotion match** — a win promotes and still adds 35, a loss costs
   20. A unit test encodes the audit's parity fact: **42 straight wins reach 1,310** (Overlord's
   threshold), not 1,510. *What would change it:* new packet/journal evidence.
4. **There is no demotion.** A threshold loss deducts points but never drops a tier (the reference's
   banner only warns "your credit will be deducted"). *What would change it:* evidence of demotion.
5. **The season is weekly and resets the tier track.** Mon 03:00 → Sun 22:00 UTC; the daily data
   update is 03:00–05:00, which pauses matching and restores the day's attempts. The ladder's day
   boundary is **03:00 UTC, not 00:00** (`rankedDayKey`), matching "buy_count 4 → 0 across the
   update". Tier claims and the challenge-gift track reset each season. *What would change it:* the
   open question of whether gifts carry across a mid-season region change.
6. **"3 teams for 6V6" is one lineup plus a best-of-3.** The engine fights one squad per game; the
   phase's `teams`/`teamSize` set the lineup size and `bestOf` the series length. Recorded against
   the reference's team-format line (2×4 … 3×6). *What would change it:* a real multi-squad format.
7. **Weather is a season-wide +30% for one of our six factions.** The reference's Grass/Water/Fire
   rotation becomes the phase's faction list, chosen deterministically from the season key so the
   screen and the battle agree; the `+30%` ships as `ranked.weatherDmg` (kept equal to
   `combat.json`'s `weatherDefault`). *What would change it:* the reference's faction set mattering
   for our roster.
8. **Settlement is lazy (no scheduler).** A save left a week settles the next time it loads — the
   week key is compared in `normalize` and an **Arena Rewards** Mail letter is written on a
   rollover. *What would change it:* a server-side cron once the backend lands (M19).
9. **Arena worship (top-10 only) and lucky ranks are out of scope.** They need a population; they
   show as honest "coming later" on the Arena ranking screen. Best-rank achievements and the
   participation chests are in scope. *What would change it:* the backend providing a population.
10. **The chapter gates are our reachable equivalents.** The reference opens Arena at Main Story 5-2
    and Ranked after the 6th gym; our campaign currently has three chapters (more arrive with the
    M14 Victory Road work), so the gates are `arenaChapter: 2` and `rankedChapter: 3`. *What would
    change it:* the campaign growing past three chapters.
11. **Squad strategies go live in M10.5, opt-in.** `BattleConfig.strategies` defaults to `balanced`
    (today's behaviour) so every M9 test is unchanged; `aggressive`/`defensive` are applied where a
    fight passes them. *What would change it:* a decision to make them mandatory.
12. **Arena ghost strength tracks the caller's band, and the trio is low/mid/high.** The day's three
    squads share the `pvp.json` `arena.opponent` curve and differ by the generator's `index = band
    index + slot`, so opponents grow a little as credits climb and the third is the toughest. The
    absolute levels are ours (`baseLevel: 60`, `levelSlope: 1`) and get a balance pass in M10.6.
    *What would change it:* the reference publishing per-rank opponent levels.
13. **The Arena Refresh is free and unbounded.** The reference shows a Refresh control but publishes no
    cost or daily cap, so ours re-rolls the day's three seeds at no charge (stable until the next
    refresh, because the seeds are a pure function of the day + credits + reroll count). *What would
    change it:* a published price/cap, or an owner decision to bound it.
14. **The Arena defence is the saved `arenaDefence` lineup, not a frozen stat copy.** The reference
    stores a defence snapshot; ours stores the lineup + strategy (`setArenaDefence` reuses the squad
    save) and reads live stats. The "stored copy" semantics arrive with the M19 backend's defence
    snapshots. *What would change it:* the backend.
15. **Bought attempts charge the day's prices in order and fail atomically.** `buyArenaAttempts(n)`
    sums `attemptPrices[min(bought + i, last)]` for `i = 0…n-1` and refuses the whole purchase when
    gems are short, so a partial charge never happens. *What would change it:* a different price shape.
