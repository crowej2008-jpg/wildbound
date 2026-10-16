# Balance — campaign difficulty curve (M5)

The campaign ladder is the first place the game asks the player to *grow* Wilds, so the authored
enemy squads must be beatable by the roster the player actually has. This note records the M5 curve,
why it was re-tuned, and how it is locked by a test.

Reference read: `kb/pokemon-growth.md`, `kb/stats-and-combat.md` (shape only — no rows copied), and
PROMPT.md §7.6 (stages), §7.1 (growth), §13 (M5 done criterion).

## The constraint

In M5 the player owns a fixed **six-common** roster (`tuning/account.json`): four adepts and two
strikers, no guardian, and summoning does not exist until M6. Growth is the only lever: levels
(`levelCurve = 1 + (lv-1) × 0.022`), stars (`1 + (stars-1) × 0.12`), and one evolution
(`×1.18`). A common at Lv60/stage0/3★ reaches ≈ `2.85×` base; chapter-2/3 enemies authored as
legendary/mythic/supreme at 2-4★ stage 2-3 reach **5-15×** and cannot be beaten, so the original curve
failed the done criterion ("play from first launch to chapter 3").

## The curve (authored)

Enemies use only **common/rare** species, with count/level/star/stage rising per chapter. No
legendary/mythic/supreme appears before M6 makes them obtainable.

| Chapter | Enemies | Level | Stars | Evolve stage | Target player profile |
|---|---|---|---|---|---|
| 1 | 1-4, commons (+1 rare) | 2-4 | 1 | 0 | Lv12, 1★, stage 0 |
| 2 | 3-4, commons + rares | 6-9 | 1-2 | 0 | Lv16-18, 2★, stage 0 |
| 3 | 4-5, rares (+1 epic) | 10-12 | 2 | 0-1 | Lv20-26, 2-3★, stage 1 |

Reproducible first-clear/repeat rewards and per-minute idle rates rise with the stage (chapter 1
`60/6 → 110/11`, chapter 3 `600/60 → 1000/100`). Star round thresholds (`starRounds`) widen slightly
per chapter.

## Why these target profiles are reachable

- **Chapter 1** finishes inside the starting budget (levelling all six to ≈Lv12 costs ≈43k candy /
  130k gold), so a first session clears it.
- **Chapter 2** needs ≈Lv18 (≈75k candy total); the difference is covered by campaign first-clears
  (~2.3k candy), the daily quests + activity chests (~1.1k candy/day), the welcome mail and idle
  income (~16k/day at chapter 1) over roughly one to two simulated days — i.e. the daily loop funds it.
- **Chapter 3** needs ≈Lv24 plus a stage-1 evolution; it accrues from the same loop over more days.
  This is an idle game, so multi-day progression is expected.

## How it is locked

`packages/server/src/campaign-balance.test.ts` funds a squad to the chapter-3 target profile
(Lv26, 3★, stage 1) and clears **every** stage in order, retrying each with fresh battle seeds,
asserting `c3-6` is cleared. It isolates the combat curve from the economy (resources are granted
directly; the economy has its own tests). If the curve or growth tables change, this test fails.

## Revisit when

- **M6 (summoning)**: players can obtain higher-tier Wilds, so chapters beyond 3 may field
  rare/epic/legendary squads and the mid-curve can tighten.
- **M7/M8 (equipment, trials)**: gear adds power the current curve does not assume.
- **M13 (Build Lab)**: sweeps with confidence intervals should replace the fixed-profile check with a
  win-rate band per stage.
