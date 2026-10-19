# Changelog

Every milestone appends a note here. Bugs found in the reference and worked around in the engine
are recorded here with the difference (never edit `reference/`).

## M0 — Foundations (2026-10-09)

- Scaffolded the pnpm workspace: packages engine / content / server / client / cli, plus tests/.
- Deterministic PRNG (`mulberry32`) with tests — the foundation rule for the whole engine.
- `GameServer` boundary type (typed `Result` + `ServerError`), tests included.
- Hello-world React client: Home screen, five-tab bottom nav, i18n scaffold (`t()`), design tokens,
  light/dark + reduced-motion support; out-of-scope tabs show an honest "coming later" state.
- IP guard test (Appendix C) + shared guard implementation in the CLI; wired into
  `pnpm content:validate` and the `pnpm check` gate.
- Playwright e2e (boot + coming-later states) over mobile and desktop viewports.
- Docs: SCOPE, ASSUMPTIONS, RULES, CONTENT, CHANGELOG, design/ index.
- `reference/` mirror of the research repo (36.6 MB, text only) placed read-only and gitignored.

### Deviation from the reference

- None yet. **Note:** `reference/sim/` is missing (the Python battle simulator files were not
  found anywhere on the machine); M1 proceeds from the documented formulas until the owner supplies
  them — see docs/ASSUMPTIONS.md.

## M1 — Combat engine (2026-10-10)

- `@wildbound/engine` combat module: `types`, `settings`, `stats`, `buffs`, `damage`, `targeting`,
  `sustain`, `counter`, `skills`, `battle` — pure and deterministic (no `Math.random`/`Date`), all
  randomness through the injected seeded PRNG (`mulberry32`).
- Battle loop (`runBattle`): big-rounds, SPD-ordered turns, mid-round wipe break, 15-round time-out
  to the defender, full `BattleEvent` log, and a result ledger (damage dealt/taken, healing).
- Kit DSL: zod schemas in `@wildbound/content` (`kitSchema`, `combatSettingsSchema`, …) and
  `content:validate` now parses every kit + tuning file against them.
- Damage pipeline: ATK/DEF + rate, crit (`critSlope × (crit − critRes)`, capped), block piecewise
  (`block − guardBreak`), PvP floors/constants, ult/skill lines, hp-share and DoT paths.
- Rage model: per-action gain, hit-based proportional rage on the defender, flat `rageHitBase` for
  direct hits, `rageOnHit` talents, and `rageCutChance` (attacker loses `rageMax/8`).
- Control suite: silence/confusion/paralysis/stun with Control Res, immunity windows (safeguard),
  confusion self-redirect, confined (untargetable) units.
- Talents/turn hooks: `tidewarden` guardian kit + `allyShelterStack` dmgRdct stacking.
- Tests — 58 engine tests: damage/rules/battle/statistical (20k-trial convergence)/property
  (fast-check). Golden regression: deterministic TS replay (`golden.test.ts`) over committed
  baselines for two scenarios.
- CLI: `pnpm sim <scenario.json>` (renders the event log) and `pnpm golden-export`
  (`pnpm sim:golden`) regenerate baselines.
- Content: `kits/tidewarden.json`, `kits/twigleaf.json`, `tuning/combat.json`.
- Lint/typecheck/test/content:validate green.

### Deviation from the reference

- **Golden parity is self-referential, not Python parity.** With `reference/sim/` absent (M0 note),
  the M1 "golden" lock is a deterministic TypeScript replay suite: `pnpm golden-export` writes event-
  log folds for the scenario fixtures and `golden.test.ts` replays them exactly. When the Python
  simulator arrives, add true cross-language parity scenarios without removing these.

## M2 — Content core (2026-10-11)

- **Schemas** (`@wildbound/content/src/schemas.ts`): `speciesSchema`, `growthSchema`, `powerSchema`,
  `coreStatsSchema` (+ type exports).
- **36 original Wilds** (6 per faction) in `packages/content/species/<faction>.json`: id, name,
  faction, class, tier, description, `paletteSeed`, 1–3 evolution stages, six base stats. Authored
  from a tier/class table with deterministic jitter — no reference rows copied.
- **36 skill kits** in `packages/content/kits/<faction>.json` (arrays of six), covering every
  required archetype: counter, guaranteed-freeze, stated-chance stun, healer, shield, lowest-HP,
  row-sweep, %max-HP, and immunity. The M1 `tidewarden` kit is preserved byte-identically.
- **Growth & Power tuning**: `packages/content/tuning/growth.json` (multiplicative stat formula
  factors) and `tuning/power.json` (Power core/percent weights + scale).
- **Engine growth module** (`@wildbound/engine/src/growth/`): `resolveCoreStats`, `levelCurve`,
  `starMult`, `evolutionMult`, `levelCap`, `computePower`, `teamPower` — pure, tuning injected.
- **Content loaders** (`@wildbound/content`): validated `WILDS`, `KITS`, `COMBAT_SETTINGS`,
  `GROWTH`, `POWER` exports; the client imports these at build time.
