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
- **Client**: M7 landed the i18n keys and `ServerProvider` wrappers, but the Wild-screen gear tabs
  were **not wired**; `WildDetail` still showed only Upgrade/Evolve. Corrected in M11.0.
- **Tests**: engine equipment suite. No server-action tests existed until M11.0. `pnpm check` green.

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

## M10.3 — Ranked on the server (2026-10-18)

- **Content.** `pvp.json`'s `ranked` gains the `opponent` ghost curve for the region's rivals
  (`baseLevel: 62`, `levelSlope: 1.05`, stars/stage every 2/4 rungs). The schema now requires it and
  `content:validate` cross-checks the ranked pool's factions alongside the Arena's.
- **Engine.** `rankedMatchSeed(season, phase, tier)` joins `arenaOpponentSeed` in `pvp/ghosts.ts` (a
  rung always meets the same rivals, so a reload cannot reroll them), and
  `rollRankedSeason(state, season, phaseCount?)` now advances the region cyclically when the season
  turns — our rule, since the reference publishes none — so all eight regions get played.
- **Combat plumbing.** `modeBattle` gains `weather` (the M10 `BattleRules.weather` value) and
  `sizeCap` (field at most N Wilds: the region's `teamSize`), plus a new `rankedMatch` battle label.
- **Server actions `packages/server/src/pvp/ranked.ts`.** `startRankedMatch` plays a real
  best-of-`bestOf` series (one ghost lineup per game, sized to the region, with the season's weather),
  ends as soon as either side has a majority, records one match (one attempt, one gift-track step)
  and reports the ladder move (`promoted` on a threshold win); `buyRankedAttempts` charges the day's
  prices atomically; `claimRankedTier` pays the region's coins and `claimRankedGift` the gift bundle.
  All pure `AccountState` transitions; a charm charge is spent per game actually played.
- **View + boundary.** `pvp-ranked-view.ts` `buildRankedView` (region + format, dan id, the points
  floor / next rank / promotion flag, current + next weather, attempts + price, the season countdown,
  the season record, the 12 tier rows with their coin values and the 7 gift steps, and the trimmed
  lineup); `GameServer` gains `getRanked`, `startRankedMatch(seed?)`, `buyRankedAttempts(n)`,
  `claimRankedTier(index)` and `claimRankedGift(index)`, all implemented on `LocalServer`.
- **Client.** `/ranked` (the region/format/tier/points readout, the points bar with "Next Rank", the
  promotion banner, the weather line, attempts + buy + Start matching + a lineup deep-link, the season
  record, the claimable tier list and the challenge-gift track) plus a Home town tile; the series
  result reuses the M4 replay with a per-game strip so any game can be rewatched.
- **Tests.** +10 server tests in `ranked.test.ts` (the gate, the view shape, region-sized rival
  lineups, a real series + ladder move, the promotion match, the daily cap, the atomic attempt
  purchase, tier/gift claims, the seasonal region advance, and a LocalServer pass over the boundary)
  and +2 engine tests; **374 unit tests / 42 files**. `tests/e2e/m10.spec.ts` gains the locked-ladder
  check and a full series (Start matching → replay → result card → claim tier 0); **58 e2e total**.
- **Scope note.** Ranked's own tier/gift claims and attempt purchases ship with M10.3 (the screen needs
  them), so M10.5 is now the PvP hub + live squad strategies.
- **Next:** M10.4 — Arena weekly settlement via Mail + daily/season resets in `normalize`.

### Carried forward

- **The rank-0 Ranked rivals are too strong for a merely grown squad (M10.6).** A fixture at
  Lv140 / 10★ / stage 2 (the same one the Arena e2e wins with) loses 0/10 series to the Kanto rung's
  `baseLevel: 62` rivals, while Lv200 wins 10/10 — the pool is the whole roster, so it draws
  mythic-tier species whose *kits* outrun the starter kits even at equal Power. The M10.6 balance pass
  should either raise the player's floor (level/stars) or narrow the rival pool per region (e.g.
  exclude the top tier) rather than only re-tuning `baseLevel`. The unit fixture pins Lv200 so the
  tests stay deterministic.
- **The Arena e2e's 'Victory' is seed-deterministic, not strength-deterministic.** It passes because
  `config.rng` is `mulberry32(0x5eed)` and nothing consumes it before `challengeArena`, so the ghost
  trio and the battle seeds are fixed. If a future change draws from `config.rng` earlier, that test
  will flip. M10.6 should make it outcome-agnostic (assert the credits *move*, not the winner) or
  pin an explicit `seed`.

## M10.4 — Arena weekly settlement and lazy PvP clocks (2026-10-18)

- **Server `packages/server/src/pvp/settlement.ts`.** `rollPvp(config, state, now)` rolls every PvP
  clock to `now`: the Arena's UTC day (`rollArenaDay`) and ISO week (`applyWeeklySettlement` — pay the
  band, drop the credits to its `resetCredits`, clear the week's chest progress) and Ranked's 03:00 day
  (`rollRankedDay`) and season (`rollRankedSeason` — advance the region, reset the tier track, the
  claims, the record and the attempts). It returns the input object unchanged when nothing turned, so
  callers can treat identity as "no write needed".
- **Settlement by Mail.** On a week turn the server writes one **Arena Rewards** letter holding the
  band's reward (`mail.arena.subject` / `mail.arena.body`, `economy.mailTtlHours` TTL) whose id embeds
  the week that ended — `mail_arena_<week>` — so a reload in the new week can never pay twice and a
  save that skipped several weeks is paid once for the last one. The player claims it from the M5 Mail
  screen like any other letter, and the rewards land in `currencies`.
- **Lazy, not cron.** `LocalServer.normalize` calls `rollPvp` on every `load()` (which every action
  already goes through), so the rollover happens on the first server call after the boundary — inside a
  live session as well as on a cold load — and the settled save is persisted by the existing
  `accept`/`persist` path. Best-ever readouts (`bestCredits`, `bestPlace`) and claimed achievements are
  deliberately *not* reset: they are the reference's permanent records.
- **Client.** Two new Mail strings (`mail.arena.subject` / `mail.arena.body`) — the letter needs no new
  screen.
- **Tests.** +6 server tests in `pvp-settlement.test.ts`: the week turn pays the band's exact reward
  and resets the credits/counters while keeping the best-ever readouts; a day-only turn clears the day
  counters with no mail; a second roll in the same week is a no-op on the same object and does not
  duplicate the letter; a season turn advances the region and flattens the ladder; an unchanged state is
  returned by identity; and a LocalServer pass loads a stale save, finds the persisted letter, claims it
  and is refused a second claim. **380 unit tests / 43 files.**
- **Next:** M10.5 — the PvP hub at `/pvp` and live squad strategies.

## M10.5 — Live squad strategies and the PvP hub (2026-10-18)

- **Engine `packages/engine/src/combat/strategy.ts` (new).** `StrategyId` stops being inert. A unit's
  action slot is still the ult-when-ready / basic-replace roll, and **`rollSkillSlot` is always
  consumed**, so the RNG stream is byte-identical across strategies and only the *choice* differs:
  `balanced` keeps the measured roll untouched; `aggressive` never takes the filler roll (candidate
  slate `ult/normal/basic`, pick the damaging one); `defensive` prefers a `support` skill
  (heal/shield/ally-side) when the kit has one and otherwise keeps the measured roll, **plus holds its
  ultimate while every living ally is above `strategyUltHoldHp`** (`combat.json`, 0.75). `BattleConfig`
  gains `strategies?: { attackers?; defenders? }`, defaulting to `balanced`.
