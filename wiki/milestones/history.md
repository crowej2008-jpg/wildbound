---
title: Milestone history (M0–M13.2)
type: milestones
updated: 2026-10-31
sources: [docs/CHANGELOG.md, opencode-session-2026-10]
---

# Milestone history

Test counts are unit / e2e at the end of each step (green `pnpm check`).

| Date | Milestone | Key facts | Tests |
|---|---|---|---|
| 10-09 → 10-11 | M0–M4 | Monorepo, deterministic engine, content core, account/squads, battle replay UI | — |
| 10-12 | M5 | Campaign rebalance (agent's call), debug-clock units bug fixed. Commit `b7d8251` | 165 / 28 |
| 10-14 | M6 | Gacha + six shops, save v3 | 196 / 38 |
| 10-14 | M7 | Equipment engine/server only — **UI not wired** (fixed in M11.0) | 213 / — |
| 10-15 | M8 | PvE modes + Link Crystal; M6–M8 committed together as `1871e18` | 253 / 50 |
| 10-15 | Override | [Pokémon roster](../decisions/pokemon-roster-override.md) `40d2455`, `daa1894`, `a5032e9` | 253 / 50 |
| 10-16 | Renumber | Skill kits become M9 (`5370f00`) | |
| 10-16 → 10-17 | M9 | [DSL v2 + 84-kit port](../systems/skill-kits.md); M9.7 balance check `ea3a18b` | 316 / 50 |
| 10-17 | Decisions | [IP guard B](../decisions/ip-guard-and-art.md) `b8892dc`; visual refs; [private group](../decisions/private-group-and-backend.md); [roadmap renumber](../decisions/milestone-renumbering.md) `9f5f516` | 319 / 50 |
| 10-18 | M10 | [PvP](../systems/pvp.md) M10.1–M10.6, balance pass `70a7c36`/`35f3640` | 406 / 58 |
| 10-20 → 10-21 | M11 | [Collection layers](../systems/collection-layers.md) 11.0–11.12, `d7f2b65`, `b4be96f` | 454 / 82 |
| 10-21 | M12 | [Skipped](../decisions/m12-artifacts-deferred.md) | |
| 10-23 | M13.0a | [Campaign 182×10](../systems/campaign.md) | |
| 10-27 | M13.0b | [Explore hub](../systems/explore-hub.md) `92def0a` | 475 / 86 |
| 10-28 | M13.1 | [Pet Home](../systems/pet-home.md) | 494 / 88 |
| 10-31 | M13.2 | [Sky Pillar](../systems/sky-pillar.md) `27536b7` | 510 / 90 |
| 10-31 | M13.3 | Started 08:07, OpenCode hit free usage limit 08:09; no edits | |
| 10-31 | Rules | [Copy the source exactly](../decisions/copy-the-source-exactly.md); CI added; [retrofit](source-retrofit.md) planned | |
| 10-31 | R0 | Source loader + `docs/SOURCE-TABLES.md`; save v18 reset (built by Claude, tested on CI) | 506 / 90 |
| 10-31 | R1 | Species, five factions, star ladders, source stats, fodder Evolve; save v19 | 498 / 90 |
