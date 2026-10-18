# PvE modes and Link Crystal (M8)

Read before editing `packages/engine/src/pve`, the PvE logic in `packages/server`, the
`packages/content/pve/*.json` / `packages/content/tuning/pve.json` tables, or the client's
Combat hub / Tower / Trials / World Boss / Dungeons / Crystal screens.

Covers PROMPT §7.1 (Link Crystal), §7.6 (Tower, Trials, World Boss, Daily Dungeons), §8
(screens) and §13 (M8: "each mode is playable with rewards and weekly resets").

Reference read (shapes only; every number and name here is our own):

- `reference/game-rebuild/kb/spt-tower.md` (two difficulty tracks, milestone chests)
- `faction-tower.md` (faction-locked tower, weekly rotation, 20 climbs/day, sweep)
- `world-boss.md` (twice-daily windows, damage milestones, damage ranking)
- `gods-trials.md` (seasonal trials, area/level structure, per-level drops)
- `world-championship.md` (leagues, weather, ladder) — the weather idea is M10; not built here
- `resonance.md` (the shared-level crystal, cap = 340 + 8 per 12★ Wild)
- `clock-and-calendar.md` (UTC daily reset, weekday rotation)

## Goal

Every PvE mode from §7.6 is playable end to end: an entry card, its special rules enforced in
a real battle, rewards, and a reset cadence. The endgame **Link Crystal** shares growth across
the roster past the last stage cap. All time comes from the injected clock; all randomness from
the injected seeded PRNG.

## The shape all modes share

A **mode definition** in `packages/content/pve/*.json` describes an enemy squad *generator*
(faction/tier pool, count, a level curve) and a reward bundle. The server generates the
defender squad deterministically from the definition + the current floor/index, runs the battle
through the existing engine (`packages/server/src/battle.ts`), records progress, and applies
rewards. This reuses the M4 replay screen and the M5 reward plumbing unchanged.

Enemies are `StageEnemy` (`{ speciesId, level, stars, stage }`) — the same shape the campaign
uses — so `buildEnemyTeam` needs no change.

## Engine module `packages/engine/src/pve`

Pure, content-free rules; the tables are arguments.

| File | Owns |
|---|---|
| `reset.ts` | `weekdayUtc(ms)` (0=Sun..6=Sat), `weekKey(ms)` = ISO `"YYYY-Www"` (Monday start), `isSameUtcWeek` |
| `curve.ts` | enemy level/stars from a base + slope; deterministic pool pick |
| `tower.ts` | floor reward curve, milestone list, next-floor, sweep floor |
| `trials.ts` | the `TrialRule` union, eligibility (faction lock, weekday), rule application |
| `worldBoss.ts` | weekday rotation lookup, damage milestones, ranking vs ghost records |
| `dungeons.ts` | weekday dungeon lookup |
| `linkCrystal.ts` | crystal cap (`base + perStar × count`), effective level cap, upgrade cost |

### Tower

An endless-floor tower. Floors are attempted in order; a win advances the floor by one. The
highest floor cleared is **permanent**, but the *climb counter* is **weekly** (`climbsPerWeek`
new floors per ISO week, reset at the UTC week boundary) and **sweeps** are **daily**
(`sweepsPerDay`). Clearing a floor pays a floor reward and, every `milestoneEvery` floors, a
milestone reward (granted once and marked claimed). A **Sweep** pays the highest cleared floor's
rewards again.

Level curve: `level = round(firstFloorLevel × slope^(floor-1))`, stars and evolution stage rise
every few floors, clamped to authored maxima. Both the reward curve and the curve live in
`tuning/pve.json`.

### Trials (five)

Each trial is its own entry card with a tagline and a reward preview, and one special rule:

| id | Rule | Enforcement |
|---|---|---|
| `stormwall` | **faction-locked tower**: only Wilds of one faction may be fielded | server filters the squad (engine `isTrialEligible`) |
| `silentpeak` | **no-ultimate trial**: ultimates never fire | engine `BattleRules.noUltimate` |
| `lockedvale` | **stat-capped trial**: fielded Wilds are level-clamped to `maxLevel` | server clamps levels before resolution |
| `lastlight` | **survival trial**: survive `survivalRounds` big rounds | engine `BattleRules.survivalRounds` |
| `moonfall` | **weekday-rotating boss**: available only on listed weekdays | engine `trialAvailable` |

Each trial has its own enemy pool, level curve and reward bundle. Trials do not stagger: they are
always open (subject to the rule), matching the "no stamina/attempts" note in the reference.

### World Boss

