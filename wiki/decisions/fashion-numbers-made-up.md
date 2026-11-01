---
title: Mount / Back Decor / Follower numbers are made up
type: decision
date: 2026-11-01
status: active
sources: [owner in Claude chat 2026-11-01, docs/ASSUMPTIONS.md #77]
---

# Mount / Back Decor / Follower numbers are made up (2026-11-01)

Owner, on the missing `fashion_up_star_json` and per-skin stats: *"just make these numbers up"*.

## What changes
- An exception to [copy the source exactly](copy-the-source-exactly.md) for these numbers only.
- Still the source: every piece (37 outfits, 38 followers, 40 mounts, 41 back decor), the free starting
  pieces, the 35 sets with their 2 / 3 / 5-piece bonuses and titles, the stone price (10 per 100 exp),
  levels 0–200 in tiers of ten stars.
- Made up: the level curve (fitted to the screen readings at 173, 174 and 200) and each piece's stats
  (the three bonus shapes read on screen), stars 1–15, activation and ascend costs.
- If the real tables turn up, re-run `scripts/import-fashion.mjs` against them.
