# Campaign, idle and the daily loop (M5)

Read before editing anything under `packages/engine/src/{time,campaign,economy,daily}`, the campaign
and daily logic in `packages/server`, the `packages/content/{stages,quests,tuning}` data, or the
client's Campaign / Quests / Mail / Idle / Home screens.

Covers PROMPT §7.4 (economy), §7.6 (campaign, idle, PvE), §7.9 (quests, mail, time, tutorial),
§8 (screens) and §13 (M5 done criterion).

## Goal

A brand-new player can start the game and play the full first-session loop: follow a short tutorial,
win the first campaign stage, watch the stage ladder unlock toward **chapter 3**, earn rewards and
trainer XP, then return to a working **daily loop** — idle income accrues in real time and can be
claimed, daily quests track progress and pay activity chests, system mail holds rewards, and the UTC
clock resets the day. All time and randomness are server-side (PROMPT §10).

## Scope (this milestone = one complete vertical slice)

Built now:

- **Campaign**: 3 chapters × 6 stages authored in `content/stages/*.json`; each stage has an enemy
  squad, first-clear rewards, a repeatable reward, an idle rate, and star thresholds. Stages unlock
  in order; a stage is 3-starred by beating it in few rounds. Challenge (real battle) and Sweep
  (instant replay of a cleared stage) both work.
- **Battle reuse**: the M4 replay screen is reused. A campaign battle is decided server-side and its
  log returned; the client replays it exactly (PROMPT §6.1). The M4 echo-battle stays for the
  `/combat` demo.
- **Idle/AFK income**: accrues per minute from the best cleared stage, capped at 12 h (PROMPT §7.4).
  A **Claim** button grants it; a **quick-collect** spends gems for 2 h with a daily limit.
- **Daily quests** with an Activity bar and chests, **Mail** with attachments / expiry / claim-all,
  and a **UTC clock** with a 00:00 daily reset (PROMPT §7.9).
- **Tutorial**: a short skippable first-session guide (level a Wild → set a squad → win the first
  stage). Steps auto-advance when the action is done.
- **Trainer XP / level**: awarded by stages and quests; shown on the HUD (closes the M3 HUD gap).
- **Debug fast-forward**: a debug control moves the game clock forward so the daily loop is testable.

Deliberately **deferred** (see `docs/SCOPE.md`): Trials, Tower, World Boss and Daily Dungeons (M8);
the full Explore-map hub and shop restock screens (M6/M10/M13/M15); real defender lists from saved PvP
ghosts (M10); energy/stamina (not in the reference model we ported); the tutorial's summon step
(summoning itself is M6 — the step is present but marked coming-later).

## Time (`packages/engine/src/time/`)

All game time is UTC (PROMPT §7.9). Pure functions; the clock is injected everywhere else.

- `UTC_DAY_MS = 86_400_000`.
- `dayKey(ms)` → `"YYYY-MM-DD"` (the daily-reset key, used to detect a new day).
- `nextUtcMidnight(ms)` / `msUntilNextUtcMidnight(ms)`.
- `nextRestock(ms, hoursUtc)` → the next restock boundary (used by shops in M6; declared here).
- `isSameDay(a, b)`.

Daily reset: the server compares `dayKey(now)` against the stored `quests.day`; if different it
resets quest progress/claims and the quick-collect counter. This is applied on every load and on
every claim, so a save left overnight resets correctly.

## Campaign (`packages/engine/src/campaign/`)

Pure, content-free logic over the state slice; the stage data itself lives in content.

- Types: `StageEnemy { speciesId, level, stars, stage }`, `StageReward`, `StageDef`
  (`{ id, chapter, index, name, enemies, firstClear, repeat, idlePerMinute, starRounds: [t3, t2] }`),
  `ChapterDef { id, name, stages }`.
- `CampaignProgress = { stars: Record<stageId, 1|2|3> }` (a stage absent from `stars` is uncleared).
- `starsForRounds(rounds, [t3, t2])` → 3 if `rounds ≤ t3`, else 2 if `≤ t2`, else 1.
- `isCleared(progress, id)`, `isUnlocked(progress, orderedStages, id)` — the first stage is always
  open; a stage opens when the previous stage in the flat order is cleared.
- `nextStageId(progress, orderedStages)` — first uncleared stage (the campaign's "go here" target).
- `bestIdleStage(progress, orderedStages)` — the cleared stage with the highest `idlePerMinute`.
- `campaignStars(progress)` — total stars (for display / future star-gated rewards).

Stage rewards are the same on every clear (repeatable) plus a first-clear bonus. A win also awards
trainer XP. A **Sweep** is only allowed on a cleared stage and grants the repeat reward only.

## Economy (`packages/engine/src/economy/`)

- `Rewards = { gold?, gems?, candy?, shard?, stone?, xp? }`; `addRewards`, `scaleRewards`,
  `applyRewards(currencies, rewards)` (floors at 0). Xp is split out into `profile.xp`.
- **Idle**: `accruedMinutes(lastClaimAt, now, capMinutes)` = `clamp(floor((now − last) / 60000), 0,
  cap)`; `idleReward(ratePerMinute, minutes)` scales the stage's `idlePerMinute`. Cap is 12 h (720
  min). Quick-collect grants `min(remaining, quickHours × 60)` minutes for a gem cost, limited per
  day.