A weekday-rotating boss (one per `weekdayUtc`). The player has `attempts` fights per day. Each
fight scores **damage dealt** (summed across the fielded squad). Reaching a damage milestone
grants a claimable reward. The screen shows a **damage-ranking leaderboard** against stored
**ghost records** (the player's own best runs plus deterministic bots), so the mode is locally
playable exactly like Arena ghosts will be in M10. Attempts and claimed milestones reset daily.

### Daily Dungeons

One dungeon per weekday (a material run). Clear it once per day for its reward bundle; a new day
unlocks the next weekday's dungeon. Rewards are per-dungeon currency bundles (candy, stones,
shards, gold, and mode coins).

### Link Crystal (endgame growth)

Once a Wild is in its **final evolution stage *and* already at that stage's level cap**, further
levels are **shared**: the Link Crystal holds one level, and every finished Wild's level cap
becomes the crystal's level. The crystal unlocks (at its starting level) the first time any Wild
qualifies, and is raised by spending candy + gold + stones. The unlock is applied lazily when the
account loads (`normalize`), so no manual claim is needed.

```
crystalCap = baseCap + perStarWild × (number of Wilds at ≥ starThreshold stars)
```

`levelUp` (and the Wild screen's cost/preview) computes a Wild's cap as
`effectiveLevelCap(wild, formCap, crystal)` — the form cap, raised to the crystal's level once the
Wild is finished.

PROMPT says "340 + 8 per Wild at 12 stars"; our `maxStars` is 10, so `starThreshold` is a named
setting and the shipped value is the roster's star cap. Recorded in `docs/ASSUMPTIONS.md`.

## Combat change

`BattleConfig` gains an optional `rules`:

```ts
interface BattleRules { noUltimate?: boolean; survivalRounds?: number }
```

`noUltimate` makes the turn choose a basic/normal skill even when Rage is full. `survivalRounds`
caps the loop at that many big rounds and flips the time-out: the attackers win if any survives.

## Server (`packages/server`)

`AccountState` grows (SAVE_VERSION → 5, migrated): `tower`, `trials`, `worldBoss`, `dungeons`,
`linkCrystal`. The pure actions live in `packages/server/src/pve/` (`shared`, `tower`, `trials`,
`dungeons`, `worldBoss`, `linkCrystal`); the display views live in `pve-view.ts`; mode battles go
through `modeBattle` in `battle.ts` (faction-lock, level-cap, `BattleRules`). New `GameServer`
methods (all typed `Result`):

| Method | Effect |
|---|---|
| `getTower()` | display-ready tower view (floor, milestones, sweeps, reset countdown) |
| `challengeTower(seed?)` | fight the next floor; advance + reward on a win |
| `sweepTower()` | re-pay the top floor's rewards (limited per day) |
| `getTrials()` | the trial cards + eligibility |
| `challengeTrial(id, seed?)` | fight a trial with its rule applied |
| `getWorldBoss()` | rotation, attempts left, damage, milestones, ranking |
| `challengeWorldBoss(seed?)` | one scored fight; record damage + ranking |
| `claimWorldBossMilestone(index)` | claim a reached milestone |
| `getDungeons()` | the weekday's dungeons + status |
| `challengeDungeon(id, seed?)` | fight a dungeon; first clear pays |
| `getLinkCrystal()` | crystal level, cap, qualifying Wilds |
| `upgradeLinkCrystal()` | spend materials to raise the crystal one level |

All rewards, randomness and resets live here (PROMPT §10).

## Client (`packages/client`)

The Combat tab becomes the **Challenges hub** (`/combat`): pins for Tower, Trials, World Boss,
Daily Dungeons, Link Crystal, plus the M4 training battle (`/combat/training`). New routes
`/tower`, `/trials`, `/boss`, `/dungeons`, `/crystal`. Every screen has loading/empty/error states;
out-of-scope features (the remaining modes, M11–M17) stay in their own "coming later" states.

## Done criterion (M8)

From a save with a grown squad: clear tower floors and see the floor/milestone rewards and the
weekly reset; open each of the five trials with its rule enforced and win its reward; fight the
day's World Boss, see damage recorded and climb its ranking, and claim a milestone; clear the
weekday dungeon; and raise the Link Crystal to lift the level cap of a top-stage Wild.

## Assumptions (see docs/ASSUMPTIONS.md for the running list)

- Our `maxStars` is 10, so the crystal's "12★" gate ships as `starThreshold = 10` (a setting).
- Tower/trials/dungeons use generated enemy squads from a difficulty curve instead of hundreds
  of authored floors; the reference's exact floor tables are not reproduced.
- World Boss ghost records are the player's own history plus deterministic bots (no server).
