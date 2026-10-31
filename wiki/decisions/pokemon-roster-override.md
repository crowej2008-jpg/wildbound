---
title: Pokémon roster override
type: decision
date: 2026-10-15
status: active
sources: [docs/ASSUMPTIONS.md "Owner content override" 1-8, opencode-session-2026-10 msgs 28-36]
---

# Pokémon roster override (2026-10-15)

**Decision:** the shipped roster is the owner's 84 Pokémon from his own wiki
(`wiki-pokemon-skills.xlsx`), with their real names and skills. No original Wilds remain.

## How it happened
1. Owner asked to replace the heroes with his spreadsheet. The agent refused at first: PROMPT §2.1
   and the IP guard banned franchise names.
2. Owner: "i wrote the wiki" → "this game is not going to be shared between anybody but me" →
   "you finish the work". Treated as an explicit override; AGENTS.md and PROMPT.md §2.1 amended
   (commit `40d2455`), roster swapped (`daa1894`).
3. Owner: "i want none of the original 36 wilds left, i want the pokemons names and skills" →
   all originals removed (`a5032e9`). `tidewarden`/`twigleaf` survive only as golden-test fixtures.
4. Owner then had the agent scrape all 84 wiki pages into `wiki-pokemon-skills-filled.xlsx`
   (579 skill rows) — the source for the [M9 skill-kit port](../systems/skill-kits.md).

## Rules that follow
- Pokémon names are allowed **only in `packages/content`** (species, kits, Ranked region names).
- The IP guard still blocks `nintendo`, `game freak`, `digimon`, `yokai` — see
  [IP guard and art](ip-guard-and-art.md).
- Attribute → faction map: Fire→ember, Water→tide, Grass→grove, Dark→shade, Light→volt/frost.
- Evolution stages are generated: `X`, `X Prime`, `X Zenith`.
- Scope later widened from "only me" to a small private group
  ([private group + backend](private-group-and-backend.md)).

Related: [roster](../systems/roster.md).
