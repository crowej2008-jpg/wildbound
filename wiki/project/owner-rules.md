---
title: Owner's standing instructions
type: project
updated: 2026-11-01
sources: [opencode-session-2026-10, AGENTS.md]
---

# Owner's standing instructions

Things Jayden has told the agent that apply to **every** session until he says otherwise. Read these
before doing any work.

| Since | Instruction | Notes |
|---|---|---|
| 2026-10-12 | **Push everything to the git repo** (`origin/main`). | Repeated many times ("commit any uncommitted work", "push to the repo"). |
| 2026-10-13 | Do milestones **without asking for confirmation**. | In force again since 2026-11-01 (the next row ended). |
| ~~2026-10-21~~ | ~~Before every milestone, give a list of what is needed — and wait.~~ | **Ended 2026-11-01:** *"can we get rid of that rule?"* |
| 2026-11-01 | **Keep going without waiting between milestones.** | Agent's practice (proposed to the owner the same day): stop only for the owner's own calls — his deliberate changes, taste (names, art), source text that reads two ways when the choice can't be undone, missing source tables. Otherwise take the reading closest to the source, record it in `docs/ASSUMPTIONS.md`, and add it to a review list for the owner. |
| 2026-10-23 | Game must be **almost completely free to play**; anything costing real money is removed. | [free-to-play](../decisions/free-to-play.md) |
| 2026-10-23 | When unsure about a mode, **check the source** (`reference/game-rebuild/`). | e.g. "look at the source for pet home", "follow the source". |
| 2026-10-31 | **Copy the source exactly** — everything that isn't a brand-new feature matches the source game's rules, numbers, rows and names. | [decision](../decisions/copy-the-source-exactly.md) · [audit](source-fidelity-audit.md) |
| 2026-10-15 | Use the **Pokémon names and skills** from the owner's wiki/spreadsheet; no original Wilds. | [roster override](../decisions/pokemon-roster-override.md) |

## How Jayden works
- Short messages: "continue", "ok", "yes", numbered answers like `1. A 2. …`. Long sessions run
  overnight; "continue" means resume the current sub-milestone.
- Wants option lists with a recommendation, then picks. "Just do what you recommend" is common.
- Asks "what is needed" / "what was done" / "is X done?" — answer with a short status plus what's next.
- He wrote the Pokémon wiki the roster comes from (pokemon-wiki-sandy.vercel.app).

## From AGENTS.md (unchanged rules)
- One milestone at a time; `pnpm check` green before "done"; commit after every passing step.
- Engine stays pure/deterministic; everything tunable lives in `packages/content`.
- Write `docs/design/<system>.md` before coding a system; record uncertain rules in `docs/ASSUMPTIONS.md`.
- Never delete tests to get green; never weaken a threshold without recording why.
