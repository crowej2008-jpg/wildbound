# Campaign expansion (M13.0a)

M13.0a grows the campaign from three authored chapters to the source's **182 chapters × 10
stages** and adds the **60 Victory Road gym gates** at the first stage of every third chapter
(3-1, 6-1 … 180-1). The full Victory Road task/badge/commission layer stays in M14; this step
builds the gate encounters and the story gate only.

## Data

- `packages/content/tuning/campaign.json` — the authored chapter index (number, name, region,
  faction) and the 60 gyms (id, index, chapter, name, region, faction, six-enemy squad, rewards).
  `chapterChestGems` lives here too.
- `packages/content/stages/chapter1.json` … `chapter3.json` — the original 18 stages, extended to
  ten stages per chapter without changing the six authored stages.
- `packages/content/stages/campaign.json` — chapters 4–182, generated once by
  `scripts/generate-campaign.mjs` and committed. The runtime never generates content.
- Every third chapter's first stage carries `gate: { gymId }`.

The generator uses the source's *shape* (182×10, 60 gates, ten-stage chapters, enemy counts,
idle change points) with our own names, factions and numbers. It does not copy source rows.

## Rules

- A normal stage still unlocks when its predecessor is cleared.
- A gated stage additionally requires its gym to be cleared.
- A gym is available once the stage immediately before its chapter gate is cleared.
- A gym win is recorded in `campaign.gyms`; only the first win pays the gym reward. Replays are
  allowed for practice.
- The chapter-complete mail pays `campaign.chapterChestGems` (200), not the old
  `100 + 50 × chapter` formula.

## Save

`SAVE_VERSION` 14. Older saves get `campaign.gyms = {}`; stars are preserved.

## Deliberately not in 13.0a

- Victory Road tasks, gym progress (30/60/100), badges, daily commission, Hall of Fame — M14.
- Chapter chests beyond the chapter-complete mail; the source's 250 chests can be added with the
  Victory Road layer.
- Elite/Nightmare tracks.
