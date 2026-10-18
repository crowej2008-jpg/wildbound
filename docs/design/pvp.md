# PvP — Arena and Ranked (M10)

Read before editing `packages/engine/src/pvp`, the PvP logic in `packages/server`, the
`packages/content/tuning/pvp.json` table, or the client's PvP hub / Arena / Ranked screens.

Covers PROMPT §7.7 (PvP), §8 (screens) and §13 (M10: "Arena, ghosts/bots, weekly settlement via
Mail, ranked ladder with weather"). M8's World Boss already built the *ghost-ladder* shape this
milestone reuses; M9 made the roster's kits faithful, so a PvP fight is a real 6v6 battle.

Reference read (shapes and rules only — every number, name and region here is our own):

- `reference/game-rebuild/kb/pvp-arena.md` (5 free challenges/day + bought, 3 matched opponents,
  win/deduct PvP Credits, credits decide ranking, weekly Monday settlement by rank then a credit
  reset, daily participation chests for the first 10 battles, best-rank achievements)
- `reference/game-rebuild/kb/ranked-ladder.md` (8 regions × 12 tiers, win +35 / loss +20 with the
  points stop at the next threshold, the promotion match, 6 free attempts/day, +30% faction weather,
  season Mon 03:00 → Sun 22:00 UTC with a 03:00–05:00 update pause, best-of-3 team matches, Ladder
  Coins + a challenge-gift track)
- `reference/game-rebuild/atlas/08-pvp.md` (PvP hub cards, Arena layout, Ranked layout, best-of-3
  result screen)
- `reference/game-rebuild/kb/clock-and-calendar.md` (UTC daily reset, weekday rotation)

## Goal

From a grown save the player can **fight other trainers**: pick one of three matched opponents in
the **Arena**, win or lose **PvP Credits**, climb a **weekly ranking**, and be **paid by Mail at the
Monday reset** — and play the **Ranked** ladder (8 regions × 12 tiers) through **promotion matches**
with a rotating **weather** faction bonus. Opponents are deterministic **ghosts** (no server), the
same local pattern the World Boss already uses. Everything tunable is data; all time comes from the
injected clock and all randomness from the injected seeded PRNG.

## Vocabulary

| Term | Meaning here |
|---|---|
| **Arena** | the daily-credits mode: 3 matched opponents, credits per win/loss, weekly settlement |
| **PvP Credits** | the Arena score; decides the Arena rank and is reset to the band floor at settlement |
| **Arena band** | one row of the rank table (a place range + its settlement reward + reset value) |
| **Ghost** | a deterministic, power-scaled opponent squad generated locally (no real player) |
| **Ranked phase** | one region (8 total), each with 12 tiers and a team-size format |
| **Tier / dan** | a Ranked rung: `dan = phase × 1000 + group × 100 + tier` |
| **Weather** | a season-wide `+30%` damage bonus for one faction, passed into `BattleRules.weather` |
| **Promotion match** | the fight at the tier threshold: win to promote, lose to drop points |

## Engine module `packages/engine/src/pvp`

Pure, content-free rules; the tables are arguments (mirrors `pve/`).

| File | Owns |
|---|---|
| `types.ts` | `ArenaBand`, `ArenaChestTier`, `ArenaTuning`, `RankedTier`, `RankedPhase`, `RankedTuning`, `WeatherPick`, `ArenaState`, `RankedState` |
| `arena.ts` | credits after a win/loss, band from credits + rank within band, `ArenaState` roll/reset, opponent index picks, attempt count + buy prices, chest tiers reached |
| `ranked.ts` | tier thresholds, score after a win/loss **with the threshold stop**, promotion/demotion, `dan` encode/decode, season window (`seasonOpenAt`/`seasonClosedAt`), attempts + buy prices, tier + phase-gift claimable sets |
| `weather.ts` | pick the current/next weather faction from the rotation (deterministic on the season key) |
| `ghosts.ts` | deterministic ghost **squads** for the three Arena opponents (delegates to `pve/curve.ts` `generateEnemies`) and the Ranked opponent |

### Arena

`arena.ts` holds the whole ruleset as plain functions over `ArenaState` + `ArenaTuning`:

- **Credits.** `creditsAfter(credits, win, tuning)` = `clamp(credits + (win ? perWin : -perLoss), 0, cap)`.
- **Rank.** `arenaBand(credits, bands)` = the band whose `[min, max)` contains the credits;
  `arenaRank(credits, bands)` = `band.startPlace + (band.top - credits)` (a higher credit floor
  gives a lower place number), which is the "My Ranking" readout.
- **Daily.** `rollArenaDay(state, day)` clears `attempts`/`bought`/`battleCount`/today's chest claims
  when the UTC day key changes. `canChallengeArena(state, tuning)` = `attempts < free + bought`.
- **Opponents.** `arenaOpponentSeeds(state)` = three deterministic seeds from `(day, credits)`, so
  the trio is stable until you win/lose or refresh — matching "matched with 3 opponents of similar
  strength for your current rank".
- **Chests.** `claimableChests(state, reached)` for the first `chestCount` battles of the day
  (Gold every battle; shards on a subset), claimed one index at a time.
- **Settlement.** `settlementFor(credits, bands)` → the reward bundle for the band plus
  `resetCredits` (the band's floor). The server turns that into a Mail letter; this file only decides
  *what* and *to what* the credits reset.

### Ranked

- **Tiers.** Each phase has 12 tiers with ascending thresholds (Vanguard 1–3, Elite 1–3,
  Commander 1–3, Legend, Overlord, King — our own names live in the table). `rankedTier(dan)` /
  `nextTier(dan, phase)`.
- **Scoring.** `scoreAfter(score, dan, phase, win, tuning)`:
  - below the next tier's threshold a win adds `winScore` and a loss adds `lossScore` (losses climb
    too), **clamped to the next threshold** (the "points stop");
  - at the threshold, `win` promotes (`dan` advances one tier) and still adds `winScore`; `loss`
    subtracts `lossScore` (the deduction the promotion banner warns about).
- **Season.** `seasonKey(ms)` (ISO week, reuse `pve/reset.ts`), `seasonOpenAt(ms)` /
  `seasonClosedAt(ms)` = Mon 03:00 / Sun 22:00 UTC, `inDailyPause(ms)` = 03:00–05:00.
  `rollRankedDay(state, dayKey)` restores the day's attempts (not at 00:00 UTC).
- **Attempts.** `freeAttempts` per day, `attemptPrice(buyCount, ladder)`.
- **Claims.** `claimableTiers(state, phase)` (reached, current phase, not yet claimed) and
  `claimablePhaseGifts(state, phase)` (challenge-count tracks at 5/10/15/20/25/30/40 matches).

### Weather

`weather.ts` returns `{ current, next }` factions from the phase's rotation, chosen deterministically
from the season key so both the screen and the battle agree. `weatherRule(pick, dmg)` returns the
`BattleRules.weather` value (`{ factions: [current], dmg }`); `dmg` ships as the model's `+30%`
(`combat.json` `weatherDefault`). Our six factions are `ember · tide · grove · volt · frost · shade`.

### Ghosts

`ghosts.ts` turns an `EnemyPoolSpec` + a difficulty index into a `StageEnemy[]` via the existing
`pve/curve.ts` `generateEnemies`, so an Arena opponent or a Ranked rival is a real squad the battle
engine can fight. Seeds are pure functions of `(mode, day, credits/power, index)` — same save + day
→ same opponents.

## Content table

`packages/content/tuning/pvp.json` (schema `packages/content/src/pvp-schema.ts`, loader
`packages/content/src/pvp.ts`, wired into `GameConfig.pvp`):

```jsonc
{
  "arena": {
    "freeAttemptsPerDay": 5,
    "attemptPrices": [10, 20, 20, 20, 30, 30, 40],   // by the day's purchase number; last repeats
    "opponentCount": 3,
    "creditsPerWin": 30, "creditsPerLoss": 15,
    "bands": [ { "min": 0, "top": 1000, "startPlace": 5000, "reward": {...}, "resetCredits": 0 }, ... ],
    "bestRankTiers": [ { "place": 10, "reward": {...} }, ... ],   // one-time, by best place
    "chestTiers": [ { "battles": 1, "reward": {...} }, ... ],
    "opponent": { "factions": [], "tiers": [], "count": 6, "baseLevel": 60, "levelSlope": 1, ... }
  },
  "ranked": {
    "freeAttemptsPerDay": 6,
    "attemptPrices": [10, 10, 20, ...],
    "winScore": 35, "lossScore": 20,
    "bestOf": 3,
    "unlockChapter": 5,
    "weatherDmg": 0.3,
    "phases": [ { "id": "phase-1", "name": "…", "teamSize": 4, "teams": 2,
                  "weather": ["grove", "tide", "ember"],
                  "tiers": [ { "name": "Vanguard I", "score": 0, "coins": 145 }, ... 12 rows ],
                  "gifts": [ { "matches": 5, "reward": {...} }, ... ] }, ... 8 phases ]
  }
}
```

## Combat change

- **Weather** already exists (`BattleRules.weather = { factions, dmg }`, `damage.ts` applies it).
  Ranked passes the current weather; Arena passes none. No combat work.
- **Squad strategies become live.** `StrategyId` (`aggressive | balanced | defensive`) is currently
  inert. This milestone gives it meaning, **opt-in so existing behaviour is unchanged**:
  `BattleConfig` gains `strategies?: { attackers?: StrategyId; defenders?: StrategyId }`, defaulting
  to today's behaviour (`balanced`). `aggressive` prefers damage/ultimate skills and targets the
  lowest-HP enemy; `defensive` prefers heal/shield/control skills and covers the lowest-HP ally.
  The server passes each side's `squads.strategies[mode]`. A test asserts the three strategies
  produce observably different logs on one fixture. Recorded in `docs/ASSUMPTIONS.md`.

## Server (`packages/server`)

`AccountState` grows `pvp: { arena: ArenaState; ranked: RankedState }`; `SAVE_VERSION` → 6
(migrated, defaulting from `day`/`weekKey`). Actions live in `packages/server/src/pvp/`
(`shared`, `arena`, `ranked`, `settlement`); views in `pvp-view.ts`; matches go through the existing
`modeBattle` in `battle.ts` (now passing weather + strategy). New `GameServer` methods (all `Result`):

| Method | Effect |
|---|---|
| `getPvpHub()` | the hub cards with their live status lines |
| `getArena()` | credits, rank, attempts left, today's chests, the 3 opponents, the defence squad |
| `refreshArena()` | re-roll the day's three opponent seeds (bounded) |
| `challengeArena(opponentIndex, seed?)` | fight that ghost; credits ±, chest progress, best-rank check |
| `buyArenaAttempts(n)` | spend gems for attempts at the day's prices |
| `claimArenaChest(index)` / `claimArenaAchievement(index)` | claim a reached chest / best-rank tier |
| `setArenaDefence(squad, strategy)` | save the DEF lineup (a stored copy, like the reference) |
| `getArenaRankings()` | the ranking board vs ghost places |
| `getRanked()` | region, tier, credit bar, weather now/next, attempts, gift track, win stats |
| `startRankedMatch(seed?)` | best-of-`bestOf` 6v6 vs a ghost; score ±, promotion, streak |
| `buyRankedAttempts(n)` | spend gems for attempts |
| `claimRankedTier(dan)` / `claimRankedGift(matches)` | claim tier / challenge-gift rewards |

**Settlement** runs lazily in `normalize` (no cron): when the UTC week key changes, the server builds
an **Arena Rewards** Mail letter per the player's band and resets credits to `resetCredits`; Ranked
tier claims and the gift track reset per season, and the weather rotation advances. This is the M10
"weekly settlement via Mail" requirement.

## Client (`packages/client`)

The bottom-nav **PvP** tab opens `/pvp` — the card hub (Arena, Ranked live; Cross-Server Clash,
Championship, SPT Temple as honest "coming later" states listed in `docs/SCOPE.md`). New routes:

- `/arena` — the three opponents on pedestals with power/rank chips, credits + "My Ranking", attempts
  `N/5 (+)`, the chest row, Refresh, DEF Lineup, and a **Challenge** button that opens the M4 replay.
- `/arena/rankings` — the board (player + ghost places).
- `/ranked` — region + team format, Current/Next Weather, the tier emblem, the credit bar with "Next
  Rank", the promotion-match banner, the challenge-gift track, season countdown, Start matching,
  attempts, and the four stat readouts; the best-of-3 result reuses the replay's result card.

Every screen has loading / empty / error states; nothing ships as a dead button.

## Sub-steps (one commit each, `pnpm check` green before each)

1. **M10.1** — `tuning/pvp.json` + schema + `engine/src/pvp/*` (arena, ranked, weather, ghosts) + unit tests.
2. **M10.2** — Arena on the server (state, actions, view, ghosts) + `/arena` + `/arena/rankings` + e2e.
3. **M10.3** — Ranked on the server (tier ladder, promotion, best-of-3, weather) + `/ranked` + e2e.
4. **M10.4** — Arena weekly settlement via Mail + daily/season resets in `normalize` + tests.
5. **M10.5** — PvP hub, attempt purchases, achievements/chests claims, and **live squad strategies**.
6. **M10.6** — balance pass, statistical tests, e2e polish, docs.

## Done criterion (M10)

From a grown save: open the PvP hub; in the Arena beat (or lose to) a matched ghost, watch PvP
Credits move and the rank update, claim a participation chest, buy an attempt, and — after a simulated
week rollover — receive an **Arena Rewards** mail and see credits reset; in Ranked pick up the
season's weather, win and lose points with the threshold stop, clear a **promotion match**, claim a
tier reward and a challenge gift, and see the current/next weather and countdown. Squads' `aggressive`
/ `defensive` strategies visibly change a fight.

## Assumptions (running list in docs/ASSUMPTIONS.md)

- Opponents are **deterministic ghosts**, not real players (same note as the World Boss): the game is
  local-first, so "matchmaking" is a pure function of `(day, credits/power, index)`.
- The reference's absolute credit numbers, band cut-offs, credit win/loss amounts and reset values are
  **not published**; our table ships own tunable values and the *shape* (win up, loss down, reset at
  settlement) is what we reproduce.
- "3 teams for 6v6" is approximated as **one lineup of the phase's size** plus a **best-of-3** series;
  the engine fights one squad per game. Recorded against the reference's team-format line.
- Ranked weather rotates on our **six factions** (not Grass/Water/Fire); the `+30%` is a setting.
- Settlement is applied **lazily on load** (no scheduler), so a save left a week settles the next time
  it loads.
- Arena **worship** (top-10 only) and **lucky ranks** need a population, so they are out of scope
  (honest "coming later" on the Arena ranking screen); best-rank achievements and participation chests
  are in scope.

## Out of scope (declared "coming later", listed in docs/SCOPE.md)

Cross-Server Clash, World Championship / Championship, SPT Temple, King's Trial (PvE ladder under
Victory Road), trainer "set skills", worship, lucky ranks, and cross-server group play.
