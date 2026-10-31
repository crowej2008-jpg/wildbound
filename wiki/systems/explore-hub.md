---
title: Explore hub
type: system
milestone: M13.0b
status: built
updated: 2026-10-31
sources: [docs/design/explore.md, docs/ASSUMPTIONS.md M13 #43]
---

# Explore hub (M13.0b)

- **Explore** is the second bottom-nav tab (nav is now seven tabs). `/explore` shows eight mode cards;
  `/explore/:id` shows the gate checklist, scale, reset cadence and "arrives in" label.
- Planned modes have **no play button** — honest shells until their sub-milestone flips them live.
- Mode metadata: `packages/content/tuning/explore.json` (schema requires exactly eight modes;
  `content:validate` checks each campaign gate is a real stage).
- Engine: `packages/engine/src/explore/` evaluates campaign-stage, level and server-day gates and
  daily/weekly/permanent reset countdowns.
- Server day: save v15 `serverEpoch`; day 1 = creation day; debug fast-forward moves `now`.

| Mode | Status |
|---|---|
| [Pet Home](pet-home.md) | live (13.1) |
| [Sky Pillar](sky-pillar.md) | live (13.2) |
| [Hoopa's Vault](hoopa-vault.md) | next (13.3) |
| [Rift Arena](rift-arena.md) | 13.4–13.5 |
| [Misty Woods](misty-woods.md) | 13.6 |
| [Faction Tower](faction-tower.md) | 13.7 |
| [Island Challenge](island-challenge.md) | 13.8 |
| [Ultra Wormhole](ultra-wormhole.md) | 13.9 |

Gates: [M13 scope and gates](../decisions/m13-scope-and-gates.md).
