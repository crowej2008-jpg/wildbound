---
title: Skill kits (DSL v2) and the 84-kit port
type: system
milestone: M9
status: built
updated: 2026-10-31
sources: [docs/design/skill-kits.md, docs/PORT-REPORT.md, docs/ASSUMPTIONS.md M9 #13-20, opencode-session-2026-10 msgs 32-50]
---

# Skill kits (DSL v2) and the 84-kit port (M9)

## Why M9 exists
The first roster import (2026-10-15) only had 17 creatures' skills, and the old DSL couldn't express
many effects, so the agent **approximated or dropped** them (DEF shred → dmgRdct, ally buffs dropped,
etc.). Owner: *"why did you change the effects?"* → agreed to expand the engine first, then port
**all 84** faithfully once he supplied the full skill data.

## The data
`wiki-pokemon-skills-filled.xlsx` (owner's Downloads): 579 skill rows scraped from
pokemon-wiki-sandy.vercel.app — Basic Attack, Ult, Basic Skill, Passive (Origin/Shadow only),
Talents 1–4 for every creature. Committed as `scripts/data/pokemon-skills.json`; ported by
`scripts/port-skills.mjs` (idempotent; replaces only `skills`/`talents`).

## DSL v2 (strictly additive — absent field = old behaviour)
| Step | Commit | Added |
|---|---|---|
| M9.1 | `ebfdcf1` | targeting rules + `side`, true damage, %-HP bases |
| M9.2 | `e2d4a0a` | `effects[]` (buff/dot/control/heal/shield/cleanse/dispel/rage/resource/revive/damage), conditions |
| M9.3 | `59ae59c` | per-creature resources/stack counters, level ladders, cooldowns |
| M9.4 | `c524c86` | talent `triggers[]` (on-hit, on-death, turn-start, on-kill, HP-below…) |
| M9.5 | `4c3b1bc` | `pDef`/`sDef` behind `defendersUseDef` (kept **off**) |
| M9.6 | `c9a9400`, `06a95e4` | faithful port of all 84 kits; 0 unmatched |
| M9.7 | `ea3a18b` | re-tune check — campaign balance still passes, no data change |

## E3 (2026-10-31)
68 kits hand-ported (`scripts/data/build-kit-overrides.py`), parser fixes for Rage shares, Crit
strength / Break and attack-% buffs — see [battle engine](../milestones/battle-engine.md).

## Known limits
- LV.2+ upgrade text is recorded, not modelled. Residual clauses are logged in `docs/PORT-REPORT.md`.
- Default durations: DoT 2 turns, untimed control 1 turn, talents = `battleStart` with `turns: 99`.

Related: [combat engine](combat-engine.md), [roster](roster.md), [roster override](../decisions/pokemon-roster-override.md).
