---
title: Copy the source exactly
type: decision
date: 2026-10-31
status: active — supersedes the "own names and numbers" rule
sources: [owner in Claude chat 2026-10-31, docs/ASSUMPTIONS.md override #11]
---

# Copy the source exactly (2026-10-31)

Owner: *"everything that is not a brand new feature is a copy from the source and i want it copied
exactly."*

## The rule
- If a system exists in the source game, build it **exactly** like `reference/game-rebuild/`:
  rules, numbers, tables, rows, names, text.
- **Supersedes** the rule OpenCode followed from M8 to M13.2 ("counts and shapes follow the source;
  names, numbers and rows are ours") and M13's content-volume choice 6B.
- AGENTS.md, PROMPT §2.1 and ASSUMPTIONS (override #11) were amended to match.
- Built systems that drifted need fixing — see the [source-fidelity audit](../project/source-fidelity-audit.md).

## Exceptions (the owner's own changes — keep these)
| Exception | Page |
|---|---|
| The 84-Pokémon roster and skills from the owner's wiki | [roster override](pokemon-roster-override.md) |
| The nine Soul-heart sets | [soul-hearts](../systems/soul-hearts.md) |
| Held Item Shards (owner's invention, levelling only) | [Resetter decision](resetter-shards-and-refine.md) |
| No real money; paid tracks/passes/assistant removed; gems earnable | [free-to-play](free-to-play.md) |
| Brand-new ideas: [co-op boss tower](../ideas/coop-boss-tower.md), [change list](../ideas/change-list-2026-10.md) | ideas/ |
| Milestone order, M12 skipped, Gods Trials parked (scheduling, not content) | [roadmap](../milestones/roadmap.md) |

**Unclear — ask the owner:** his refine ladder (free, then 1,1,2,2…10) vs the source's
(1,1,2,3,4,5,6,8,10,12,14,16,18,20, then 20). He set his ladder before learning how the source refines.

## Practical notes
- `reference/` is gitignored and lives only on the owner's PC, so exact copying has to be done by an
  agent that can read it (OpenCode on his machine, or Claude with his folder shared).
- The owner accepted the IP exposure for this private, invite-only build.