- **Dormant lever, documented.** The kit-role preference never fires on the shipped roster — a probe of
  all 84 kits found `basic`/`normal` damage-only and `ult` damage on 80 with a neutral rider on 4, i.e.
  **zero support skills** — so today the `defensive` ult-hold is what makes it observably different.
  Noted in `docs/ASSUMPTIONS.md` item 11 and `docs/design/pvp.md`; it wakes up when a support kit ships.
- **Server.** `battle.ts` refactors its three call sites onto one `RunViewOptions` path and returns
  `BattleView.strategies` (the strategy each side actually fought with). The M4 echo battle gives both
  sides the mode's own strategy (the echo is your squad); `stageBattle` uses `campaign`; `modeBattle`
  uses `state.strategies[squadMode]` and takes an optional `defenderStrategy` for real-defender modes
  (Arena defence lineups are stored by `setArenaDefence` and exercised locally in M10.6 tests; the M19
  backend serves the snapshot).
- **PvP hub.** `packages/server/src/pvp-hub-view.ts` (new) builds `PvpHubView` — one card per entry
  point (Arena, Ranked, PvP Shop, plus Clash / Championship / SPT Temple as honest pending states) with
  a structured status payload (never prose: the client formats `credits/place/attempts`, the region
  name, the token balance, or the chapter gate). `GameServer.getPvpHub()` + the `/pvp` page + a **sixth
  bottom-nav tab**; the Home Arena/Ranked tiles become one PvP tile, and the e2e now goes
  Home → PvP → Arena/Ranked. `BattleReplay` shows each side's strategy next to its team label.
- **Tests.** +15 engine strategy tests (the ult-hold timing, `aggressive` never taking the filler roll,
  and `balanced` byte-identical to pre-M10.5) and +8 server hub tests (statuses for a fresh vs grown
  save, migration fill, strategy plumbing through the echo and a `defenderStrategy`). **403 unit tests /
  45 files**; 58 e2e green.
- **Next:** M10.6 — the PvP balance pass.

## M10.6 — PvP balance pass (2026-10-18)

- **The bug.** The M10.1 ghost curves were authored from the reference's *shape* and never measured
  against our own progression: `arena.opponent` was `baseLevel 60, levelSlope 1, starsEvery 6` over the
  **whole** catalogue, and `ranked.opponent` `baseLevel 62, levelSlope 1.05` likewise. With a
  per-tier average stat total of rare 1 605 / epic 2 090 / legendary 2 972 / supreme 3 963 / mythic
  5 192, a whole-catalogue draw is a 2.5–3.2× cliff and a lottery: a chapter-2 graduate (the six
  starting rare Wilds at ~Lv20/2★ — the campaign's own chapter-3 endgame is Lv12/2★ enemies) lost
  **0%** of entry-band fights at every level up to Lv48, while a Lv140 squad won 85% on the same band.
- **The fix.** Pools are now **tier-banded** and the curves anchored to the mode's unlock scale:
  Arena `tiers: ["rare", "epic"]`, `baseLevel 6`, `levelSlope 1.24`, `starsEvery 2`, `stageEvery 5`;
  Ranked `tiers: ["rare", "legendary", "epic"]` (one band up — it opens a chapter later), `baseLevel
  12`, `levelSlope 1.18`, `starsEvery 2`, `stageEvery 5`. Supreme/mythic rivals are reserved for the
  later cross-server modes (M17). The three Arena opponents stay the same curve at bands `n`/`n+1`/`n+2`
  — an easy/mid/hard draw.
- **Measured result** (fixed ghost/seed list; full table in `docs/design/pvp.md`): Arena entry **53%**
  for Lv20/2★ against 0% before, 0% for that squad at band 6, 86% at Lv40/5★, 100% for a maxed squad;
  Ranked entry **67%** for Lv30/3★, 100% at tier 5, King tier 22% for Lv140/10★ but 94% for a maxed
  Lv200/10★ squad.
- **Tests.** New `packages/server/src/pvp-balance.test.ts`: a structural check that neither mode ever
  fields a supreme/mythic rival (and that the Arena's field stays varied), plus the win-rate bands above
  as regression anchors — a re-flattened ladder or a re-admitted high tier fails loudly. **406 unit
  tests / 46 files**; 58 e2e green.
- **Docs.** `docs/ASSUMPTIONS.md` items 12/16 rewritten with the measured numbers and new items 21/22
  for the static-curve ceiling (a grown squad outgrows the top rung; the fix is the M19 backend's live
  matchmaking) and the bottom-nav plan. `docs/design/pvp.md` gains a "Balance (M10.6)" section.
- **Taste decisions taken (owner, same day).** The Arena trio stays an easy/mid/hard draw, the shipped
  tier bands stay, and the hub's pending card is named **Championship** (the reference's own name, not
  the earlier "World Championship"). On the nav the owner asked to match the source, so the bar is
  checked against the source photo: it ships **six** tabs and reaches PvP from the Explore map pin, so
  our sixth tab (PvP) is the interim occupant of that slot until M13 (item 22).
- **Next:** M11 — growth and collection layers II.

## M11.0 — Wild-screen gear retrofit (2026-10-20)

- **The missing M7 UI is now real.** `WildDetail` grew from two tabs to seven — Upgrade, Evolve,
  Potential, Orbs, Soul-hearts, Berries, Held Items — and the five gear tabs call the existing server
  actions. The M7 labels are renamed to the owner's vocabulary (Talents → Potential, Runes → Orbs,
  Spirit Cores → Soul-hearts, Charms → Berries, Relics → Held Items); the code/save ids are unchanged.
- **Stat sheet.** `EquipmentView` now carries the base and equipped combat sheets, the equipped
  percent/soul lines, current Power, and each layer's solo Power delta. The Wild screen renders HP /
  P.ATK / S.ATK / P.DEF / S.DEF / SPD, non-zero percent lines, and the five layer contributions; the
  header keeps the snapshot Power so the value updates immediately after an action.
- **Panels.** `pages/wild/` holds one panel per layer (each under 150 lines), a shared `useEquipment`
  hook that refetches after a successful action, and `StatSheet`. Locked layers show their star/tier
  requirement; Soul-heart star-up and Berry dismantling say "coming later" until M11.4/M11.5.
- **Bug fix.** `LocalServer.importSave`, the normal save load and backup recovery now pass the content
  config to `migrateSave`. A save that omits the equipment slice therefore gets the authored starting
  items instead of an empty inventory (this is why the e2e import path can exercise gear).
- **Tests.** +5 server tests in `equipment.test.ts` (view Power before/after equipping, held-item
  level cost, star gates for orbs and berries, Potential allocation); +2 e2e in `m11.spec.ts` proving
  the tabs/stat sheet exist and equipping a held item raises the displayed Power. **411 unit tests /
  47 files**; 60 e2e green.
- **Docs.** `docs/design/collection.md` captures the M11 scope, the nine soul-heart sets, the
  source-named resources, the sub-step order and the open assumptions. `docs/SCOPE.md` and the M7
  changelog entry are corrected to say the M7 client screens were not wired until now.