- **Validator** (`packages/cli/src/validate-content.ts`): per-dir schemas, per-filename tuning
  schema, duplicate-id detection, species↔kit cross-reference, faction coverage (6 each), array-aware
  empty-field scan. `kit-loader` now accepts single-object or array files.
- **Procedural gallery** (client): `src/art/{palette,creature,WildPortrait}`, `pages/Gallery.tsx`
  at `/gallery` (linked from Home); deterministic seeded SVG, no binary media. i18n label helpers for
  factions/classes/tiers. e2e extended (gallery renders ≥36 portraits; HUD now "Milestone 2").
- Tests — engine growth tests (stats + Power); 13 test files green. `pnpm check` green.

### Deviation from the reference

- **Multiplicative stat formula** (our design; the reference model is linear) — see docs/ASSUMPTIONS.md M2.
- **Power weights are our own fit** of the reference `attr_power_weight` shape.

## M3 — Account, roster, growth, squads (2026-10-11)

- **Engine roster module** (`@wildbound/engine/src/roster/`): `types` (WildInstance/AccountState/
  Squad/Currency/Strategy, front/back slots), `costs` (level/star/evolve cost + eligibility),
  `actions` (leveledUp/starredUp/evolved/respawn), `squad` (`autoFormation`), all pure and tuning-
  injected; unit tests for costs, actions and formation.
- **Content tuning**: `growth.json` gains a `progress` block (`levelUp`/`starUp`/`evolve`/`respawn`)
  and `tuning/account.json` (starting name, currencies, 6-Wild seed roster, debug grant amounts).
  `tuningSchema`/`accountSchema` added; validator now checks `account.json` and resolves its starting
  roster against the species set.
- **Server** (`@wildbound/server`): `GameServer` gains the M3 action set; `save.ts` (versioned codec +
  migrate + one-step backup), `storage.ts` (`SaveStore` + `MemoryStore` + `IndexedDbStore`),
  `config.ts` (`buildConfig` from content), `local-server.ts` (`LocalServer` with autosave and derived
  Power/team-Power snapshots). Server tests cover grant/level/evolve/squad/auto-formation/persistence/
  corrupt-recovery/export-import/reset.
- **Client**: `ServerProvider` context + global `Hud` (currencies with debug `+`, UTC clock, error
  banner); `Wilds` roster (filters, sort, team Power), `WildDetail` (Upgrade/Evolve tabs), `Squad`
  editor (modes, front/back, pick-and-assign, Auto Formation, strategy), `More` debug screen. Vite
  `base` corrected to `/` so deep routes (e.g. `/wilds/:id`) load assets on refresh.
- **e2e**: new `m3.spec.ts` (roster seeding, detail tabs, Auto Formation, debug grant persistence, level
  persistence across reload); `boot.spec.ts` updated to Milestone 3.
- Tests — 120 unit tests (17 files) + 12 Playwright tests green; `content:validate` PASS; `pnpm check`
  green.

### Deviation from the reference

- **Simplified progression**: one 1..`maxStars` star axis (gates evolution, multiplies stats) instead
  of the reference per-quality star cap; evolution ≤3 stages; generic `shard` star material instead of
  species-copy fodder. See docs/ASSUMPTIONS.md M3 and docs/design/account.md.
- **Simplified HUD**: no avatar/VIP/XP bar yet (arrives with the M5 loop).

## M4 — Battle UI, replay from the event log (2026-10-11)

- **Engine replay reducer** (`@wildbound/engine/src/combat/replay.ts`): `initReplay`/`stepReplay`/
  `replayTo` fold the immutable `BattleEvent[]` a battle already produced into per-frame visual state
  (HP/rage/shield/alive/round/winner/buff tags), plus `lastActor`/`lastTarget` highlights. Pure and
  content-free; 9 unit tests (immutability, prefix determinism).
- **Server battle setup** (`@wildbound/server/src/battle.ts`): `slotToPosition` (front slots 0–2 →
  positions 4–6, back 3–5 → 1–3), squad → `SpecInput[]` (growth stats + kit conversion identical to
  the CLI), and `startBattle(config, state, mode, seed?)` → `BattleView` (`{ seed, mode, winner,
  rounds, events, units, teams }`). Enemy is a mirrored "echo" of the player's squad so a fresh
  account can always fight; the seed is server-side randomness. `GameServer` gains `startBattle`;
  `LocalServer` implements it without mutating the save. 5 server tests (incl. same-seed determinism
  and fold-to-winner).
- **Client Battle screen** (`/combat`, `pages/Combat.tsx` + `components/BattleField.tsx` +
  `components/ResultPanel.tsx`): play/pause, 1×/2×/4× speed, single-step forward/back, restart,
  skip-to-end; 6v6 field with HP + rage bars, shield badge, buff chips, actor/target highlight, and
  floating damage/heal/crit/block/miss popups; round header; compact result panel (winner, rounds,
  seed, per-unit dealt/taken/healed) and an expandable battle-log drawer. `ServerProvider` exposes
  `startBattle`; the Combat tab is now live (was a "built in M4" placeholder); HUD reads "Milestone 4".
