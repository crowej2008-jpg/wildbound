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
11. **Copy the source exactly (owner decision, 2026-10-31).** Owner: "everything that is not a brand
    new feature is a copy from the source and i want it copied exactly." This **supersedes** the
    "own names, numbers and values / no copied rows" rule used through M8–M13.2 (including M13's
    content-volume choice 6B) and PROMPT §2.1's data-dump paragraph. Existing systems built with
    invented names, numbers or mechanics must be brought in line with `reference/game-rebuild/`
    (audit: `wiki/project/source-fidelity-audit.md`). Exceptions are only the owner's brand-new
    features and explicitly recorded changes (`wiki/decisions/copy-the-source-exactly.md`). The
    no-real-money rule still stands. *What would change it:* the owner naming further deliberate
    changes.

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
8. **Settlement is lazy (no scheduler).** `pvp/settlement.ts`'s `rollPvp` compares the Arena's ISO
   week key (and Ranked's season key) in `normalize`, which every `load()` runs — so a save left a week
   settles on its next server call, whether that is a cold load or any action inside a live session.
   On a rollover the band is paid as one **Arena Rewards** Mail letter whose id embeds the week that
   ended (`mail_arena_<week>`), which makes re-payment impossible and pays a multi-week gap once.
   Best-ever readouts (`bestCredits`, `bestPlace`) and claimed achievements survive the reset — they
   are the reference's permanent records. Mail carries no parameters, so the letter's body is generic
   and the reward rides as the attachment. *What would change it:* a server-side cron once the backend
   lands (M19).
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
    squads share the `pvp.json` `arena.opponent` curve and differ by the generator's
    `index = band index + slot`, which steps the generator's **level** (`levelSlope`), **stars**
    (`starsEvery`) and **evolution stage** (`stageEvery`) together. *M10.6 measured and replaced the
    authored numbers* — they were `baseLevel: 60, levelSlope: 1, starsEvery: 6, stageEvery: 14` over
    the **whole** catalogue, which made the mode a wall: the Arena opens at chapter 2, where the
    player's squad is the six starting **rare** Wilds at ~Lv20/2★ and the campaign's own chapter-3
    endgame is Lv12/2★ enemies, so level-60 rivals drawn from a pool that is 2/3 supreme+mythic (a
    2.5–3.2× stat-total cliff over a rare) lost 0% of entry-rung fights at every squad level up to
    Lv48, while a Lv140 squad met the same wall elsewhere. The shipped curve is now anchored to the
    campaign's scale and **restricted to the campaign's own tier band** — `tiers: ["rare", "epic"]`,
    `baseLevel: 6`, `levelSlope: 1.24`, `starsEvery: 2`, `stageEvery: 5` — measured at **53%** for a
    chapter-2 graduate (Lv20/2★/stage 1) on the entry band, 0% for the same squad at band 6, 86% at
    Lv40/5★ and 100% for a maxed squad. The trio is the same curve at bands `n`, `n+1`, `n+2`, so it
    is an easy/mid/hard draw, not a low/mid/high one. Absolute numbers are ours; the *shape* ("3
    opponents of similar strength for your current rank") is the reference's.
    `packages/server/src/pvp-balance.test.ts` pins the measured rates. *What would change it:* the
    reference publishing per-rank opponent levels.
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
16. **A Ranked rung's rivals are one seeded lineup per game, sized to the region.** `ranked.opponent`
    sets the curve and the generator's `index = tier`, so each rung is stronger; the curve's `count`
    is trimmed to the phase's `teamSize`, and the seed is `rankedMatchSeed(season, phase, tier)` mixed
    with the game number — the same save + season + rung always meets the same rivals, so a loss never
    rerolls them. *M10.6 measured and replaced the authored numbers* (`baseLevel: 62, levelSlope: 1.05`
    over the whole catalogue, which was as unreachable at Ranked's chapter-3 gate as the Arena's was at
    chapter 2). Shipped: `tiers: ["rare", "legendary", "epic"]` — one tier band above the Arena, since
    Ranked opens a chapter later and is the serious ladder, but still excluding supreme/mythic — with
    `baseLevel: 12`, `levelSlope: 1.18`, `starsEvery: 2`, `stageEvery: 5`. Measured with the season's
    weather and the region's 4-slot format: **67%** for a chapter-3 graduate (Lv30/3★) at tier 0, 100%
    at tier 5 for Lv60/6★, and King tier reserved — 22% for Lv140/10★ but 94% for a maxed Lv200/10★
    squad. The top rung is ~7× the first (the reference's ramp shape, our numbers).
    *What would change it:* published per-rank opponent curves.
17. **The season advances the region.** The reference publishes no region-advance rule, so
    `rollRankedSeason(state, season, phaseCount)` steps to the next region cyclically when the season
    turns (Kanto → Johto → … → Galar → Kanto) and resets the tier track, the claimed tiers/gifts and
    the season record. Without it seven of the eight shipped regions would be unreachable. *What would
    change it:* a published rule (e.g. promoting past King crossing into the next region).
18. **The 03:00–05:00 UTC daily update is shown, not enforced.** `inDailyPause` drives a note on
    `/ranked` and nothing else: a local-first, single-player build has no live matching to pause, and
    blocking a save's own matches on the wall clock would only add a dead hour (and make e2e depend on
    the runner's time of day). *What would change it:* the M19 backend, where matching really is shared.
19. **Ranked tier coins are paid in the shared PvP token.** The reference's "Ladder Coins" are not a
    currency we model, so `claimRankedTier` pays `coins[i]` as `arenaToken` — whose HUD label is now
    **"PvP Tokens"** (renamed from "Arena Tokens" once both modes paid it). The id is unchanged, so no
    save migration is needed. *What would change it:* a separate ladder currency in the engine's
    `CURRENCY_IDS`.
20. **Ranked fields the Arena attack lineup.** There is no seventh squad mode; `/ranked` offers a
    deep-link to the `arenaAttack` lineup ("Lineup") and the server trims it to the region's
    `teamSize`. *What would change it:* a dedicated `ranked` squad mode in the engine's `SQUAD_MODES`.
21. **PvP ghost curves are static, so a maxed squad outgrows the top rung (M10.6).** The reference
    matches you against *other players'* snapshots, whose strength tracks the rank's live population;
    with no backend our rivals are one authored `EnemyPoolSpec` per mode, scaled by the rung index. That
    curve is anchored at the mode's unlock (chapter 2 / chapter 3) and tuned so its top rung needs a
    near-maxed squad — but a squad grown past the curve clears every rung, so the Arena becomes a daily
    chore and King tier becomes routine for a Lv200/10★ roster (measured: 100% and 94%). That is the
    honest local ceiling, not a bug: the fix is live matchmaking, i.e. the M19 backend. The pools are
    also deliberately **tier-banded** (Arena: rare+epic; Ranked: rare+legendary+epic) rather than the
    whole catalogue, so the supreme/mythic tiers are reserved for the later cross-server modes (M17)
    where the player arrives with an endgame roster. *What would change it:* the shared service
    (M19), or an owner decision to field the top tiers in Ranked.
22. **The bottom nav is the source's six tabs in the making; PvP borrows the Explore slot (M10.6,
    owner decision).** The source bar is *Home · Explore · Pokémon · Combat · Trainer · Bag* — six round
    icons with labels, a claimable dot and the selected tab raised (`atlas/02-hud-and-navigation.md`;
    photo `reference/visual/screens/0001_postlogin.png`) — and it reaches **PvP from the Explore map's
    PvP pin**, not from the bar. Screens we have not built yet cannot be a tab, so ours ships six slots
    with PvP in the Explore position; M13 replaces it with the world map (PvP becomes a pin) and the
    M18 visual pass gives the bar the source's icon/label/raised-selected treatment. Our labels stay
    original — the roster tab is **"Wilds"**, never the franchise's roster name (content override, item
    10). *What would change it:* M13, which is where this converges.

## M11 (growth and collection II)

23. **M11 renames the five M7 layers in the UI and deepens them in place (owner decision, 2026-10-20).**
    Talents → **Potential**, Runes → **Orbs**, Spirit Cores → **Soul-hearts**, Charms → **Berries**,
    Relics → **Held Items**; code ids and save fields stay as they were. The M7 client screens were
    never actually wired (the old SCOPE/CHANGELOG claim was wrong); **M11.0** ships the Wild-screen
    tabs, stat sheet and layer Power deltas before any new layer lands. *What would change it:* the
    owner asking for a code-level rename instead of a label-only rename.
24. **Potential keeps the 15 class trees, not 84 per-species trees.** The reference gives each species
    its own tree; authoring one tree per Wild is too much content for M11, so a Wild picks the tree
    for its class. **M11.2 implements this**: the nine-tier ladder consumes one duplicate copy plus
    Potential Shards for a new tier, charges a flat respec fee to re-pick, and refunds the shard
    ladder (not the fodder) on reset. Duplicates may be any level/stars as long as they are not the
    target, locked, or in a squad; the lowest-level copy is picked first. Costs live in
    `content/tuning/collection.json` and re-tune without engine changes. *What would change it:*
    owner-authored per-species trees, or a rule that fodder must be unstarred/returned on reset.
25. **M11 resources use the source's names and become `CurrencyId`s.** Potential Shards, Orb Essence,
    Soul-heart EXP, Berry Essence, Held Item Shards, Plate Bottles, Plate Fragments, Star Shards,
    Resonation Shards and Title Tickets join the existing currencies. `shard` (Wild star-up) and
    `stone` (Link Crystal) keep their meaning. Adding ids is a save-version bump; M11.1 owns the v6 → v7
    migration and the Trainer materials row; **M11.1 implements this** (save v7 normalises the
    currency record so every material exists at 0). **M11.5 bumps to save v8** to replace the single
    Berry slot with two slots. *What would change it:* owner veto of source names, or a decision to
    model materials outside `Rewards`.
26. **Soul-heart set effects use the owner's nine sets, with same-stat ladders taking the highest tier.**
    Bug 6-piece = 25% lifesteal (not 5+12+25), Flying 6 = 25% control resist, Superpower 6 = +30% Sp.Atk,
    Rock 6 = 15% damage reduction, Fire 6 = +30% versus shields; distinct 2/4/6 effects all apply.
    Turn/round cadences are named settings in `content/tuning/combat.json`. **Flying 6 starts on turn 3**
    (owner, 2026-10-20): Control Immunity at the start of turn 3 and every third turn after, for that
    turn only. **M11.4 implements this** with a folded `SoulheartHooks` payload rather than fake stat
    lines. Star-up costs `expBase + (stars − 1) × expPerStar` Soul-heart EXP (`collection.json`);
    the starting inventory includes three 2★ Common pieces. *What would change it:* owner
    clarification of a different pulse length, ladder rule, or star-up cost.
27. **Orbs keep four sockets and use 2/4 set bonuses.** The reference has more sockets; four is the
    M7 shape and keeps the screen readable on a phone. **M11.3 re-authored all four sets at 16 orbs
    (four per set)** with 2- and 4-piece bonuses, keeping the four qualities and levels 1–6. A
    level-up consumes two same-kind, same-level, unsocketed copies plus gold, or the authored Orb
    Essence fallback; both costs live in `content/tuning/collection.json` / `equipment.json`.
    *What would change it:* owner asks for the reference's larger socket count or different
    copy/essence costs.
28. **M11 caps Held Items at level 60, gives Berries two slots, and defers two source hooks.** The
    reference's Held Item cap is 200; 60 is the M11 ceiling until the economy is measured. **M11.6
    implements levels 1–60**: level-ups spend Held Item Shards (`5 + 2 × (level − 1)`), refines
    spend gold + Shards (`800 + 400 × refine` / `10 + 10 × refine`) and strengthen the effect by
    20% per refine. The base effect stays active at refine 0 (the M7 behaviour), so refining is an
    upgrade rather than an unlock. **M11.5 implements the two Berry slots**: save v8 migrates the
    old `charm` into slot 1, a real battle consumes one copy per occupied slot, and star-up uses
    duplicate copies + Berry Essence. Equipped copies cannot be dismantled. Plate stage 6 skill-swap
    and shiny Trinket variants are shown as "coming later" and are not claimed as built. *What
    would change it:* a later milestone extending the cap, an owner decision to gate the effect
    behind refine 1, or prioritising skill-swap.
29. **Resonance grants flat stats per Link Crystal level, not an instant level.** The reference shares
    the crystal's level with slotted Wilds; our per-Wild level economy would be trivialised by an
    instant high level. M11.9 gives a slotted Wild `4 HP / 1 P.ATK / 1 S.ATK / 0.5 P.DEF / 0.5 S.DEF /
    0.05 SPD` per crystal level (all data in `collection.json` `resonance`). Six slots, two open; the
    rest cost `50 + 50 × (unlocked − 2)` Resonation Shards, and one Wild can hold only one slot.
    *What would change it:* a redesign of Wild level costs or owner-tuned resonance shares.
30. **Titles have three slots, Title Tickets and lazy expiry.** Common / Premium / Rare slots, one
    title per slot. The original catalogue mirrors the source shape at 102 titles: 85 permanent,
    15 seven-day and 2 fourteen-day. Costs are Title Tickets per stage (not per-title activation
    cards); normal titles have one stage, event titles keep a 15-stage ladder. Percent "Total"
    HP/P.ATK/S.ATK lines resolve after flat gear. Timed titles are removed and their slots cleared
    on load/open, not by a scheduler; max-stage Continuation pays the top stage cost to extend from
    `max(now, expiresAt)`. Guild-war and event titles are catalogue rows with honest locked
    "coming later" states until M16/M15. Save v13 adds `titles`. *What would change it:* the event
    calendar in M15, guild war in M16, or an owner decision to use per-title activation cards.
31. **VIP is activity-driven and never real money.** Seven tiers (0–6, `Visitor` to `Crown`) derive
    from lifetime `profile.xp` (0 to 250,000), not a purchase flow. They grant data-driven
    conveniences only: +0–6 idle-cap hours, 0–12% off shop item prices, and 0–3 Common Tickets in a
    once-per-UTC-day supply. The private build has no payments by policy. *What would change it:*
    owner decision to remove VIP entirely; real money remains out of scope.
32. **Imported saves now receive the authored starting equipment (M11.0 bug fix).** `LocalServer` passes
    the content config into `migrateSave` on import, normal load and backup recovery, so a save that
    omits the `equipment` slice gets the starting relics/runes/berries instead of an empty inventory.
    *What would change it:* a deliberate decision to treat a missing slice as an empty inventory.
33. **Plates are element-keyed and use one ladder per faction (M11.7).** The reference has one plate
    per element with stages 0–20. Our six species factions map one-to-one to six plates, each with two
    authored lines. A stage costs `10 + 5 × stage` Bottles except the 5→6 step at 375 Fragments; there
    is no unlock gate because every Wild has an element. The stage-6 skill swap is deferred and the
    card says so. Save v9 adds `plates: Record<wildId, stage>`; migration defaults it to `{}`.
    *What would change it:* owner wants per-species plates, a stage gate, or a different Fragment step.
34. **Trinkets are species-keyed and shared by every copy (M11.8).** The reference has one signature
    trinket per species. We store `trinkets: Record<speciesId, level>` so levelling a keepsake once
    benefits every copy of that species; levels run 0–40 and cost `10 + 5 × level` Star Shards. Each
    keepsake has flat HP/P.ATK/S.ATK plus one authored percent line chosen by class (Crit Intensity,
    DMG Reduction, or Skill Boost). Shiny variants remain deferred. Save v10 adds `trinkets`; migration
    defaults it to `{}`. *What would change it:* owner wants per-Wild trinkets or unique per-species
    percent effects.

## M13

35. **Campaign expands to the source shape, not its rows (2026-10-23).** The source is 182 chapters × 10
    stages with 60 gym gates at 3-1, 6-1 … 180-1. We keep those counts and the ten-stage chapter
    shape, but chapter names, gym names, species picks, levels, rewards, idle rates and descriptions
    are ours. Chapters 1-3 keep the M5 authored stages 1-6 and append 7-10; chapters 4-182 are
    generated once by `scripts/generate-campaign.mjs` and committed as
    `packages/content/stages/campaign.json`. The runtime never generates content. *What would change
    it:* owner-authored chapter/gym names, a different level curve, or a shorter campaign.
36. **Gym gates are Option A: the 60 fights now, the full Victory Road layer in M14.** Each third
    chapter's first stage requires its gym. The gym opens once the stage immediately before the gate
    is cleared; only the first win pays its reward, and replays are practice. Tasks, badges,
    commission, Hall of Fame and the source's 250 chests remain M14. *What would change it:* pulling
    Victory Road into M13 or deferring the gate fights to M14.
37. **M12 is skipped; Gods Trials is parked (owner decision 2026-10-23).** No Ancient Artifacts,
    artifact Suppression, Ruins Adventure or Relic Battlefield in M13. Gods Trials is removed from
    the M13 mode list and deferred until after M13 and other milestones; its local Suppression
    Treasures are not M12 artifact Suppression. *What would change it:* the owner reinstating either
    system.
38. **M13 has eight modes and two gate classes (owner decision 2026-10-23).** Modes: Hoopa's Vault,
    Rift Arena, Sky Pillar, Faction Tower, Misty Woods, Pet Home, Island Challenge, Ultra Wormhole.
    A gates: Pet Home 1-10; Sky Pillar 7-1; Misty Woods 3-10; Rift Arena 10-10 + Lv10; Faction Tower
    28-10; Island Challenge 3-10 + Lv10; Ultra Wormhole 10-10 + Lv50. B gates (future): Hoopa server
    day 15; Gods day 29 + Lv45; Joint day 60 + Lv45; Relic first merge + Lv45. "Server day" counts
    from the stored server epoch (default account creation) with the debug fast-forward. *What would
    change it:* owner retunes a gate or removes one.
39. **Island Challenge is the full simulated alliance contest; Rift Arena is split.** Island
    Challenge includes bot alliances and settlement, not a placeholder ladder. Rift Arena ships its
    Barriers/Merchant step first and its Ring Battle/Quiz step second. *What would change it:* owner
    accepts a simpler bot ladder or a one-step Rift.
40. **Free-to-play only: no paid tracks, Vault passes, Pet Home assistant or real-money SKUs.** Gems
    remain earnable. The 13.0a chapter-complete mail pays a flat 200 gems (`campaign.json`), replacing
    the old `100 + 50 × chapter` formula that would have paid 9,200 at chapter 182. *What would change
    it:* owner asks for a different chapter chest or an earn-only gem source.
41. **Resetter Shards and Held Item Shards are separate currencies.** Refining spends Resetter Shards
    to make Held Item Resetters (20 Resetter Shards → 1 Held Item Resetter); Held Item Shards remain
    the user's own leveling currency. The retrofit is planned for 13.3 with Hoopa's Vault, costs
    1,1,2,3,4,5,6,8,10,12,14,16,18,20. *What would change it:* owner moves the retrofit earlier or
    keeps the M11 Held Item Shard refine.
42. **Save v14 adds `campaign.gyms` (2026-10-23).** Gym clears are stored as
    `Record<gymId, boolean>`; v13 and older saves migrate with `{}` and keep their stars. 13.0b bumps
    the save to v15 for `serverEpoch` and builds the Explore foundation. *What would change it:*
    moving gym clears into a separate Victory Road slice before M14.
43. **Explore ships as eight honest shells first (2026-10-27).** 13.0b adds the Explore hub,
    data-driven mode cards, gate evaluation and reset countdowns; no mode has a play button or a
    fake reward claim until its sub-milestone. The eight cards show scale, gates and "arrives in"
    labels. Save v15 stores `serverEpoch`; older saves derive it from the welcome mail's creation
    time, falling back to migration time. *What would change it:* the owner wants a mode playable
    before its sub-milestone or a different account-age basis for server-day gates.
44. **Pet Home is a merge board, not resident placement (2026-10-28).** The source audit replaced
    the earlier habitat/decoration plan: 5×5 board with 21 playable tiles (four inert corners), 17
    Home levels, merge cap 8→16, +10 Home XP for opening and merging, 50 free summons/day, and lazy
    Home-Coin settlement every 5 minutes with an 8-hour offline cap. Counts and shapes follow the
    source; names, XP thresholds, income values, tile layout and shop rows are ours. The paid
    assistant and real-money products are removed. Save **v16** adds `petHome`; older saves migrate
    with a fresh slice. *What would change it:* the owner restores resident placement/decoration or
    asks for source-exact numbers.
45. **Pet Home's two shops share one daily refresh counter (2026-10-28).** Each shop has its own
    deterministic nine-offer page and its own bought-offer list; a refresh clears only that shop's
    bought rows, while the 30-per-day counter (40 gems for 1–10, 80 for 11–30) is shared. Deluxe
    (Orb Atelier) opens at Home Lv 10 and pays in Orb Essence; Home Exchange pays in Home Coins.
    *What would change it:* the source evidence shows separate per-shop counters, or the owner asks
    for one shared page instead.
46. **Sky Pillar follows the source's 180x10 shape with an 80-level gate cap (2026-10-31).** Six
    30-floor wings, ten stages per floor, two extra star conditions per stage, 10/20/30-star floor
    chests and six Proofs of Sky recharging every 480 minutes. The source's player-level gates run to
    200; this build caps trainer level at 80, so the last floors ask for 80. The visible 15-turn
    counter is a loss on time-out (`BattleRules.roundLimit`, used only here). A first clear costs one
    proof; re-challenging a passed stage is free; a sweep costs one proof and pays the highest
    3-star record's half reward. Save **v17** adds `skyPillar` and the `skyPillar` squad mode; v16
    and older saves migrate with a fresh slice and an empty squad. *What would change it:* a raised
    trainer-level cap, source-exact gate numbers, or owner approval for a different sweep rule.

## Source retrofit (R)

47. **Saves reset instead of migrating during the retrofit (owner decision, 2026-10-31).** Owner:
    "ok lets reset". Save **v18** sets `MIN_SAVE_VERSION = 18`; anything older is refused as
    `outdated_save`. On load, LocalServer keeps the old save under `wildbound.account.retired`,
    clears the backup and starts a fresh account with a "fresh start" mail; importing an old save
    shows the error instead. Every retrofit step that changes the save shape raises both constants
    together (and `tests/e2e/save-version.ts`). Real migrations resume once friends have real
    progress (after the M19 backend). *What would change it:* the owner wanting old saves kept.
48. **Source tables are read from the owner's dumps, never at runtime (R0).**
    `scripts/source/source.mjs` loads tables from `reference/game-rebuild/data/h5-client/` (or
    `WILDBOUND_SOURCE`); when a table is in several dated dumps the latest wins. Import scripts write
    committed content JSON; the game and CI never read `reference/`. `docs/SOURCE-TABLES.md` lists all
    377 tables. Some dump keys are research extracts with annotated names (e.g.
    `vip_priv_json (daily_dun_buy_num by VIP level)`); prefer the plain table when both exist.
49. **Species copy the source (R1, 2026-10-31).** `scripts/import-species.mjs` copies each species'
    faction (`race`: the source's **five** — water, fire, grass, light, dark; Light is no longer split
    into volt/frost), class (`career`: ATK → striker, DEF → guardian, SKILL → adept; shown as ATK / DEF
    / SKILL), quality (`potential` 13–18; **Origin** is new), shards per copy (`item_num`) and every
    star card (name, level cap, stats, faction bonus, fodder) from `hero_basic_json` /
    `hero_evolution_json`. Kept from the owner's roster: ids, names, descriptions, portrait seeds and
    kits. The hero → species map is `scripts/data/source-hero-map.json` (80 by form name, 4 by hand:
    Vulpix→Ninetales, Flamewhite Kyurem→Black Kyurem, Shiny White Kyurem→Shiny Kyurem, Wind God
    Pidgeotto→Wind-God Pidgeot). *What would change it:* a re-capture of the tables.
50. **Stats are the source's naked stats.** HP = basic + level × growth; P.ATK = S.ATK = basic + level ×
    growth; P.DEF = level × growth; S.DEF = floor(level × growth); SPD = basic. 19★+ cards add
    `extraBasic` flat and `extraGrowth` per level (the kb leaves per-level open). The per-species
    milestone rows (`hero_upstage_attr_json`) and level-unlocked talent stat bonuses are **not in the
    dumps** and count as 0 for now. *What would change it:* capturing those tables.
51. **Stand-ins until the source tables are captured (owner chose stand-ins, 2026-10-31).** The
    per-level XP-candy/gold table is not in the dumps; the old curve (48 × level^1.2 candy, 3 gold per
    candy) stays because it matches the one known point (Lv1→2 = 48 candy; the source charges 143
    gold, we charge 144). The trainer-level XP table is likewise not dumped and keeps our curve.
52. **"DMG BST to [faction]" joins the additive DMG Boost pair.** Each star card carries one 25 %
    bonus against a faction (attr 138–146); the battle adds it to `1 + dmgBoost − dmgRdct` when the
    defender is that faction. The kb measured a Water defender taking × 1.43 from an attacker with
    25 % to Water — about × 1.14 more than this explains — so how the source combines it is open.
53. **Interim enemy stars (R1 → R9).** Enemy rows (campaign, gyms, mode curves, PvP ghosts, Sky
    Pillar) keep their pre-retrofit 1–10 `stars`; `enemyStar` counts them up from the species' first
    star and ignores the old `stage`. Re-measured under the new stats: the Ranked rival curve's
    `levelSlope` went 1.18 → 1.24 so the M10.6 balance checks still hold (entry 0.78, mid 1.0, Lv140
    at King 0.33, maxed 0.83). R9 replaces all enemy rows with the source's.
54. **Evolve is the source's (R1).** A star goes up one at a time by consuming the star card's fodder
    (own copies, and same-faction Pokémon, at exact stars); fodder is auto-picked lowest level first
    and never taken from a squad or a locked Wild. The old shard star-up and 3-stage evolution are
    gone. 18★ → 19★ (Awakening) and the Origins' fodder-less stars show an honest "comes from
    Awakening" state. Per-species shards (`item_num`) are imported but composing arrives with R9's
    summoning retrofit, so the generic `shard` currency currently has no growth use.
55. **Gear and Orbs from the notes (owner, 2026-10-31: "lets just go off of what we know").** The
    dumps lack most gear (`god_eqm_*`) and all orb tables; R2 and R3 will be built from the kb notes
    with each missing number a labelled stand-in, after R4, R6, R7 and R8. *What would change it:*
    the owner re-extracting those tables.
56. **Held items are the source's (R5).** Items, pools, level costs, dismantle values and skill texts
    come from the dumps; the resonance gates on Lv 31…181 from `kb/held-items.md` (not dumped). The
    refine is the source's re-roll with keep/drop and the `refine_max` slot rule, priced on the
    **owner's ladder** (free, 1, 1, 2, 2 … 10, 10; 21 refines per item) instead of
    `held_item_wash_cost_json` (supersedes #41). One pending roll at a time: a new refine waits for
    keep/drop. *Stand-ins:* new accounts get three Rare items (one per class) until Hoopa's Vault
    (13.3) drops them; the held-item album (18 milestones) waits for its tables, which are not in the
    dumps. Skills the round-effect DSL can't express (24 of 27 names) show their text and are marked
    inactive; Choice Band's "ignore 50 % block" is not approximated.
57. **Held-item skill readings (E2).** Where the source text leaves a number out the item carries a
    labelled stand-in: Smooth Rock / Heat Rock "a chance" = 50 %; Rocky Helmet's −10 % DMG RED on the
    attacker lasts to the end of the round and refreshes; Terrain Extender (80 %, from the kb) = the
    opposite enemy deals 10 % less and the holder takes 10 % less until round end; Damp Rock = +25 %
    basic-skill chance. A self buff "for N turns" applied during the holder's own action is authored
    as N + 1 turns, because turns tick at the end of the holder's own turn. *What would change it:* a
    measurement or the owner's reading.
58. **Hand-ported kits (E3).** `scripts/data/build-kit-overrides.py` writes the 68 kits the parser could
    not express. Readings: a self buff "for N turns" applied during the holder's action is N + 1 turns
    (as #57); "[Offer of Power]" is an after-ultimate trigger with a 4-turn cooldown; "1/2 additional
    Rage" etc. are shares of the 1,000-point bar (the kb's Rage talents); "+X% ATK" is `atkPct`, which
    raises both attacks. Clauses still not modelled are listed per kit in `docs/PORT-REPORT.md`; DEF
    clauses stay inert while `defendersUseDef` is off. *What would change it:* the owner's reading of a
    clause, or source data for the bespoke mechanics.
59. **Mew / Shiny Mew "every fallen enemy" (owner, 2026-10-31: "i want it as every enemies").** Talent 4's
    Rage (Mew 250, Shiny Mew 500) comes from every enemy that falls, whoever defeated it — the
    `onEnemyDeath` trigger.
60. **Owner kit changes (2026-10-31), deliberate departures from the sheet.** Snorlax's ultimate gains
    +2% damage per 1% HP lost, no cap ("make it 2% damage per 1% lost"; the sheet: up to 60%).
    Mimikyu's extra attacks gain Rage ("make the extra attacks give rage"; the sheet: they do not).
    Dialga's ultimate fills every ally's Rage to the max, Dialga included, after its own cost is paid
    ("fill all team members including himself rage bar to the max"; the sheet: +200 to backline allies).
61. **Species shards and Origin skill levels (E4; owner 2026-10-31: "lets do per pokemon shards as
    with the origin skills", then "No source until R9").** Each species has its own shards (`speciesShards`
    in the save); `item_num` of them (30 / 40 / 50, Origins 50) compose a new copy at its first star.
    Only the six Origins level skills — ult, basic skill, passive, Talent 4 — LV.2 for 50 and LV.3 for 100
    of their own shards (`hero_origin_skill_up_json`); ordinary Pokémon's talents step up with stars in
    the source, but those tier texts are not dumped, so their talents stay at the sheet's tier. No reward
    pays species shards until R9 maps the shops, campaign and quests (debug grant only). The general
    Shards currency is unchanged. Save v21.
62. **E5 combat numbers.** From the measured notes: Block INT is the blocker's, the Counter reflect passes
    shields, and Wobbuffet's Counter is the server's 75% (its sheet says 50%). **No team-Power cut (owner,
    2026-10-31: "i dont want there to be a cut for weaker teams against stronger teams")** — a deliberate
    change from the source, which cuts a weaker team's damage on both sides; `teamPowerCut` keeps the
    measured rule as a switch. Ranked rival `baseLevel` stays 12 (entry 0.67, mid 1.00, strong 0.50,
    maxed 1.00). Still open, with tests: `wiki/systems/combat-numbers.md`.
63. **Action Rage by class (owner, 2026-11-01: "the normal number is +125, +250 is only for pokemon with
    the skill class").** A normal attack / basic skill gives +125 Rage; SKILL class (`adept`) gets +250 instead.
    The measured source notes say +250 for every class; the owner's figures replace them (first set on
    2026-10-31 as SKILL-only +250, corrected the next day). Extra actions get the same (Mimikyu's: +125).
    SKILL kits' own "generate 1/2 additional Rage" talent (+500, 33 kits, from the owner's sheet) still
    stacks on top. Settings: `ragePerAction` 125, `ragePerActionByClass` `{ adept: 250 }`. Golden
    replays squad-camp and tidewarden re-exported.
64. **R4 Potential readings** (source data copied exactly; these are the readings the data leaves open).
    "Allies deployed" (tier 1, tier 4) counts the *other* Pokémon in the lineup; "allies alive" (tier 7)
    counts the Pokémon itself, re-checked at battle start, each round start and when an ally falls.
    "Until its next action" lasts through the holder's next action. "After attacking" options (Hawk Eye,
    Curse) mark the action's first target; Tit for Tat adds a hit of v × its lost HP to the ultimate's
    first target. Area Attack's 破挡 is Guard Break (kb: inferred). Potential does not change the shown
    Power yet (how the source counts it is unknown). Fodder is picked automatically like Evolve (lowest
    level first); squad members and Pokémon with developed Potential are never taken (the source leaves
    the latter open); Potential Cores cover what Pokémon can't, where allowed. A reset returns the
    fodder as Lv 1 copies at the star they were taken at (the source's "all potential training
    materials"). Potential Cores have no source until R9.
65. **R3 Orb stand-ins (owner, 2026-11-01: "the orbs go upto lvl 10 at the max so make sure to scale it
    up").** The orb tables are not in the dumps (re-checked on the owner's PC too). Built from kb/orbs.md,
    the owner's wiki and hero_orb_decompose_json; stand-ins: flat stats +8…+10 (×1.5 per level), other
    colours' flat stats (geometric 22 → 125 share of red), % line ceilings for non-DMG/PVP/BOSS lines (best
    +7 roll ÷ 7) with rolls at 80–100 %, the same lines for every colour, set choice when several fit, and
    the sockets living on the Pokémon until Gear (R2). Details: `docs/design/orbs.md`. Replace when
    `hero_orb_basic_json` turns up.
66. **R6c Soul-heart rules.** The owner's nine sets and their lines stay. From the source (kb/soul-hearts.md):
    four qualities — blue, purple, orange, red — capped at 2 / 3 / 4 / 5 stars, each star its own Soul-heart
    EXP step (blue 100 / 200 … red 900 / 1,800 / 3,150 / 4,500 / 7,200), pieces start at 0★, the tab opens
    at 10★. Stand-ins: a piece's lines keep the owner's per-star growth with 0★ as the first value; the
    starting three pieces are blue 0★; feeding one Soul-heart to another (base EXP + 80 % of its EXP) and the
    four EXP items are not built yet — EXP is the one Soul-heart EXP currency.
67. **R6a Plates, part 1.** Copied from the source: 54 plates (18 types × 3 grades) named by each card's
    type, one stat table for all (stage 18: HP +780,002, P.ATK / S.ATK +110,931, Total HP +30 %), the step
    prices (630 Bottles + 2,625 Fragments to 18), player Lv 34 / 6★ unlock, Pokémon Lv 47 from stage 6 and 60
    from stage 12. The plate stays on the Pokémon's held-item faction lines as before. Not yet: the plate
    skills at tiers 6 / 12 / 18 and the stage-6 skill swaps (part 2).

68. **R6b Trinkets, part 1.** Copied from the source (hero_weapon / hero_weapon_cost): 76 holders, levels 0–40,
    the stats at each level, the price (300,430 Star Shards plus 2,540 of the holder's own item at levels 9 / 19 /
    29 / 39 — e.g. Beldum Sunglasses), unlock at 6 Pokémon on Lv 220 and the holder at 7★ (kb). Readings:
    "Pokémon HP / Attack %" (attr 406 / 407 / 409, the Pokémon layer) count as the sheet's HP / P.ATK / S.ATK %
    lines — there is no base-only % layer yet. The own items come as trinket chests (owner, 2026-11-01: "the faction
    shop sells boxes that have the trinkets"): six chest kinds (hero_weapon_box: Orange 27 holders, Red 15, Blue 10,
    Trinket Chest 8, Shiny Supreme Box 6 — the shinies — and Purple 6), each spent one-for-one when the own item
    runs short. The Faction Tower Shop sells them ×100 for 2,000–10,000 Faction Tower Coins (limit 999; source shop
    25) and the Guild Shop four of them ×20 (5 a week). Raichu, Charizard, Blastoise and Venusaur have no chest in
    the source. The coins have no in-game source until the Faction Tower is built (R9); a debug grant until then. Starmie, Ninetales and the Origins have
    no trinket (the Origins' follows its three synergy Pokémon — waits for the synergy system). The skills at
    Lv 10 / 20 / 30 / 40 come in part 2.

69. **DEF is on (owner, 2026-11-01: "def should not be turned off"; strength "Light").** The source measurements
    found main P.DEF / S.DEF did nothing measurable, so there is no source number: `defendersUseDef` is now
    `true` with `defK` 300,000 on the existing `def / (def + defK)` curve — a maxed DEF tank (~76k P.DEF) takes
    about 20 % less damage, an attacker (~15k) about 5 % less. This replaces M9 decision 1 ("DEF stays inert").
    With it, the skills' DEF lines are live: "ignore x % DEF" (skill `ignoreDefense` plus a new `ignoreDefense`
    stat for trinket / stack effects) and DEF cuts / steals as buffs. P.ATK / S.ATK / P.DEF / S.DEF stat buffs
    now count as shares of the unit's own stat (every such buff in the kits was a %; they used to add the raw
    number, so +5 % S.ATK added 0.05 points). Re-checking balance with DEF on belongs in the R10 tier re-check.

70. **R6d Berries.** Copied from the source (boosts_cfg berry_* tables and the dump's `_berries` note): 19 berries
    in four tiers (the three Commons fixed, no stars), one star ladder (Elevation: copies of the same berry and of
    any berry at 1★ that were never cultivated, plus Gold), four breakthroughs (+1…+4: trainer Lv 40 / 45 / 50 / 60
    and 10 / 20 / 30 / 40 Blue → Red Mulch), 15 line kinds with caps by stage, 100 Berry Essence a Cultivation
    (Fast: 10), Reforge 10 / 20 / 35 / 35 / 35 Potions by line, dismantle 50 / 40 Essence for uncultivated berries
    only, two slots and one berry per type per Pokémon, and every berry's skill by star. The server's own rules
    are not in any dump; the owner confirmed (2026-11-01): one line at the start and one more per breakthrough;
    one Cultivation raises every line by 1–3 % of its cap ("50 sounds right" to fill a line); Reforge re-rolls a
    line's kind and keeps its share of the cap; Rebirth (100 Diamonds) gives back every item used on the berry
    (Essence, Mulch, Reforge Potions, Gold and the berries fed to its stars, as new 1★ berries) and returns it
    to its start star, +0 and one empty line. Still a stand-in: a new or re-rolled line's kind is drawn evenly
    from the kinds not already on the berry. Berries are
    no longer used up by battles (that was the M11 stand-in). Berries come only from the starting four and the
    debug grant until shops / modes carry them (the source sells them in the Rank Ladder shop).