- **Next:** M11.1 — currencies, save v7, Trainer tab and the materials row.

## M11.1 — Materials, save v7 and the Trainer tab (2026-10-20)

- **Ten M11 materials are currencies.** `potentialShard`, `orbEssence`, `soulHeartExp`,
  `berryEssence`, `heldItemShard`, `plateBottle`, `plateFragment`, `starShard`, `resonationShard`
  and `titleTicket` join `CurrencyId`/`CURRENCY_IDS` (so they work in `Rewards`) and have content
  labels. They start at 0; `tuning/account.json` grants 1,000 of each through the debug button so
  every later layer can be exercised. The seven HUD currencies are unchanged.
- **Save v7.** `SAVE_VERSION` is 7. Migration now normalises the whole currency record through
  `currenciesFrom` instead of leaving unknown keys untouched, so a v6 save gets every new material
  at 0 (and no longer carries `undefined` holes). One new `save.test.ts` case pins the v6 → v7 fill.
- **Trainer replaces More in the bottom nav.** The sixth tab is `/trainer`, a player-facing card
  with the trainer name/level, roster/campaign-star counts, the ten-material grid, travel links, and
  honest VIP/Titles "coming later" cards. **More stays reachable at `/more`** from the Travel card so
  the import/debug e2e paths keep working; `More` is no longer a nav tab.
- **Tests.** +1 server save test and +2 e2e (Trainer materials + More link; the existing gear e2e
  remains). `boot.spec` now expects the Trainer tab and the Milestone 11 HUD label. **412 unit tests
  / 47 files**; 62 e2e green.
- **Next:** M11.2 — Potential (duplicate fodder, Potential Shards, nine tiers, reset).

## M11.2 — Potential ladder (2026-10-20)

- **New tuning file.** `content/tuning/collection.json` is the single home for M11 costs; the first
  block is `potential` (`shardBase` 20, `shardPerTier` 10, `respecShardFee` 5, `fodderPerTier` 1,
  `resetGems` 50). It is wired through `COLLECTION_TUNING`, `GameConfig.collection`, the content
  validator and the server view, so later layers add blocks without new plumbing.
- **Potential now costs materials.** Unlocking a tier consumes the authored number of duplicate
  copies of the same species plus `shardBase + tier × shardPerTier` Potential Shards. Re-picking an
  unlocked tier charges the flat respec fee. Reset costs gems, refunds the shard ladder and **does
  not** return fodder. Changing path refunds the ladder instead of silently deleting it.
- **Fodder rules.** The target, locked Wilds and any squad member are protected; duplicates of any
  level/stars are eligible and the lowest-level (then lowest-star, then id) copy is consumed first.
  Consuming a copy removes its stored loadout, so its gear returns to the inventory.
- **Screen.** The Potential tab shows the duplicate count, the shard balance, each tier's cost and
  fodder need, a "not enough materials" chip, and the reset refund. Chosen options stay visible for
  re-picks.
- **Tests.** +1 server test (locked duplicate is refused; reset refunds the ladder and keeps the
  fodder consumed) alongside the expanded allocation test; +2 e2e (Potential eats a duplicate and
  raises Power). **413 unit tests / 47 files**; 64 e2e green.
- **Next:** M11.3 — Orbs (levels, duplicate copies, Orb Essence, 2/4 set bonuses).

## M11.3 — Orbs, 2/4 sets and duplicate levels (2026-10-20)

- **Set schema changed.** `RuneSetDef` now carries `bonuses[]` at 2 and 4 pieces instead of one
  `pieces`/`lines` threshold. `foldLoadout` pays every reached bonus, so a four-piece set also keeps
  its two-piece lines; the old 3-piece placeholder behaviour is gone.
- **Catalogue re-authored.** Four sets × four orbs = **16 orbs** (four qualities, levels 1–6). The
  new fourth pieces are Verdant Heart, Azure Heart, Amber Heart and Crimson Heart; Verdant Heart is
  in the starting inventory so a fresh account can reach a 4-piece Verdant loop.
- **Level-up costs materials.** An orb level-up needs two same-kind, same-level, unsocketed copies
  plus the existing gold cost, or the fallback `essenceBase + (level−1) × essencePerLevel` Orb
  Essence. Copies are picked deterministically by instance id; socketed copies are protected.
  Costs live in `content/tuning/collection.json` (`orbs`) and `equipment.json` (gold).
- **Screen.** The Orbs tab shows the Orb Essence balance, copies needed, each orb's duplicate count,
  its gold/essence cost, separate "Level with copies" and "Use Orb Essence" buttons, and 2pc/4pc
  set-progress chips.
- **Tests.** +2 server orb tests (essence level raises an equipped orb's Power contribution; two
  duplicates are consumed), the engine fold test now proves both 2- and 4-piece bonuses. **415 unit
  tests / 47 files**; 66 e2e green.
- **Next:** M11.4 — Soul-hearts (the owner's nine sets, star-up, combat effects).



## M11.4 - Soul-hearts, nine sets and star-up (2026-10-20)

- **Nine-set catalogue.** cores.json now carries the owner's nine sets (Common, Flying, Fire,
  Superpower, Water, Bug, Thunder, Rock, Grass) with six socket-specific pieces and 2/4/6-piece
  bonuses. Common, Flying and Rock use soul/core lines; the rest use SoulheartHooks for effects
  that are not stat lines. Three 2-star Common pieces join the starting equipment.
- **Schema and folding.** CoreSetDef.bonuses[] gains optional 	ext and soulheart blocks.
  oldLoadout() returns a folded soulheart payload plus display text and keeps the highest
  reached tier for same-stat ladders; distinct effects at 2/4/6 all apply. The server forwards the
  payload through EquippedSheet and uildWildTeam.
- **Combat hooks.** New SoulheartHooks cover lifesteal, damage versus shields, puncture and
  control-immunity cadence, round/turn/on-hit heals, paralysis, starting and overheal shields,
  first-round guards, and battle-start stat multipliers. combat/soulheart.ts applies them at
  battle start and on the matching round/turn/damage events; puncture is a new buff kind.
  Cadences are named settings in combat.json.
- **Star-up.** starUpCore charges expBase + (stars - 1) x expPerStar Soul-heart EXP from
  collection.json (2->3 stars = 80), caps at pieceMaxStars, and persists the new star count.
  The Soul-hearts tab shows the EXP balance, set progress, per-piece cost/button and a max-star state.
- **Tests.** +11 engine Soul-heart tests (battle-start guards/multipliers/shield, puncture and
  immunity cadence, round/turn heals, overheal shields, shield damage, on-hit heal and paralysis,
  puncture versus a start shield, lifesteal and highest-ladder folding) and +1 server test (equip
  two pieces, see the 2-piece bonus, star one up). +1 e2e (equip a 2-piece set and star up with
  EXP). **426 unit tests / 48 files**; 68 e2e green.
- **Next:** M11.5 - Berries (two slots, stars, dismantle).

## M11.5 - Berries, two slots and dismantling (2026-10-20)

- **Two Berry slots.** Loadout.charm became Loadout.charms: (string|null)[], sized by
  equipment.json (charms.slots = 2). Save v8 migrates a v7 save's single charm into slot 1
  and fills the second slot with null. Equipping targets a slot and refuses to use more copies
  than the account owns; the same Berry can occupy both slots when two copies exist.