- **e2e**: new `m4.spec.ts` (replay to a result, restart replays identically, step + speed cycle, log
  availability); `boot.spec.ts` updated (Milestone 4; Summon is the remaining coming-later tab).
- Tests — 134 unit tests (19 files) + 18 Playwright tests green; `content:validate` PASS; `pnpm check`
  green.

### Deviation from the reference

- **The battle is generated once and replayed, never re-simulated per frame.** The client folds the
  server's `BattleEvent[]`; there is no per-frame randomness, so a recorded fight always replays
  identically (PROMPT §6.1).
- **Shield bars are approximate**: `hit.hpAfter` already nets shields and the engine does not log
  shield absorption, so the shield badge shows the last `shield` event's value (see ASSUMPTIONS M4).
- **Minimal vertical slice**: one campaign battle vs a mirrored echo squad; other modes, a real
  defender list, team preview and result-panel depth arrive with the campaign loop (M5) and later.
- **Squad strategies remain inert** (carried from M3); battle setup does not yet read them.

## M5 — Campaign, idle and daily loop (2026-10-12)

- **Engine time module** (`@wildbound/engine/src/time/`): `dayKey(ms)` (UTC day string) and helpers
  for the daily reset boundary; pure and clock-free.
- **Engine campaign module** (`@wildbound/engine/src/campaign/`): `orderStages`, `isUnlocked`
  (stage ladder), `starsOf`/`recordStars`/`starsForRounds`, `isCleared`, and `bestIdleStage` — the
  rules that turn cleared stages into unlocks, stars and the idle rate. Unit tests included.
- **Engine economy module** (`@wildbound/engine/src/economy/`): `initialIdle`/`accruedMinutes`/
  `pendingIdle`/`remainingIdle`/`quickCollect` (12h cap), `addRewards`/`applyRewards`/`scaleRewards`/
  `isZeroRewards`, `addQuestProgress`/`questProgress`/`isQuestClaimable`/`emptyQuestState`,
  `claimChest`/`claimableChests`/`activityPoints`, and mail (`createMail`/`pruneMail`/`unclaimedMail`).
- **Engine daily module** (`@wildbound/engine/src/daily/`): the reset rollover for quests + quick
  collects keyed by `dayKey`.
