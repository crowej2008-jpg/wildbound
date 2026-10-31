---
title: Campaign, idle and daily loop
type: system
milestone: M5, expanded M13.0a
status: built
updated: 2026-10-31
sources: [docs/design/pve.md, docs/design/balance.md, docs/design/campaign-expansion.md, docs/ASSUMPTIONS.md M13 #35-36, #40]
---

# Campaign, idle and daily loop

## M5 (2026-10-12)
- Chapters, auto-battle, stars, first-clear/repeat rewards, idle income, daily quests, mail, debug
  clock, tutorial.
- **Balance call by the agent:** chapters 2–3 originally used legendary/mythic enemies a starter team
  couldn't beat; re-authored with common/rare enemies (`docs/design/balance.md`,
  `campaign-balance.test.ts`). Owner was told and didn't object.
- Bug fixed: `debugClockOffset` is minutes, was being added as ms.

## M13.0a expansion (2026-10-23)
- **182 chapters × 10 stages** (source shape). Chapters 1–3 keep M5's authored stages 1–6 + new 7–10;
  chapters 4–182 generated once by `scripts/generate-campaign.mjs` → `packages/content/stages/campaign.json`
  (1,790 stages). `tuning/campaign.json` has 182 chapter rows + 60 gyms.
- **60 gym gates** at 3-1, 6-1 … 180-1: a gated stage needs its predecessor **and** its gym. Gym opens
  after the stage before the gate. First win pays once; replays are practice.
- Chapter-complete mail: flat **200 gems** ([free-to-play](../decisions/free-to-play.md)).
- Save v14: `campaign.gyms`.
- **Victory Road** layer (gym tasks, badges, commission, Hall of Fame, 250 chests) → M14.

Gates for every mode key off campaign stages — see [M13 gates](../decisions/m13-scope-and-gates.md).