- **Star-up and dismantle cost materials.** collection.json gains a erries block:
  upgradeCopies (2), upgradeEssenceBase 20, upgradeEssencePerStar 20, and per-tier
  dismantleEssence (5/10/20/40). Star-up needs spare copies + Berry Essence; dismantle pays
  Essence for one spare copy and protects equipped copies. The content validator now pins four
  designs per tier and fixed Commons.
- **Screen.** The Berries tab shows the Berry Essence balance, two slot rows with unequip,
  per-slot equip buttons, spare-copy counts, the star-up cost and a dismantle button. The
  starting inventory keeps four Commons + four Basics and starts Emberfruit at 1 star so the
  star path is visible immediately.
- **Combat.** Both occupied slots fold their Berry lines; the fold never applies more copies than
  the account owns. Real battles spend one copy per occupied slot, preview battles spend none.
- **Tests.** +1 engine fold test (two slots, ownership cap), +1 server action test (two slots,
  star-up cost, protected equipped copy, dismantle refund) and +1 save migration test.
  **429 unit tests / 48 files**; 70 e2e green.
- **Next:** M11.6 - Held Items (levels 1-60, refine).

## M11.6 - Held Items to level 60, refine in Shards (2026-10-20)

- **Level cap.** equipment.json raises Held Items from level 5 to 60. The strip still shows
  Lv n/60, and the action returns t_level_cap at 60.
- **Materials.** Levelling now spends Held Item Shards (5 + 2 x (level - 1)); refine spends
  800 + 400 x refine gold and 10 + 10 x refine Held Item Shards. The old candy/stone fields
  are gone from the tuning type, schema and view. The effect remains active at refine 0 and gains
  20% per refine.
- **Screen.** The Held Items tab shows the shard balance and the exact next level/refine costs;
  worn items still ask for confirmation before moving to another Wild.
- **Tests.** Extended the engine cost test (level 60 / refine ladder), +2 server tests (level spends
  Shards, refine spends gold + Shards, level cap) and +1 e2e (equip, level, refine). **431 unit
  tests / 48 files**; 72 e2e green.
- **Next:** M11.7 - Plates (element-keyed stages 0-20).

## M11.7 - Plates (2026-10-20)

- **Content.** Six element-keyed plates (one per faction) with two authored lines each in
  content/equipment/plates.json; the schema and validator require exactly one plate per faction.
- **Rules.** A plate has stages 0–20. Stage 0 adds nothing; stages cost 10 + 5 x stage Plate
  Bottles, except 5 → 6 which costs 375 Plate Fragments. The plate folds into a new plates stat
  layer and applies to Power and real battles even when the Wild has no stored loadout. The stage-6
  skill swap stays "coming later".
- **Save.** SAVE_VERSION → **9** with per-Wild plates state; migration defaults it to {}.
- **Screen.** Held Items is now a sub-tab host: Held Items / Plates / Trinkets. The Held Items gate
  no longer hides Plates, and Trinkets shows an honest coming-later state. The plate card shows
  stage, next/final lines, Bottle + Fragment balances, the next cost and the deferred skill swap.
- **Tests.** +1 engine fold/battle test, +3 server tests (Bottle step + Power, 5 → 6 Fragments,
  stage cap) and +1 e2e (stage 0 → 6). **435 unit tests / 49 files**; 74 e2e green.
- **Next:** M11.8 - Trinkets (species signature, levels 0–40, Star Shards).

## M11.8 - Trinkets, one per species (2026-10-20)

- **Content.** `content/equipment/trinkets.json` has one keepsake for each of the 84 species. Each
  has flat HP/P.ATK/S.ATK plus one authored percent line: Strikers get Crit Intensity, Guardians get
  DMG Reduction, and Adepts get Skill Boost. The validator requires exactly one trinket per species
  and rejects unknown species ids.
- **Rules.** Levels run 0–40; level 0 adds nothing. A level costs `10 + 5 × level` Star Shards. The
  level is keyed by species id so levelling one keepsake benefits every copy of that species. The
  trinket folds into a new `trinkets` stat layer and applies to Power and real battles even when the
  Wild has no stored loadout. Shiny variants stay "coming later".
- **Save.** `SAVE_VERSION` → **10** with `trinkets: Record<speciesId, level>`; migration defaults it
  to `{}`.
- **Screen.** The Trinkets sub-tab replaces its coming-later placeholder with the keepsake card:
  level, next/final lines, Star Shard balance, exact next cost, the shared-copy rule and the deferred
  shiny variant. The stat sheet gains a Trinkets layer row.
- **Tests.** +1 engine fold/battle test, +2 server tests (Star Shard level + Power + shared copy,
  level cap), +1 save migration test and +1 e2e (level 0 → 1). **439 unit tests / 50 files**; 76 e2e
  green.
- **Next:** M11.9 - Resonance (six slots, Link Crystal share).

## M11.9 - Resonance, Link Crystal share (2026-10-20)

- **Content.** `collection.json` `resonance` holds six slots, two open, the 50 + 50 x slot unlock
  ladder and the per-crystal-level shares: 4 HP, 1 P.ATK, 1 S.ATK, 0.5 P.DEF, 0.5 S.DEF, 0.05 SPD.
- **Rules.** A slotted Wild gains the shares multiplied by the Link Crystal level. One Wild can hold
  one slot; assigning it elsewhere moves it. Feeding a slotted Wild to Potential clears its slot.
  The bonus folds into a new `resonance` stat layer, so it affects Power and real battles.
- **Save.** `SAVE_VERSION` → **11** with `resonance: { unlocked, slots }`; migration opens two slots
  with null entries and normalises the slot array length.
- **Screen.** The Trainer screen gains the account resonance board: six slot cards, Wild pickers for
  open slots, the current Link Crystal status, the Resonation Shard balance, the next unlock price,
  the chosen Wild's bonus lines, and an honest no-bonus state while the crystal is locked.
- **Tests.** +1 engine battle test, +2 server tests (unlock ladder + cap, crystal share + move +
  locked slot), +1 save migration test and +1 e2e (unlock slot 3, assign a Wild). **443 unit tests /
  51 files**; 78 e2e green.
- **Next:** M11.10 - VIP privileges (activity tiers, data-driven conveniences).

## M11.10 - VIP, activity tiers (2026-10-20)

- **Content.** `collection.json` `vip` holds seven tiers (Visitor to Crown, 0-250,000 lifetime XP) with
  idle-cap hours, shop discount and daily Common Ticket supply per tier.
- **Rules.** The tier is derived from lifetime `profile.xp`; nothing is bought. The discount is applied
  to shop item prices (rounded down, minimum 1), the idle cap gains the tier's hours, and the daily
  supply can be claimed once per UTC day. A fresh Visitor tier has no supply.
- **Save.** `SAVE_VERSION` → **12** with `vip.lastClaimDay`; migration defaults it to null.
- **Screen.** The Trainer VIP card replaces the placeholder with the badge, lifetime XP, next-tier
  progress, all three perks, the claim button/claimed state, and an honest VIP 1 gate message.
- **Tests.** +3 VIP tests (tier/perks/shop/idle, daily claim and next-day reset, fresh-account gate),
  +1 save migration test and +1 e2e (XP 5,000 → VIP 2 → claim). **447 unit tests / 52 files**; 80 e2e
  green.
