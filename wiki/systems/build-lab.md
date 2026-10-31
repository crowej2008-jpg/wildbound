---
title: Build Lab
type: system
milestone: M20 (last)
status: pending
updated: 2026-10-31
sources: [PROMPT.md §7.10, opencode-session-2026-10 msg 38]
---

# Build Lab — the owner's main goal (M20, last milestone)

Owner moved it to the end on 2026-10-16 ("make the build lab the last milestone").

From PROMPT §7.10:
- Pick any Wild or kit (including unreleased **draft** kits) and any loadout; pick opponents (stage
  squads, arena ghosts, hand-built dummies).
- Run N seeded battles → win rate, mean damage, rounds, per-unit damage with **95% confidence intervals**.
- **Sweeps:** vary one parameter (a stat line, a held item, an orb set) and plot win rate; compare builds.
- **Rules panel** exposes every setting in `combat.json` so assumptions can be changed and re-run.
- **Kit editor** (form + JSON) with live validation and instant 1v1/6v6 tests; drafts kept separate
  from shipped content.
- Export/import builds and sweeps as JSON; `pnpm sim` runs the same thing headless.

Building blocks already exist: deterministic [combat engine](combat-engine.md), `pnpm sim`, the
statistical test harness, and the measured balance passes (M10.6, M11.12).