- **Trainer XP**: `levelForXp(xp, curve)` and `xpForLevel(level, curve)` from a base+exponent curve in
  `tuning/economy.json`; the level is derived from cumulative XP (never stored out of sync).

## Daily (`packages/engine/src/daily/`)

- **Quests**: `QuestDef { id, metric, target, activity, rewards }` in `content/quests/daily.json`.
  `metric` counts one of this milestone's real actions: `winBattle`, `sweepStage`, `levelUp`,
  `starUp`, `claimIdle`, `claimQuest`. `QuestState = { day, progress: Record<id, number>, claimed:
  string[], chests: number[] }`. A quest is claimable when `progress ≥ target` and not yet claimed.
  Claiming grants its reward plus its `activity` points; activity chests unlock at `tuning/economy.json`
  thresholds and grant once per day.
- **Mail**: `MailItem { id, subjectKey, bodyKey, grants, createdAt, expiresAt, claimed }`. Mail is
  created by the server on real events (a welcome letter on a fresh account, a chapter-clear letter).
  `expireMail(mail, now)` drops expired unclaimed entries. Claim-all claims every unclaimed letter.
- **Reset**: `needsReset(state, now)` + `resetDaily(state, now)` build the new day's quest slice.

## Content (`packages/content`)

- `content/stages/*.json` — one file per chapter, each an array of `StageDef`. Enemy `speciesId`s
  reference content species; the validator cross-checks them. Levels scale by chapter (our difficulty
  curve; author our own numbers).
- `content/quests/daily.json` — the daily quest list (one array).
- `content/tuning/economy.json` — idle caps/costs, activity chest tiers, trainer XP curve, star
  thresholds default, mail TTL, and the first-session welcome grant.
- Schemas (`stageSchema`, `questSchema`, `economySchema`) added to `schemas.ts`; `STAGES`, `QUESTS`,
  `ECONOMY` exported from `content/src`; the CLI validator validates them and cross-references stage
  enemies, quest metrics and reward currencies.

## Server (`packages/server`)

`AccountState` grows (SAVE_VERSION → 2, migrated from 1): `campaign`, `idle`, `quests`, `mail`,
`tutorial`, and `debugClockOffset`. Every existing save upgrades by filling defaults, so M3/M4 saves
keep working.

New `GameServer` methods (all typed `Result`):

| Method | Effect |
|---|---|
| `challengeStage(stageId, seed?)` | Build the stage battle, run it, apply progress/rewards/xp, return `{ battle, outcome, snapshot }` |
| `sweepStage(stageId)` | Instant repeat reward for a cleared stage (ignored if not cleared) |
| `claimIdle(quick?)` | Grant accrued idle (or 2 h for gems); updates `lastClaimAt` |
| `claimQuest(id)` / `claimActivity(chestIndex)` | Grant quest / chest rewards + activity |
| `claimMail(id)` / `claimAllMail()` | Grant attachments, mark claimed |
| `setTutorialStep(step)` / `skipTutorial()` | Advance/finish the guide |
| `debugAdvanceClock(minutes)` | Debug fast-forward (`debugClockOffset += minutes`) |

The effective clock is `config.now() + state.debugClockOffset`; all timed logic uses it. Campaign
battle setup reuses the M4 `slotToPosition` / `kitToEngine` / `sheetOf` helpers; enemies come from
`StageDef` and are resolved through the same growth tables. All rewards, randomness and reset logic
live here (PROMPT §10) — never in React.

## Client (`packages/client`)

- **Home** becomes a small town: hotspot cards (Campaign, Idle Camp, Quests, Mail) plus the gallery
  link, an AFK pill, and the **tutorial card** when the guide is unfinished.
- **Campaign** (`/campaign`): chapter sections, stage rows with stars, enemy preview, idle rate and
  rewards, Challenge / Sweep, and locked stages greyed with the unlock hint. Challenge navigates to
  the battle screen.
- **Battle** (`/battle/:stageId`): calls `challengeStage`, replays the returned log through the shared
  `BattleReplay` component, then shows the stage result (stars, rewards, Continue → next stage).
- **Quests** (`/quests`): daily list with progress bars and Go / Claim, and the Activity chest bar.
- **Mail** (`/mail`): subject/body, attachments, expiry countdown, claim and claim-all.
- **Idle** (`/idle`): accrued payout, Claim, quick-collect with gem cost and daily limit.
- **HUD**: trainer XP bar + level; the clock stays the real UTC clock.
- **More → Debug**: a "fast-forward 1 h" control.

The M4 `/combat` screen is unchanged except that its playback UI is extracted into `BattleReplay` so
both screens share one replay implementation.

## Done criterion (M5)

From a fresh account: follow/skip the tutorial, win campaign stages and watch the ladder unlock
toward chapter 3, claim idle income after time passes, finish and claim a daily quest, open and claim
mail, and see the daily state reset after the UTC day rolls over.

## Reference files read

`PROMPT.md` §7.4, §7.6, §7.9, §8 (screens), §10 (time/server boundary), §13 (M5). `docs/design/
account.md` (account/save/squads), `battle-ui.md` (replay + battle setup). `reference/game-rebuild/kb/`
idle/campaign/time notes (shapes only).