- **Next:** M11.11 - Titles (three slots, timed expiry, Continuation).

## M11.11 - Titles, three slots and lazy expiry (2026-10-21)

- **Content.** `titles/titles.json` has 102 original titles: 85 permanent, 15 seven-day and 2
  fourteen-day. They span 30 Common trainer ranks, 55 Premium rows (trainer, collection, Arena and
  Ranked banners) and 17 Rare rows (trainer crowns, guild/event rows, Arena sovereigns, King of Arena
  and Alliance Champion). Event titles carry the source-shaped 15-stage ladder.
- **Rules.** One title per Common/Premium/Rare slot. Activation, upgrades and max-stage Continuation
  cost Title Tickets. Timed titles store an expiry and are pruned lazily on load/open; Continuation
  extends from `max(now, expiresAt)`. Flat HP/P.ATK/S.ATK and percent Total HP/P.ATK/S.ATK lines fold
  into a new `titles` layer and apply to every Wild. Guild and event rows remain visible but locked.
- **Save.** `SAVE_VERSION` → **13** with `titles.owned` and `titles.equipped`; migration drops expired
  entries and clears their slots.
- **Screen.** The Trainer Titles card replaces its placeholder with the three slot pickers, ticket
  balance/owned count, Common/Premium/Rare catalogue tabs, stage and expiry lines, activate/upgrade/
  continue/equip controls, requirement text, and honest guild/event coming-later rows.
- **Tests.** +1 engine title battle test, +5 title server tests (counts, activation/auto-equip,
  requirement/locked rows, continuation from expiry, percent-total stats), +1 save migration test and
  +1 e2e (activate a title, auto-equip, check requirements and locked rows). **454 unit tests / 53
  files**; 82 e2e green.
- **Next:** M11.12 - Docs, balance pass, full e2e and `pnpm check`.

## M11.12 - M11 closed: docs, balance pass and full gate (2026-10-21)

- **Balance.** Reviewed the M11 Potential, Orb, Soul-heart, Berry, Held Item, Plate, Trinket,
  Resonance, VIP and Title costs against their authored curves; no numbers changed. The snapshot is
  recorded in `docs/design/collection.md`. Title Tickets now show an honest "sources arrive with
  later milestones" note on a zero balance instead of leaving a disabled catalogue unexplained.
- **Docs.** `docs/SCOPE.md` marks M11 built and `docs/design/collection.md` records M11.12 plus the
  final cost snapshot. ASSUMPTIONS carries the titles/VIP decisions and save v13.
- **Gate.** Full `pnpm check`: lint, typecheck, **454 unit tests / 53 files**, content validation,
  client build and **82 e2e** all green.
- **Next:** M12 - Ancient Artifacts and Suppression (artifact collection, Relic Tablets, Suppression,
  Ruins Adventure).

## M13.0a - Campaign 182×10 and the 60 gym gates (2026-10-23)

- **Scope.** M12 is skipped by owner decision. M13 starts with the campaign foundation: 182 chapters ×
  10 stages, the 60 source-shaped gym gates at 3-1 … 180-1, and `campaign.gyms` in save v14. Full
  Victory Road tasks/badges/commission remain M14; Gods Trials is parked.
- **Data.** `packages/content/tuning/campaign.json` holds 182 chapter rows and 60 gyms with own names,
  regions, factions, six-enemy teams and rewards. `packages/content/stages/campaign.json` holds the
  1,790 generated stages for chapters 4-182; chapters 1-3 keep their M5 authored 1-6 and gain 7-10.
  `scripts/generate-campaign.mjs` is the one-time dev generator (the runtime never generates).
- **Rules.** A gated stage needs its predecessor cleared **and** its gym defeated. A gym opens after
  the stage immediately before its gate. First clear pays once; replays are practice. Chapter mail now
  pays a flat 200 gems instead of `100 + 50 × chapter`.
- **Screen.** Campaign has a 182-chapter picker (select + prev/next), chapter name/region, a gate card
  with gym challenge/replay, and a per-stage gate hint. The gym reuses the battle replay and result
  panels.
- **Save/tests.** Save v14 migration adds `campaign.gyms = {}` and preserves stars. +4 content tests,
  +3 engine gate tests, +3 server gym-flow tests, +1 save migration test, +1 e2e gate test.
- **Docs.** `docs/design/campaign-expansion.md`, SCOPE's locked M13 plan, and ASSUMPTIONS 35-42.
- **Next:** 13.0b - Explore foundation and the eight mode shells.

## M13.0b - Explore hub and eight mode shells (2026-10-27)

- **Scope.** Added the Explore hub and the eight M13 mode shells: Hoopa's Vault, Rift Arena, Sky
  Pillar, Faction Tower, Misty Woods, Pet Home, Island Challenge and Ultra Wormhole. The shells show
  scale, gates, reset cadence and an honest "arrives in" state; mode play, attempts and reward
  claims stay in 13.1-13.9.
- **Data.** `packages/content/tuning/explore.json` holds the eight cards, their A/B gates, reset
  cadence, scale and feature bullets. `exploreSchema` requires exactly eight modes, and
  `content:validate` checks every campaign gate against a real stage.
- **Rules.** `packages/engine/src/explore/` evaluates campaign-stage, level and server-day gates,
  plus daily/weekly/permanent reset countdowns. A mode opens only when every gate is met.
- **Server day.** Save **v15** stores `serverEpoch`; day 1 is the creation day. Older saves derive
  it from the welcome mail's creation time, falling back to migration time. The debug fast-forward
  moves the clock, so server-day gates can be tested without editing the epoch.
- **Screen.** `/explore` is a seven-tab nav destination with eight cards. `/explore/:id` shows the
  full gate checklist and feature bullets. Planned modes have no play button; locked cards link to
  the same honest detail page.
- **Tests.** +3 content tests, +3 engine gate/reset tests, +3 server view tests, +2 save migration
  assertions, +1 e2e Explore test; boot spec updated to the seven-tab nav.
- **Docs.** `docs/design/explore.md`, SCOPE's M13 plan and ASSUMPTIONS 42-43.
- **Next:** 13.1 - Pet Home.

## M13.1 - Pet Home merge board (2026-10-28)

- **Scope.** Replaced the shell with a live 5×5 merge board: 21 playable tiles and four inert
  corners, 17 Home levels, merge cap 8→16, summons, open/merge/release, padlock purchases,
  one-time level rewards, lazy Home-Coin income and two shops. The earlier habitat/decoration plan
  was removed; this is the source's merge game, not resident placement.
- **Data.** `packages/content/tuning/pet-home.json` holds 17 levels, 21 tiles, 16 income rows and
  132 shop rows (84 Home Exchange + 48 Orb Atelier) in the source's band/page shape. Counts and
  shapes follow the source; names, XP thresholds, income values, tile layout and every row are
  original. `petHomeSchema` and `content:validate` check the board, level/tile counts, bands, offer
  ids and shop totals.
- **Rules.** Opening and merging each grant +10 Home XP. Income is the authored 5-second rate and
  doubles by merge level, so a merge preserves the board's income. It is settled in whole
  5-minute ticks, capped at 8 hours offline with partial ticks preserved. The
  first 50 summons each UTC day are free; paid summons use the authored 10/30/80/250/600 brackets.
  Padlocks charge the current Home level's price. Deluxe (Orb Atelier) opens at Home Lv 10. Shop
  pages are deterministic from day + refresh count; refreshes cost 40 gems for 1–10 and 80 for
  11–30, with 30 per day.