- **Content**: `stages/chapter1..3.json` (18 stages: enemy squads, first-clear/repeat rewards,
  per-minute idle, star round thresholds), `quests/daily.json` (6 daily quests + activity chests) and
  `tuning/economy.json` (idle caps, trainer XP curve, activity chests, mail TTL, welcome grants).
  Schemas + validator extended (stage/quest/tuning cross-checks; campaign now reports "18 stages across
  3 chapters").
- **Server**: `LocalServer` gains `challengeStage` (stage battle → rewards, stars, first-clear, chapter
  mail), `sweepStage`, `claimIdle` (+ quick collect with daily limit), `claimQuest`, `claimActivityChest`,
  `claimMail`/`claimAllMail`, `skipTutorial`/`advanceTutorial` and `debugAdvanceClock`. Trainer XP/level
  derived from grants (`economy.ts`); the save gains M5 slices with a v1→v2 migration
  (`campaign`, `idle`, `quests`, `mail`, `tutorial`, `debugClockOffset`). `m5.test.ts` (14 tests) and a
  new `campaign-balance.test.ts` (reaches the end of chapter 3) prove the loop.
- **Client**: Home becomes a town hub (Campaign / Idle / Quests / Mail / Wilds / Squad / Gallery tiles
  with badges) plus the first-session `Tutorial`; new `Campaign` (chapters, stars, challenge/replay/
  sweep), `Idle` (accrual bar, collect, quick collect), `Quests` (activity points, daily quests, chests),
  `Mail` (claim / claim all), `RewardLine`, `BattleReplay` extracted from the M4 Combat screen so battles
  can be replayed from the campaign; HUD gains the trainer XP bar and reads "Milestone 5".
- **e2e**: new `m5.spec.ts` (tutorial skip, stage win → stars + next-stage unlock, idle accrual + collect
  via the debug clock, welcome mail claim, idle-quest completion + claim); `boot.spec.ts` updated
  (Milestone 5; the Home gallery link is now the "Gallery" town tile).
- Tests — 36 server tests + all-package unit suite + 28 Playwright tests green; `content:validate`
  PASS; `pnpm check` green.

### Deviation from the reference

- **The campaign difficulty curve is our own and was re-tuned in this milestone.** The authored
  chapter 2-3 squads used legendary/mythic/supreme species at high star/evolution stages that the
  starter (all-common) roster could never beat — and summoning (M6) does not exist yet, so a fresh
  player could not progress past chapter 1 stage 2. Chapters 1-3 were re-authored to use only
  common/rare species with a gentle level/star curve so the starter roster clears chapter 1 within the
  starting budget and reaches chapter 3 as the idle/quest income accrues. See docs/design/balance.md and
  docs/ASSUMPTIONS.md M5.
- **Debug clock offset is minutes, applied as milliseconds at the boundary.** `debugAdvanceClock(n)`
  stores `n` minutes; both the server game clock (`LocalServer.now`) and the Idle screen convert to ms
  (`× 60_000`) before measuring accrual. A units bug (offset added as ms) was fixed here and locked by a
  test that fast-forwards 12h and claims a full idle cap.
- **Idle is capped and hand-claimed** (12h cap, 3 quick collects/day for gems) rather than the
  reference's auto-collect flow; the loop stays fully client-side on `IndexedDB` for now.

### Carried forward

- Squad strategies remain inert; weather/round banners, team preview and richer result panels are still
  deferred (M4/M10). Summoning arrives in M6.

## M6 — Summoning and shops (2026-10-14)

- **Engine gacha module** (`@wildbound/engine/src/gacha/`): `GachaMachineDef`/`GachaPoolEntry`/
  `DrawResult`, `drawBatch` (ten-draw guarantee one Rare-or-better, pity forces Legendary+ at 1,000
  Premium credits), `pickSpecies` (wished species ×`wishBoost` inside its tier), `rollTier`,
  `tiersAtLeast`, `probabilityTable` and `resolveSummonCost` (free → ticket → gems). Pure and seeded.
- **Engine shop module** (`@wildbound/engine/src/shop/`): `nextRestockAt` (`daily` hours /
  `interval` days / `manual`), `restockDue`, `applyRestock`, `buyLimit`/`boughtCount`/`buyBlock`,
  `manualRefreshBlock`, `recordBuy`, `isOneTimeBought`, `refreshesLeft`, `initialShopState`.
- **Economy shape**: `CurrencyId` grows from five to thirteen (tickets + six mode/shop coins);
  `CURRENCY_IDS` and `HUD_CURRENCY_IDS` (the seven the header shows); `Rewards` gains every key.
- **Content**: `tuning/gacha.json` (two machines), `shops/*.json` (six shops), the `gachaSchema`/
  `shopSchema` + loaders, and `schemas.ts` rebuilt from the M3-era shape and extended with the
  gacha/shop/economy schemas. Validator parses `gacha.json` and cross-checks every shop currency.
- **Server** (`@wildbound/server`): new `gacha.ts`/`shops.ts` view + mutation builders (`applySummon`,
  `applyClaimBox`, `applySetWish`, `applyBuy`, `applyRefresh`, `gachaView`, `shopsView`); `GameServer`
  gains `summon` (single/ten, optional seed), `claimGachaBox`, `setWish`, `getGacha`, `buyShopItem`,
  `refreshShop`, `getShops`; `LocalServer` implements them behind the `Result` boundary. Save schema
  `3` with a lenient M6 migration (`withM6Defaults`) that still rejects core-less states.
- **Client**: `/summon` (two machines, free draws + cooldown, box claim, pity bar, exact tier/species
  rates, featured Wild, result grid and history) and `/shop` (six shops, restock countdowns, manual
  refresh cost/limit, per-item remaining/affordability); Home town tiles; `ServerProvider` wrappers;
  HUD shows the seven primary currencies; `RewardLine` renders all thirteen; M6 styles.
- **Tests** — engine gacha (9) + shop (7); server `m6.test.ts` (15: cost fallback, ten-draw
  guarantee, seeded reproducibility, exact pity threshold, box claim, wish set/clear, buy/limit/
  restock/one-time/manual-refresh); `tests/e2e/m6.spec.ts` (5). `pnpm check` green.

### Deviation from the reference

- **Duplicates grant fresh Wilds (no shard conversion)** and **the wish is species-level**, per
  docs/ASSUMPTIONS.md M6. The wish is unlocked (`wishUnlockDraws = 0`) so the M6 screen is live.
- **The free-draw cooldown is per-machine** (5 min Common / 1440 min Premium), and only single draws
  consume a free draw.
- **`schemas.ts` was reconstructed** during this milestone: a stale transpiled copy in the tsx cache
  had been mistaken for the M3 source, so the file was rebuilt from the intact M3-era copy under
  `Documents/GitHub/wildbound` and then extended with the M6 schemas. The public schema/type surface
  is unchanged from M3 for account/roster/rewards plus the new gacha/shop slices.

### Carried forward

- Squad strategies remain inert. VIP tiers, gift crates and the "Supreme Gift" storefront are
  deferred to M11 (social); the mode coins' primary sources land with their modes (M8/M10/M11).
- Equipment layers (Relics, Runes, Charms, Spirit Cores, Talents) and the duplicate→material sink
  arrive in M7.

## M7 — Equipment layers (2026-10-14)

- **Engine equipment module** (`@wildbound/engine/src/equipment/`): `types`, `rules`, `contrib` —
  relics, rune sockets + set bonuses, charms, spirit cores and talent trees, folded into a Wild's
  stat sheet (`foldLoadout`/`mergeDelta`) and Power. Pure and content-free.
- **Content**: `equipment/relics.json`, `runes.json`, `charms.json`, `cores.json`, `talents.json`
  plus `tuning/equipment.json`; new equipment schemas + loaders and `content:validate` coverage.
- **Server** (`@wildbound/server`): `equipment.ts` (equip/level/refine/upgrade/allocate/reset as pure
  `Result<AccountState>` actions) and `equipment-view.ts` (gates, deltas, owned items). `GameServer`
  gains `getEquipment`, `equipRelic/Rune/Core/Charm`, `upgradeCharm`, `levelRelic`, `refineRelic`,
  `levelRune`, `chooseTalentTree`, `allocateTalent`, `resetTalents`. Save schema `4`.
- **Client**: Wild screen Equip / Runes / Cores / Talents tabs; `ServerProvider` wrappers; M7 styles.
- **Tests**: engine equipment suite + server glue. `pnpm check` green.

### Deviation from the reference

- Stat contributions are our own multiplicative/percentage model with all numbers in content, not a
  copy of the reference's equipment tables (see docs/design/equipment.md).

## M8 — Trials, Tower, World Boss, Daily Dungeons, Link Crystal (2026-10-15)

- **Engine PvE module** (`@wildbound/engine/src/pve/`): `reset` (`weekdayUtc`, `weekKey` ISO weeks,
  `isSameUtcWeek`, `nextWeekStart`), `curve` (`curveLevel`/`generateEnemies` from a pool + slope),
  `tower` (floor/milestone reward curves, `nextTowerFloor`, `advanceTower`, `spendSweep`), `trials`
  (`TrialRule`, `trialAvailable`, `trialBattleRules` → `BattleRules`), `worldBoss` (weekday rotation,
  damage milestones, `ghostRecords`/`rankDamage`), `dungeons` (weekday lookup), and `linkCrystal`
  (`crystalCap`, `effectiveLevelCap`, unlock/upgrade rules). Pure; every table is an argument.
- **Combat**: `BattleConfig.rules` (`BattleRules`) enforces `noUltimate` (never pick the ultimate
  when enraged) and `survivalRounds` (cap the loop and flip the time-out to the attackers).
- **Content**: `tuning/pve.json` (tower, link-crystal, world-boss rotation + milestones, five trials,
  seven weekday dungeons) with a new `pveSchema`, loader, and validator cross-checks (pools →
  factions, boss rotation → species, dungeon weekdays unique).
- **Server** (`@wildbound/server`): `pve.ts` (mode actions) + `pve-view.ts` (display views);
  `modeBattle` in `battle.ts` (faction-lock, level-cap, battle rules); `GameServer` gains
  `getTower/challengeTower/sweepTower`, `getTrials/challengeTrial`, `getWorldBoss/challengeWorldBoss/
  claimWorldBossMilestone`, `getDungeons/challengeDungeon`, `getLinkCrystal/upgradeLinkCrystal`. Save
  schema `5`; the crystal unlocks lazily in `normalize` and raises the level cap used by `levelUp`.
- **Client**: the Combat tab becomes the **Challenges hub** (`/combat`) with routes `/tower`,
  `/trials`, `/boss`, `/dungeons`, `/crystal` (the M4 demo moves to `/combat/training`). Rewards reuse
  `RewardLine`; results reuse `BattleReplay`. `ServerProvider` gains a generic `call` helper.
- **Tests**: engine `pve.test.ts` (25) + battle-rules tests; server `pve.test.ts` (12: pools,
  tower/sweep/caps, trials (rule + first-clear + weekday lock), dungeons, world boss damage/attempts/
  milestones, crystal lock/unlock + level-past-cap); `tests/e2e/m8.spec.ts` (6). `pnpm check` green.

### Deviation from the reference

- **Tower climbs reset weekly, sweeps daily; floors are permanent** (PROMPT §7.6) rather than the
  reference's per-day climb reset. See docs/ASSUMPTIONS.md M8.
- **Every mode's enemy squad is generated from a difficulty curve** rather than authored floor/area
  tables. **World-boss ranking is a local ghost ladder** (own history + deterministic bots); there is
  no backend. **The Link Crystal's star gate ships as 10★** because our `maxStars` is 10, and it
  unlocks on a Wild that is final-form *and* at its form cap.

### Carried forward

- Arena/ranked/weather (M10) reuses the world-boss ghost-ladder shape; mode coins gain their main
  sources as their modes ship. Squad strategies remain inert.

## Content override — Pokémon roster (2026-10-15)

- **Owner override of §2.1.** This private, never-distributed build ships the owner's Pokémon-themed
  roster. `PROMPT.md` §2.1 and the AGENTS.md IP rule were amended, and `FORBIDDEN_WORDS` in
  `packages/cli/src/ipguard.ts` now lists only the remaining franchise terms. Rationale and scope are
  recorded in `docs/ASSUMPTIONS.md` ("Owner content override").
- **Content — species.** The 36 original Wilds are replaced by the sheet's **84** creatures, grouped
  across the six factions (Fire→ember, Water→tide, Grass→grove, Dark→shade, Light→volt/frost).
  Species, stats and three evolution stages are regenerated by `scripts/import-roster.mjs`; stages,
  `startingRoster` and the world-boss rotation were re-pointed to the new ids.
- **Content — skills.** The 17 creatures whose skills were captured get real kits ported into the
  content DSL (targets, controls, DoT, lifesteal, debuffs, talents); the remaining 67 use the three
  original class archetypes. Ally-wide buffs, rage generation, cleanses, on-hit passives and
  heal-over-time have no DSL home and are dropped. Mapping: `docs/design/roster-import.md`.
- **Validator + parity.** The "exactly six species per faction" rule is relaxed to "every faction has
  at least one species". The M1 parity kits `tidewarden`/`twigleaf` now live byte-identically as
  fixtures at `packages/cli/tests/golden/kits/parity.json`, so **no original Wild remains**; client
  and e2e text updated.
- **Green.** `pnpm check`: lint + typecheck + 253 unit tests + `content:validate` (84 ↔ 84) + 50 e2e.

## Plan change — milestone renumbering (2026-10-16)

- **The skill-kit work becomes a milestone.** The engine/DSL expansion + faithful 84-creature kit port
  (previously unnumbered) is now **M9 — Skill kits**.
- **Renumbered forward milestones.** M9 PvP is now **M10 PvP**; M11 Social and M12 Hardening keep their
  numbers; **Build Lab moves from M10 to last — M13**.
- Authoritative lists updated in `PROMPT.md` §13, `AGENTS.md`, and `docs/SCOPE.md`; forward-looking
  milestone references throughout the docs and code were updated to match (before this note the
  numbering was: M9 = PvP, M10 = Build Lab).
- Status: plan-only; no game code changed.

## M9 — Skill kits (combat DSL expansion + faithful 84-creature port)

Ships in seven commits (M9.1–M9.7). M9.1–M9.6 are landed; M9.7 (re-tune) is the last step.

- **Additive DSL v2** (`packages/content/src/schemas.ts`, `packages/engine/src/combat/*`): every new
  field is optional and an absent field keeps the M1 behaviour, so the golden/parity/statistical suites
  stay green.
  - **M9.1 targeting + damage:** new target `rule`s (`frontline`, `backline`, `highest_hp`, `highest_atk`,
    `highest_spd`, `same_position`, `adjacent`), `side: enemy | ally`, `rowFilter`, `filters`, `condition`;
    `hpShareBasis` (`current` / `max` / `missing`), `trueDamage`, `ignoreShield`, `ignoreDefense`, a
    structured `dot` spec (share/basis/type/turns/maxStacks/undispellable), `bonusVs`, `recastOnKill`.
  - **M9.2 effects + conditions:** an ordered `SkillDef.effects[]` (buff, dot, control, heal with `over`
    → regen, shield, cleanse, dispel, rage, resource, revive, secondary damage) plus the `Condition`
    set (`selfHpBelow`/`targetHpBelow`, `selfHasTag`/`targetHasTag`, `*StackAtLeast`, `targetControlled`,
    `targetHasDot`, `allyUnderControl`, `targetRow`, `targetTrait`), `undispellable` and immunity wiring.
  - **M9.3 resources + scaling + cooldowns:** `Combatant.resources` with a `stack` buff kind, read by
    scaling and conditions; `scalesWithLevel` ladders; `cooldown`/`perTurn`.
  - **M9.4 talents + triggers:** `talents.triggers[]` over `battleStart · roundStart · roundEnd ·
    turnStart · turnEnd · onHit · onKill · onDeath · onAllyDeath · hpBelow` (bounded by
    `triggerDepthCap`), `talents.passive`, `rageStart`, `rageOnAction`.
  - **M9.5 DEF switch:** `CombatField` gains `pDef`/`sDef` and a `defK` saturating curve
    (`def / (def + defK)`) behind `defendersUseDef` (still **false**, per ASSUMPTIONS M9 #1).
  - **M9.6 port primitives:** taunt becomes forced targeting, HP-basis damage (current/missing HP),
    true-damage DoTs and a per-action `basicRate`.
- **The faithful port (`scripts/port-skills.mjs`).** The captured sheet (`scripts/data/pokemon-skills.json`
  — 84 creatures × Basic Attack / Basic Skill / Ult / Passive / Talent 1–4 = **579 rows**) is parsed into
  the shipped kits: **84 kits written, 0 unmatched, 0 unported, 0 damage-line fallbacks**. The script is a
  dev tool (run after `scripts/import-roster.mjs`); it preserves each kit's id/name/faction/class/tier and
  replaces only `skills`+`talents`, so it is re-runnable. Clauses the rule library cannot express are
  **counted, never approximated**, in `docs/PORT-REPORT.md` (111 distinct residual patterns, e.g. LV.2+
  upgrade text 24, skill phase markers 21, talent modifiers 36, per-action rage generation 68).
- **Content.** All 84 `packages/content/kits/<faction>.json` regenerated; `dot` effect gains a `tag`.
- **Tests.** `packages/engine/src/combat/porting.test.ts` (5) + `dsl.test.ts` / `effects.test.ts` /
  `scaling.test.ts` / `triggers.test.ts` / `defense.test.ts`; new `packages/cli/src/port.test.ts` (10
  faithfulness assertions over the shipped kits). Suite: **38 files / 316 unit tests** + 50 e2e;
  `content:validate` PASS; `pnpm check` green.

### Deviation from the reference

- **The sheet's LV.2/LV.3 notes are recorded as upgrade text, not modelled** (the engine has no per-skill
  level track) — ASSUMPTIONS M9 #13. Named statuses applied without an inline damage figure become
  `resource` marks (no invented DoT); a bare "damage" clause infers P/S from the creature's own rows;
  conditional damage riders ("… vs backline by 25%") and clauses with no primitive (skill cooldown,
  cheat-death, splash, per-battle uses) are recorded in `docs/PORT-REPORT.md`, never approximated
  (ASSUMPTIONS M9 #15–#19).
- **`defendersUseDef` still ships `false`** (the measured model): the new P.DEF/S.DEF fields are stored
  faithfully and only cut damage if the switch is turned on.

### Carried forward

- **M9.7 re-tune** — campaign balance regression re-verified with the ported kits; no curve or `combat.json` deltas required (100% clear through chapters 1–3 at the target profiles); statistical suite green. Arena/ranked
  (M10) reuses the M8 world-boss ghost-ladder shape.

## Decision — art media allowance (2026-10-17)

- **The IP guard's media check is amended (option B), not removed.** `scanBinaryMedia` now exempts
  `packages/client/public/art/` (new `ART_MEDIA_ALLOWLIST` + a pure, unit-tested `isAllowedMediaPath()`),
  so 2D sprite image files may live there; every other image/audio/font file under `packages/` is still
  refused and all other art/audio stays procedural. The franchise-term scan (`FORBIDDEN_WORDS`) is
  unchanged, and both guard suites gained allowlist tests. Recorded in `docs/ASSUMPTIONS.md`
  ("Art media allowance") and reflected in `AGENTS.md` / `PROMPT.md` Appendix C.
- **Context.** The owner chose the hybrid art path (image sprites where supplied, procedural SVG as the
  fallback) and wants the visual-identity pass — original 2D sprites, a source-accurate UI palette, and
  full battle effects — to land after M10 PvP and before the shared backend (M12).

## Plan — M10 begins; shared service required (2026-10-17)

- **Order set: M10 PvP → visual-identity pass → M12 backend → M11 social → M13 Build Lab.** The owner
  confirmed M10 first; the visual pass (2D sprites, a source-accurate UI palette, and battle effects)
  lands before the shared backend, so the group sees the intended look from the start.
- **The M12 backend is now required, not optional** (owner decision; recorded in `docs/SCOPE.md` and
  `docs/ASSUMPTIONS.md` › Owner content override, item 9). Distribution stays private and invite-only
  for a small trusted group — no public release.
- **M10 design written: `docs/design/pvp.md`** — Arena (credits, three matched ghost opponents, daily
  participation chests, weekly settlement by rank via Mail), the Ranked ladder (8 regions × 12 tiers,
  +35/-20 with the threshold stop and promotion matches, faction weather, best-of-3), deterministic
  ghost squads, and live squad strategies. Implementation proceeds in sub-steps M10.1–M10.6, one
  passing commit each.
- **Naming (owner decision, 2026-10-17).** The Ranked ladder ships the franchise's own region and tier
  names (Kanto → Galar; Vanguard I–III / Elite I–III / Commander I–III / Legend / Overlord / King) in
  `packages/content` only — display strings, no code branches on them. Recorded in `docs/ASSUMPTIONS.md`
  › Owner content override, item 10.

## Plan — full mode roadmap and milestone renumber (2026-10-17)

- **New order: M10 → all remaining modes and systems → visual pass → backend → Build Lab.** The owner
  asked to build the rest of the reference's modes and systems before the art pass and the server.
- **Milestones M11–M20 rewritten** (PROMPT §13, AGENTS.md, `docs/SCOPE.md` and `docs/ASSUMPTIONS.md`
  updated): **M11** growth/collection II (Potential, Orbs, Soul-hearts, Plates, Trinkets, Held Items,
  Resonance, Berries, VIP) · **M12** Ancient Artifacts + Suppression + Ruins Adventure · **M13** Explore
  modes (Hoopa's Vault, Rift Arena, Gods Trials, Sky Pillar, Faction Tower, Misty Woods, Pet Home,
  Island Challenge, Ultra Wormhole) · **M14** Combat/co-op modes (Victory Road + King's Trial, Paradise,
  Joint Team + Dynamax, Clash of Isles, Shovel Carnival) · **M15** Guild + merge + events · **M16**
  Guild war + Relic Battlefield · **M17** Cross-server PvP · **M18** Visual-identity pass · **M19**
  backend (required) · **M20** Build Lab.
- **Renumber map:** the old M12 backend is now **M19**; the old M13 Build Lab is now **M20**; the old
  M11 social is folded into **M15**. Entries above keep their original numbers (they record the plan as
  it stood then); the new numbers apply from here on.
- **Next: finish M10** — M10.1 (content table + engine core) through M10.6, then begin M11.

## M10.1 — PvP content table and engine core (2026-10-18)

- **Content.** `packages/content/tuning/pvp.json` with `src/pvp-schema.ts` + `src/pvp.ts`, exported
  from the registry and wired into `GameConfig.pvp`. The 12 Ranked tiers and the challenge-gift track
  are shared by every phase; each phase carries its format, weather rotation and per-tier coin values.
  The CLI validator maps `pvp.json` to its schema and cross-checks faction references, the six-faction
  weather coverage, ascending Arena bands and the campaign gates.
- **Engine `packages/engine/src/pvp`.** `types.ts` (vocabulary), `arena.ts` (credits, bands, ranks,
  the day roll, chests, best-rank achievements, the weekly settlement), `ranked.ts` (dan
  encode/decode, the scoring model with the threshold stop and the promotion match, the Mon 03:00 →
  Sun 22:00 season window, the 03:00 daily boundary, attempts, tier/gift claims), `weather.ts`
  (season-keyed faction pick → `BattleRules.weather`) and `ghosts.ts` (deterministic opponent seeds
  and squads via the M8 curve generator). `generateEnemies` gained an optional seed (the default keeps
  M8/M9 calls byte-identical).
- **Tests.** +30 engine tests (arena, ranked, weather, ghosts), including the reference-parity fact
  that **42 straight wins reach 1,310** (Overlord's threshold), not 1,510. 349 unit tests / 40 files;
  `pnpm check` green (50 e2e).
- **Docs.** `docs/design/pvp.md`'s content-table section updated to the shipped shape; the M10
  assumptions added to `docs/ASSUMPTIONS.md`.
- **Next:** M10.2 — Arena on the server (state, actions, view, ghosts) + `/arena` and
  `/arena/rankings`.

## M10.2 — Arena on the server (2026-10-18)

- **State + save.** `AccountState` grows `pvp: { arena; ranked }` with `initialPvp(day, week)`;
  `SAVE_VERSION` → **6** and `withDefaults` fills the slice for older saves (a new migration test
  pins the fill).
- **Server actions `packages/server/src/pvp/`.** `shared.ts` projects `pvp.json` into the engine's
  `ArenaTuning`/`RankedTuning`, resolves the three ghost squads (curve + `band + slot` difficulty)
  and holds the chapter-gate helpers; `arena.ts` implements `challengeArena` (a real 6v6 via the
  existing `modeBattle`, with the new `arenaFight` battle label), `buyArenaAttempts`,
  `refreshArena`, `claimArenaChest` and `claimArenaAchievement` as pure `AccountState` transitions.
- **View `pvp-view.ts`.** `buildArenaView` (credits, place + best place, band, attempts, the three
  opponents with level/power/names, chests, achievements, the defence readout, day/week countdowns)
  and `buildArenaRankingsView` (the player's place against deterministic ghost places, plus the band
  table and the honest "worship comes later" note).
- **`GameServer`.** `getArena`, `refreshArena`, `challengeArena(opponentIndex, seed?)`,
  `buyArenaAttempts(n)`, `claimArenaChest(index)`, `claimArenaAchievement(index)`,
  `setArenaDefence(slots, strategy)` (delegates to the squad save) and `getArenaRankings()`, all
  implemented on `LocalServer`.
- **Client.** `/arena` (stats, attempts + buy, Refresh, DEF Lineup, three opponents on a list with
  Challenge, participation chests, best-rank achievements, the M4 replay with an Arena result card)
  and `/arena/rankings` (band table + the place board). The Squad editor now honours `?mode=` so
  "Edit defence" deep-links to the Arena defence lineup; a Home town tile routes into the Arena (the
  `/pvp` hub itself is M10.5).
- **Tests.** +12 server tests (view shape, the chapter gate, a real battle's credit/place move, the
  daily cap, buying at rising prices, refresh, chest + achievement claims, the ranking board, the
  save fill, and a LocalServer pass over the boundary) and +1 engine test for `initialPvp`; 362 unit
  tests / 41 files. New `tests/e2e/m10.spec.ts` (fresh account sees the locked Arena + the ranking
  board; a grown save imported through the More debug tools fights a ghost, claims a chest, buys an
  attempt). 54 e2e total.
- **Scope note.** The Arena's own chest/achievement claims and attempt purchases ship with M10.2
  (the screen needs them), so M10.5 becomes the PvP hub + Ranked claims + live squad strategies.
- **Next:** M10.3 — Ranked on the server (tier ladder, promotion match, best-of-3, weather) +
  `/ranked`.

