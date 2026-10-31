---
title: Wiki log
type: log
---

# Wiki log

Append-only. Newest at the bottom. Format: `## [YYYY-MM-DD] <ingest|query|lint|update> | <title>`
(`grep "^## \[" wiki/log.md | tail -5` shows the latest).

## [2026-10-31] ingest | Wiki created from the OpenCode session + repo docs
- Built by Claude from: the OpenCode session export (Oct 12–31, 98 owner messages),
  `PROMPT.md`, `AGENTS.md`, `docs/SCOPE.md`, `docs/ASSUMPTIONS.md`, `docs/CHANGELOG.md`,
  `docs/design/*`, content JSON, and the owner's design ideas from Claude chats (co-op tower,
  18-item change list).
- Created: overview, index, open questions, 3 project pages, 10 decisions, 26 systems, 3 milestone
  pages, 2 ideas, 1 source page.
- State at ingest: last commit `27536b7` (M13.2 Sky Pillar), save v17, 510 unit / 90 e2e green;
  M13.3 Hoopa's Vault next, not started.

## [2026-10-31] lint | First health check
- Found the out-of-date repo docs listed in [open questions](open-questions.md) (README milestone,
  PROMPT §1 roster size, ASSUMPTIONS #41 ladder, design README plan list, M11 plan vs built).

## [2026-10-31] update | README refreshed, wiki merged to main
- `README.md` now points to `wiki/index.md`, shows the real status (M13, next 13.3) and the
  84-Pokémon roster; removed from the stale-docs list in [open questions](open-questions.md).

## [2026-10-31] query | What does a Held Item refine do?
- Checked `reference/game-rebuild/kb/held-items.md`: in the source a refine re-rolls one random
  line; ours scales the special effect by +20%. Added to [held items](systems/held-items.md) and
  reworded open question #1.

## [2026-10-31] update | Owner rule: copy the source exactly
- New [decision](decisions/copy-the-source-exactly.md) and preliminary
  [source-fidelity audit](project/source-fidelity-audit.md); AGENTS.md, PROMPT §2.1 and
  ASSUMPTIONS override #11 amended. Refine = source re-roll; open question 0 asks which cost ladder.

## [2026-10-31] update | Owner keeps his refine ladder; source retrofit planned
- Refine ladder = owner's (exception to copy-exactly). Owner: "fix up everything to match the source".
- New [source retrofit](milestones/source-retrofit.md) plan R0–R10 from the kb notes; runs before M13.3.

## [2026-10-31] update | CI added
- GitHub Actions runs `pnpm check` on every push; cloud agents read results through annotations.
  First runs: 510/510 unit, content PASS; e2e 90/90 then 88/90 (two flaky mobile M11 tests).
  See [dev environment](project/dev-environment.md).