- **Server/save.** `pet-home.ts` owns gate checks, currency spending, summon counters, daily reset
  and settlement; `pet-home-view.ts` is a pure display view. Save **v16** adds `petHome`; v15 and
  older saves migrate to a fresh slice. Every write rejects a locked 1-10 gate.
- **Screen.** `/explore/pet-home` shows the board, Home level/XP/merge cap/income, free-tile count,
  summon, unlock/open/release/merge actions, level rewards, both shops with refresh and purchase
  states, and the 84-entry album. The Explore card is live; the locked screen still shows the gate
  checklist and a Campaign link.
- **Tests.** +4 content tests, +6 engine tests, +8 server tests, +1 save migration test and +1 e2e
  board flow. **494 unit tests / 61 files**; **88 e2e** green.
- **Docs.** `docs/design/pet-home.md`, `docs/design/explore.md`, SCOPE's M13 plan and ASSUMPTIONS
  44-45.
- **Next:** 13.2 - Sky Pillar (1,800 stages, daily resets).

## M13.2 - Sky Pillar (2026-10-31)

- **Scope.** Replaced the Sky Pillar shell with the live 180-floor x 10-stage climb across six
  30-floor wings. Every stage is graded up to 3 stars: the clear plus two of "knockouts at most",
  "every survivor above N% HP" and "rounds at most". Each floor carries 10/20/30-star chests.
  Proofs of Sky recharge every 8 hours (cap 6), a first clear costs one proof, a passed stage can be
  re-challenged free, and a sweep costs one proof for the highest 3-star record's half reward.
- **Data.** `packages/content/tuning/sky-pillar.json` holds the 1,800 stages, six wing names, floor
  level gates, faction pools, star conditions and chests, generated once by
  `scripts/generate-sky-pillar.mjs`. Counts and shapes follow the source; every name, number,
  condition and reward is original. `skyPillarSchema` and `content:validate` check floor order,
  wing size, stage count, ascending gates, 10/20/30 chests and real factions.
- **Rules.** `packages/engine/src/sky-pillar/` owns lazy proof recharge (the cap stops the clock, not
  the purse), proof spending, stage/floor unlocks, best-star records, 3-star sweep selection and
  chest eligibility. `BattleRules.roundLimit` adds the source's 15-turn counter as a time-out loss
  (Sky Pillar only). The `skyPillar` squad mode and strategy default were added.
- **Server/save.** `sky-pillar.ts` binds gates, enemies, battles, star grading, rewards and chests;
  `sky-pillar-view.ts` is a pure view with all 180 floor summaries and one selected floor's cards.
  Save **v17** adds `skyPillar`; v16 and older saves migrate with a fresh slice, and missing
  `skyPillar` squad slots are filled. Every write rejects an unopened 7-1 gate.
- **Screen.** `/explore/sky-pillar` shows the proof purse and countdown, next stage, six wing grids,
  a floor detail with stage conditions, sweep, challenge/re-challenge, floor chests and a locked
  gate checklist. The Explore card is live.
- **Tests.** +4 content tests, +5 engine tests (4 Sky Pillar + 1 round-limit), +9 server/view tests,
  +2 save migration assertions, +1 LocalServer boundary test and +1 e2e flow. **510 unit tests / 64
  files**; **90 e2e** green.
- **Docs.** `docs/design/sky-pillar.md`, SCOPE's M13 plan, ASSUMPTIONS 46 and the design index.
- **Next:** 13.3 - Hoopa's Vault (300 floors, Resetter Shard retrofit).

## Docs - project wiki (2026-10-31)

