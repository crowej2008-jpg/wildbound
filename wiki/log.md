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

## [2026-10-31] update | R0 built — source loader, save reset
- Owner: "ok lets reset". Save v18 = reset baseline; `scripts/source/source.mjs`, `docs/SOURCE-TABLES.md`.
- Built by Claude in the cloud, verified on CI: 506 unit / 90 e2e. Pages: retrofit, save versions,
  history, index, overview.

## [2026-10-31] update | R1 built — species and growth from the source
- Owner: "go" (stand-ins for the two missing tables). Five factions, ATK/DEF/SKILL, Origin tier, source
  star ladders and stats, fodder Evolve, faction damage bonus; save v19. 498 unit / 90 e2e on CI.
- Pages: roster, combat engine, save versions, history, index, overview, open questions, retrofit.

## [2026-10-31] update | R5 built — held items from the source
- Owner: "lets just go off of what we know". 75 source items, rolled main stat + lines, re-roll refine
  with keep/drop on the owner's ladder, levels to 200, lock, dismantle, Resetters; save v20.
- Gear/Orbs will be built from the kb notes with labelled stand-ins (ASSUMPTIONS #55).
- Pages: held items, resetter decision, currencies, save versions, retrofit, open questions.

## [2026-10-31] update | E1 + E2 built — battle triggers, all held-item skills live
- Owner: "could we take a break on the current milestone and finnish all of the battle enigine" → "ok".
- New page [battle engine](milestones/battle-engine.md); CI 522 unit / 90 e2e. Pages: index, roadmap,
  combat engine, held items, open questions.

## [2026-10-31] update | E3 built — kit clauses hand-ported
- Owner: "yes". 68 kits hand-ported, parser Rage / stat-name fixes, engine rules; 46 bespoke clauses
  left and listed. CI 541 unit / 90 e2e. Pages: battle engine, skill kits, index.

## [2026-10-31] update | Owner reading: Mew counts every fallen enemy
- Owner: "i want it as every enemies" — Mew / Shiny Mew Talent 4 Rage on any enemy death (`onEnemyDeath`).
  ASSUMPTIONS #59.

## [2026-10-31] decision | Owner kit changes: Snorlax, Mimikyu, Dialga
- Snorlax +2%/1% lost uncapped; Mimikyu extra attacks gain Rage; Dialga fills the whole team's Rage.
  Page: [kit changes](decisions/kit-changes-2026-10-31.md).

## [2026-10-31] update | E4 built — Origin skill levels and species shards
- Owner: "lets do per pokemon shards as with the origin skills"; shard source "No source until R9".
  Save v21. Pages: battle engine, save versions, index.

## [2026-10-31] update | E5 — combat numbers checked against the notes
- Symmetric team cut, Block INT on the blocker, Counter passes shields, Wobbuffet 75%, Ranked base 16.
  New page [combat numbers](systems/combat-numbers.md).

## [2026-10-31] decision | No team-Power cut
- Owner: "i dont want there to be a cut for weaker teams against stronger teams". `teamPowerCut` false,
  Ranked base back to 12. Pages: combat numbers, owner changes.

## [2026-10-31] decision | Action Rage for SKILL class only
- Owner: "pokemon only get +250 rage if they are a skill class". Only `adept` gains the +250 per normal
  attack / basic skill; Strikers and Guardians gain 0. Mimikyu (Striker) extra attacks gain 0 too.
- Dialga fallback (Dialga + 2 allies to full) recorded, not built. Page: owner changes.

## [2026-11-01] update | E6 tier list
- Owner scope: Supremes, Mythics and Origins only (56). Random-team sims at three stages plus long-fight
  runs; Dialga vs the friend's version measured. Page: [E6 tier list](systems/e6-tier-list.md). Harness
  `scripts/balance/tier.ts`.

## [2026-11-01] decision | Action Rage +125, SKILL class +250
- Owner: "the normal number is +125, +250 is only for pokemon with the skill class". Corrects the
  2026-10-31 rule (Strikers/Guardians had 0). Page: owner changes.
- Owner context for E6: the real meta is God Ash Pikachu, Wobbuffet, Greninja, Shiny Blastoise, Psyduck,
  Origin Lugia, and *"its when they are maxed that things start to get crazy, like plates trinkets and a
  bunch of stuff we havent added yet"* — the no-gear tier list is a base-kit check only; the geared
  re-check waits for the retrofit.

## [2026-11-01] decision | PvP DMG Boost cap deferred
- Owner relayed a 50% PvP DMG Boost cap from the base game (via his friend; not in the kb), then
  *"drop it for now"*. Not built; open question #9 until the orb/gear retrofit.

## [2026-11-01] decision | No list-and-wait before milestones
- Owner: *"can we get rid of that rule?"* — the 2026-10-21 "list what is needed and wait" rule ends.
  Pages: owner rules, roadmap, source retrofit; AGENTS.md process note.

## [2026-11-01] update | E6 closed; retrofit resumes with R4
- E6 done (tier list, Dialga, Rage). Mode curves + geared tier check moved into R10. Index "Now" points
  at R4 Potential.

## [2026-11-01] update | R4 Potential built
- Source copy: 62 trees, 67 options, shard table, fodder, Potential Core, reset 16 💎. Save v22. Readings in
  ASSUMPTIONS #64. Pages: collection layers, source retrofit, save versions.