- **New `wiki/`.** An LLM-maintained knowledge base (index, log, open questions, owner rules,
  dated decisions, one page per system, milestone status, the owner's unscheduled ideas), built from
  the Oct 12-31 OpenCode session and the repo docs. It links to `docs/` instead of copying it.
- **AGENTS.md** now says to read `wiki/index.md` at session start and describes how to keep the wiki
  current (decisions, milestone close-out, ingest, query, lint, log).
- No code, content or tests changed.

## R0 - Source-retrofit foundation (2026-10-31)

- **Owner rule:** copy the source exactly (ASSUMPTIONS override #11); retrofit plan in
  `wiki/milestones/source-retrofit.md`.
- **Source loader.** `scripts/source/source.mjs` (+ `.d.mts` types) loads any table from the source
  game's config dumps; `scripts/source/index-tables.mjs` writes `docs/SOURCE-TABLES.md` (377 tables in
  32 dumps) so agents without `reference/` can see what exists.
- **Save reset.** Save **v18**, `MIN_SAVE_VERSION` 18, new `outdated_save` error. LocalServer retires
  an old save (`wildbound.account.retired`) and starts fresh with a "fresh start" mail
  (ASSUMPTIONS #47).
- **Tests.** The version-by-version migration tests (v1, v6–v16, pre-M10 PvP) tested behaviour the
  owner chose to drop, so they were replaced — not deleted to get green — by: every version below
  `MIN_SAVE_VERSION` is refused; a current save with missing slices is still filled; the reset keeps
  the retired save and refuses an old import; two loader tests; a check that the e2e fixtures'
  `E2E_SAVE_VERSION` equals `SAVE_VERSION`. **506 unit tests / 66 files**, **90 e2e**.
- **CI.** `.github/workflows/check.yml` runs `pnpm check` on every push and posts a summary
  annotation agents can read. Two mobile M11 e2e tests (Trinkets, VIP) failed once on CI and passed
  on other runs — flaky, not yet fixed.
- **Next:** R1 - Pokémon growth from the source tables.

## R1 - Pokémon growth from the source (2026-10-31)

- **Import.** `scripts/import-species.mjs` + `scripts/data/source-hero-map.json` copy faction, class,
  quality, shards and the full star ladder of all 84 species (1,386 star cards) from the source's
  config; owner's names and kits kept (ASSUMPTIONS #49). Species/kits now live in five faction files.
- **Factions.** The source's five (water, fire, grass, light, dark) across content, engine, client and
  tests; one plate per faction (the extra Light plate dropped); weather phase de-duplicated.
- **Stats.** The multiplicative stat model is replaced by the source's basic + level × growth
  (ASSUMPTIONS #50); `growth.json` keeps only the level-up price (stand-in, #51) and respawn.
- **Stars and Evolve.** `WildInstance.evolutionStage` is gone; `stars` is the source star. Evolve =
  +1 star consuming auto-picked fodder (`planFodder`, `server/growth.ts evolutionView`); the old
  shard star-up was removed from `GameServer`. Level caps come from the star card (Link Crystal
  still extends a top-star Wild). New copies start at their species' first star.
- **Combat.** Star cards' "DMG BST to [faction]" reaches the damage formula (#52).
- **Interim enemies.** Legacy enemy stars count from each species' first star (#53); Ranked rival
  slope 1.18 → 1.24 after re-measuring the balance suite.
- **Client.** Forms come from star-card names (portraits, roster, gallery); the Evolve tab lists
  each fodder line with have/need; Origin tier chip; ATK/DEF/SKILL and the five faction labels.
- **Save v19** (reset). **Tests:** stat formula, star cards/forms, fodder planning and a full
  server Evolve; balance tests grow squads to the equivalent star profile; the strategy tests use a
  simulated Manaphy wall. **498 unit tests / 66 files**, content PASS, **90 e2e**.
- **Retired:** `scripts/import-roster.mjs` refuses to run; the campaign/Sky Pillar generators are
  marked "do not re-run before R9".
- **Next:** R2 - Gear.

## R5 - Held items from the source (2026-10-31)

- 75 source held items (`scripts/import-held-items.mjs` → `content/equipment/held-items.json`)
  replace the 27 invented relics: class-locked, Supreme/Mythic/Origin wearers, a rolled main stat
  (HP / P.ATK / S.ATK + Total % from Legendary) that grows with level, and 1–6 rolled lines from the
  quality's 31-line pool. Faction lines count only on that faction; Absorb HP Rate is lifesteal.
- Levels 0–200 on the source shard table (7,350 to max), Lv 31+ gated on the Link Crystal level.
- Refine = the source's re-roll (pending roll, Keep / Drop; Supreme 2 / Mythic 3 refinable slots),
  priced on the owner's ladder in Held Item Resetters (first free, 21 per item). New currencies
  Resetter Shards and Held Item Resetters, 20 → 1. Lock and dismantle (refunds level shards).
- Item skills carry the source text; Choice Specs, Razor Fang and Razor Claw run in battle.
- Fixed: Origin Pokémon could not wear held items (the tier order lacked `origin`).
- Save v20 (older saves are retired with a fresh-start mail). Starting items: three Rares until
  Hoopa's Vault. Album deferred (tables not in the dumps).

## E1 + E2 - Battle triggers and held-item skills (2026-10-31)

- Owner paused the retrofit to finish the battle engine (`wiki/milestones/battle-engine.md`).
- Engine (additive; golden replays unchanged): triggers `onCrit`, `onBlocked`, `onDealDamage`,
  `onControlled`, `onInflictControl`, `afterNormal/afterBasic/afterUlt`, `maxFires`; conditions
  `round`, `targetHasAnyTag`, `selfControlled`; per-unit `damageMods` (dmg / atk / ignoreBlock);
  stats `atkPct`, `ignoreBlock`, `basicRate`; buff kind `rageBlock`; heal bases `casterSAtk`,
  `casterCurrentHp`; `target.event`. Gear passes triggers and damage mods through `SpecInput`.
- All 27 held-item skills (57 item rows) run in battle from `scripts/data/held-item-effects.json`;
  stand-ins are shown on the item (ASSUMPTIONS #57).

## E3 - Kit clauses (2026-10-31)

- Port fixes (`scripts/port-skills.mjs`): Rage talents as shares of the 1,000-point bar ("1/8" =
  125 — was read as 1 point in 19 kits), per-action Rage triggers, "Crit strength" / "Break"
  spellings, "+X% ATK" buffs as `atkPct` (were flat adds of a fraction of a point).
- 68 kits hand-ported from the sheet by `scripts/data/build-kit-overrides.py`; the port report lists
  the 46 clauses still not modelled.
- Engine: round cadence; conditions on class, shields, HP vs target, ally / enemy counts; controls
  disarm, flinch / nap (no basic skill), shallow sleep, crit seal, mind control, zen control; endure,
  invulnerable and `onEndure`; defend and scaled damage modifiers; P/S damage reduction; DoT
  vulnerability; stacking DoTs; targeted immunities; extra actions; splash; shield break; layers spent
  on hit; buffs ending with their source; `onAllyCrit`; buffable lifesteal; SPD buffs now move the
  turn order.

## Owner kit changes (2026-10-31)

- Mew / Shiny Mew: Talent 4 Rage on every fallen enemy (`onEnemyDeath` trigger).
- Snorlax ultimate +2% damage per 1% HP lost, uncapped; Mimikyu's extra attacks gain Rage; Dialga's
  ultimate fills the whole team's Rage, its own included (ASSUMPTIONS #59–60).

## E4 - Species shards and Origin skill levels (2026-10-31)

- Each species' own shards (`speciesShards`), compose a copy from `item_num` shards (Evolve tab).
- Origins (Calyrex, Zacian, Necrozma, Shadow Mewtwo, Origin Lugia, Origin Rayquaza) level their ult,
  basic skill, passive and Talent 4 to LV.3 for 50 / 100 own shards (new Skills tab); the 24 LV.2 /
  LV.3 rows of the sheet are hand-ported as kit `levels` and applied in battle (`applySkillLevels`).
- Engine: `onEnemyUlt` trigger, per-tagged-unit heals and Rage, capped HP-share damage, trigger and
  modifier groups. Save v21. No in-game shard source until R9 (owner's choice).

## E5 - Combat numbers checked (2026-10-31)

- `tpSymmetric` true (the team-Power cut applies to weaker defenders too — measured); Block INT is the
  blocker's stat (size still open); the Counter reflect passes shields; Wobbuffet's Counter uses the
  measured 75% (sheet 50%). Ranked rival `baseLevel` 12 → 16 re-measured. Golden baselines
  re-exported (squad-camp, tidewarden). Open questions: `wiki/systems/combat-numbers.md`.

## Owner change: no team-Power cut (2026-10-31)

- "i dont want there to be a cut for weaker teams against stronger teams": `teamPowerCut` false (the
  measured both-sides rule stays as a switch). Ranked rival `baseLevel` back to 12. Golden baselines
  re-exported.

## Owner change: action Rage for SKILL class only (2026-10-31)

- Owner: "pokemon only get +250 rage if they are a skill class". New combat setting
  `ragePerActionClasses` (`["adept"]`); `takeTurn` and `extraAction` gate the +250 on it.
- Deviation from the measured source (all classes gain it). ASSUMPTIONS #63.
- Golden replays squad-camp and tidewarden re-exported deliberately; campaign and PvP balance tests pass
  unchanged.
- Recorded a friend's Dialga fallback (ult fills Dialga + 2 allies) — not built; owner keeps the current
  Dialga unless E6 shows it is too strong.

## Owner correction: action Rage +125, SKILL class +250 (2026-11-01)

- Owner: "the normal number is +125, +250 is only for pokemon with the skill class". `ragePerAction` 125
  and new `ragePerActionByClass` (`{ adept: 250 }`) replace yesterday's SKILL-only gate
  (`ragePerActionClasses` removed). ASSUMPTIONS #63. Golden replays re-exported.

## R4 — Potential copied from the source (2026-11-01)

- `scripts/import-potential.mjs` → `packages/content/potential/potential.json`: 62 trees (15 distinct),
  67 options with six level values, tier stars 7–15, the shard table (465,000 to unlock all, 8,370,000
  to max), fodder per species and tier, Potential Core eligibility; reset 16 Diamonds.
- Engine `potential/` (rules + compiler to stat mods / triggers / damage mods); combat gains
  `SpecInput.statMods`, `onHit` skill slot (`eventSlot`), `alliesAliveAtLeast/Below`, `removeBuff`.
- Server `potential.ts` (unlock / level / reset / view); battles compile each Pokémon's Potential with
  its lineup. New currency `potentialCore`.
- Removed the M7/M11 stand-in: talent paths, `talents.json`, `collection.potential`, `tuning.talents`,
  the Potential layer in the equipment view. Client Potential tab rewritten.
- Save v22 (reset). ASSUMPTIONS #64.

## R3 — Orbs from the source (2026-11-01)

- `scripts/gen-orbs.mjs` → `packages/content/equipment/orbs.json`: 12 kinds, 5 colours (caps +3…+10), flat
  stats to +10, % line pools and ceilings, 26 sets, socket families, unlock gates, level Gold, dismantle.
- Engine `equipment/orbs.ts`: rolling, flats, socket rules, set matching, fold (class tiers as damage mods).
  `PercentLines` gains `bossBoost` / `bossRdct`.
- Server `orbs.ts`: view, socket, level (+ Quick Upgrade), lock, dismantle, grant. Client Orbs tab rewritten.
- Removed the M7/M11 runes (`runes.json`, rune sets, starting runes, Orb Essence levelling). Save v23 (reset).
  Stand-ins: ASSUMPTIONS #65.

## R6c — Soul-heart rules from the source (2026-11-01)

- `CoreInstance.quality` (blue / purple / orange / red), star caps 2 / 3 / 4 / 5, per-quality star EXP table
  (hero_heart_soul_up_star_json values from kb), stars start at 0. Removed the M11 `collection.soulhearts`
  formula and `pieceMin/MaxStars`. The owner's nine sets unchanged. Save v24. ASSUMPTIONS #66.

## R6a part 1 — Plates from the source (2026-11-01)

- `scripts/import-plates.mjs` → `packages/content/equipment/plates.json`: 54 plates by card type, stages 0–18
  (one table), step prices, unlock and level gates. Server `plates.ts` rewritten (gates, `locked` reason);
  M11's faction plates and `collection.plates` removed. Plate skills follow in part 2. ASSUMPTIONS #67.

## R6a part 2 — Plate skills (2026-11-01)

- All 76 Pokémon's plate skills at tiers 6 / 12 / 18 ported in `scripts/data/plate-skills.py` (batches 1–13),
  applied by `applyPlateSkills` from the Pokémon's plate stage. Engine additions over the part: `statMods`,
  `HitFlags.slot` (onHit / onCrit / onDealDamage carry the hit's slot for `eventSlot`), `alliesAlive*`
  conditions, `removeBuff`, `zenControlPlus`.
- Readings and gaps are written with `note(...)` next to the ports; `port-skills.mjs` lists them in
  docs/PORT-REPORT.md "Plate skills" (earlier batches' notes were being dropped on each regeneration).
- Not ported: the stage-6 skill swaps (hero_slate_skill_json, 6 Pokémon) — the swap skill ids are absent from
  the dump (`_skills_not_found`).

## R6b part 1 — Trinkets from the source (2026-11-01)

- `scripts/import-trinkets.mjs` → `packages/content/equipment/trinkets.json`: 76 holders, stats per level 0–40
  (one row per level), Star Shard + own-item prices, unlock rules, skill ids. `TrinketDef.levels` replaces the
  M11.8 linear lines; `collection.trinkets` tuning removed.
- Server `trinkets.ts`: holder lookup, unlock (6 Pokémon at Lv 220, the holder at 7★), own-item price,
  `grantTrinketItem` (debug); the card says when a Pokémon has no trinket. Save v25 (`trinketItems`, reset).
- `scripts/data/trinket-skills-source.json`: the 371 skill texts (Chinese + English) for part 2. ASSUMPTIONS #68.

## R6b part 2 — Trinket skills (2026-11-01)

- `KitDef.trinket` + `applyTrinketSkills`: the skill at Lv 10 / 20 / 30 / 40, each tier replacing the one below,
  applied in battle from the species' trinket level. Ported for all 72 holders that list skills
  (`scripts/data/trinket-skills.py`, readings via `tnote(...)` in docs/PORT-REPORT.md "Trinket skills").
- Engine: damage mods add `crit` / `critPower` to the hit; trigger `onBlock` (the owner blocked a hit);
  conditions `targetRageAbove`, `enemiesDeadAtLeast`. Content: the `removeBuff` effect.
- Fix: Tyranitar's plate 12 riders now hit only controlled enemies (an empty `filters` narrowing used to fall back
  to all enemies).

## DEF switched on (owner, 2026-11-01)

- `defendersUseDef` true, `defK` 300,000 ("Light": ~20 % less damage for a maxed DEF tank, ~5 % for an attacker).
  ASSUMPTIONS #69.
- New `ignoreDefense` stat (adds to a skill's own ignore); DEF effects that were skipped as "no effect" are ported:
  Garchomp's ult DEF cut (and plate 6 at 55 %), Suicune's S.DEF steal (and plate 12), Gardevoir's 10 % ignore,
  Necrozma LV.2+ 30 % ignore, Zacian's Shattered Armor and Victini's Magma Armor DEF layers, Shiny Darkrai's
  Nightmare ignore per stack (18 % from plate 6), Psyduck plate 6 as an S.DEF cut, and the trinkets of God Ash-
  Pikachu (both), Arceus (both), Yveltal, Shaymin and Venusaur (both).
- Fix: P.ATK / S.ATK / P.DEF / S.DEF stat buffs are shares of the unit's own stat (they added the raw number).

## R6b part 3 — Trinket chests and the Faction Tower Shop (owner, 2026-11-01)

- Six trinket-chest currencies and Faction Tower Coins (save v26). Each holder's chest (hero_weapon_box) is spent
  one-for-one when its own item runs short; the trinket card says how many a level will use.
- New Faction Tower Shop (source shop 25: the six chests ×100 for 2,000–10,000 coins) and four chests in the Guild
  Shop (×20, 5 a week). Coins come from the Faction Tower once it is built (R9). ASSUMPTIONS #68.

## R6d — Berries from the source (2026-11-01)

- `scripts/import-berries.mjs` → `packages/content/equipment/berries.json`: 19 berries, the star ladder, breakthrough,
  15 line kinds with caps by stage, cultivation / reforge / rebirth prices. Engine `equipment/berries.ts` (instances,
  cultivation, breakthrough, reforge, stats); server `berries.ts` (panel view, carry, cultivate, breakthrough,
  reforge, elevate, lock, dismantle, grant); a new Berries panel. The M11 stand-in berries (`charms`), their
  star-up formula and their per-battle consumption are removed. Save v27.
- Berry skills by star ported (`scripts/data/berry-skills.py` → `equipment/berry-skills.json`, `applyBerrySkills`).
- New currencies: Blue / Purple / Orange / Red Mulch and Reforge Potions. ASSUMPTIONS #70.

- R6d follow-up (owner answers): Berry Rebirth — 100 Diamonds, everything spent on the berry comes back (each berry
  records what was spent on it; an optional field, so v27 saves stay valid). ASSUMPTIONS #70 updated.

## R7 — Resonance from the source (2026-11-01)

- `scripts/import-resonance.mjs` → `packages/content/tuning/resonance.json`. Engine `resonance` (top six, crystal
  level, evolution, cap, slot prices, cooldowns, shared levels); server `resonance.ts` (view, sync, buy slot,
  set / take out, clear cooldown, evolve, upgrade). A shared Pokémon keeps `ownLevel`. Save v28.
- Removed: the M8 Link Crystal (its PvE page and tuning) and the M11.9 resonance stat layer. Held-item level gates
  read the crystal level. ASSUMPTIONS #71.
