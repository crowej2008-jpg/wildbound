---
title: Wildbound wiki — index
type: index
updated: 2026-10-31
---

# Wildbound wiki — index

**Agents: read this page first, then [owner rules](project/owner-rules.md) and
[open questions](open-questions.md).** How the wiki is maintained: `AGENTS.md` › "Project wiki".
Recent changes: [log](log.md).

**Now:** the [source retrofit](milestones/source-retrofit.md): R4 Potential and R3 Orbs done (save v23); **R6** next, then R7, R8
(no list-and-wait since 2026-11-01). Done just before: [battle engine completion](milestones/battle-engine.md)
E1–E6. Later: R2/R3 when the gear and orb tables are re-extracted, R9, R10; then M13.3
[Hoopa's Vault](systems/hoopa-vault.md).

## Start here
- [overview](overview.md) — what Wildbound is, who it's for, where it stands
- [open questions](open-questions.md) — owner decisions pending + repo docs that are out of date
- [log](log.md) — what changed in this wiki and when

## Project
- [owner rules](project/owner-rules.md) — Jayden's standing instructions (push to git, list before each milestone, F2P)
- [architecture](project/architecture.md) — packages, boundaries, the per-mode build pattern
- [source-fidelity audit](project/source-fidelity-audit.md) — built systems that differ from the source
- [dev environment](project/dev-environment.md) — repo/local paths, Windows/pnpm/git quirks, OpenCode limits

## Decisions (dated, with the owner's words)
- [Pokémon roster override](decisions/pokemon-roster-override.md) — 2026-10-15, 84 Pokémon replace originals
- [IP guard and art](decisions/ip-guard-and-art.md) — 2026-10-17, option B: raster art only in `public/art/`
- [private group + backend](decisions/private-group-and-backend.md) — 2026-10-17, invite-only; M19 required
- [Mount / Back Decor / Follower numbers made up](decisions/fashion-numbers-made-up.md) — 2026-11-01, invented curve and piece stats; pieces and sets stay the source
- [World Boss changes](decisions/world-boss-changes.md) — 2026-11-01, shard drops, VIP 14 skip, strong unkillable boss
- [milestone renumbering](decisions/milestone-renumbering.md) — 2026-10-16/17 old → new numbers
- [M11 names and materials](decisions/m11-names-and-materials.md) — 2026-10-20 source labels, one material per layer
- [M12 deferred, Gods Trials parked](decisions/m12-artifacts-deferred.md) — 2026-10-21/23
- [M13 scope and gates](decisions/m13-scope-and-gates.md) — 2026-10-23 182×10 campaign, A/B gates, source counts
- [free to play](decisions/free-to-play.md) — 2026-10-23 no real money
- [copy the source exactly](decisions/copy-the-source-exactly.md) — 2026-10-31, exact copy except owner's own features
- [Resetter Shards and refine ladder](decisions/resetter-shards-and-refine.md) — 2026-10-23/31 free, 1,1,2,2…10
- [server boundary now, backend later](decisions/server-boundary-now.md) — 2026-10-31
- [owner kit changes](decisions/kit-changes-2026-10-31.md) — 2026-10-31 Mew, Snorlax, Mimikyu, Dialga

## Systems — built
- [combat engine](systems/combat-engine.md) · [skill kits (M9)](systems/skill-kits.md) · [roster](systems/roster.md) · [combat numbers (E5)](systems/combat-numbers.md) · [E6 tier list](systems/e6-tier-list.md)
- [campaign](systems/campaign.md) · [summoning and shops](systems/summoning-and-shops.md) · [M8 PvE modes](systems/pve-modes.md)
- [PvP](systems/pvp.md) · [collection layers](systems/collection-layers.md) · [soul-hearts](systems/soul-hearts.md) · [held items](systems/held-items.md)
- [explore hub](systems/explore-hub.md) · [Pet Home](systems/pet-home.md) · [Sky Pillar](systems/sky-pillar.md)
- Reference: [currencies](systems/currencies.md) · [save versions](systems/save-versions.md)

## Systems — planned / parked
- M13: [Hoopa's Vault](systems/hoopa-vault.md) (next) · [Rift Arena](systems/rift-arena.md) · [Misty Woods](systems/misty-woods.md) · [Faction Tower](systems/faction-tower.md) · [Island Challenge](systems/island-challenge.md) · [Ultra Wormhole](systems/ultra-wormhole.md)
- Parked/deferred: [Gods Trials](systems/gods-trials.md) · [artifacts, Ruins, Relic Battlefield](systems/artifacts-and-relic.md)
- Later: [visual identity (M18)](systems/visual-identity.md) · [backend (M19)](systems/backend.md) · [Build Lab (M20)](systems/build-lab.md)

## Milestones
- [roadmap](milestones/roadmap.md) — M0–M20 with status
- [source retrofit](milestones/source-retrofit.md) — R0–R10, runs before M13.3
- [battle engine](milestones/battle-engine.md) — E1–E6, the owner's pause to finish combat
- [M13](milestones/m13.md) — sub-step table
- [history](milestones/history.md) — dates, commits, test counts

## Ideas (owner's, not scheduled)
- [co-op boss rush tower](ideas/coop-boss-tower.md) — pairs, 300 floors × 5 stages, weekly bans
- [change list Oct 2026](ideas/change-list-2026-10.md) — 18 items incl. guild size 8

## Sources ingested
- [OpenCode session Oct 12–31](sources/opencode-session-2026-10.md)

## Repo docs (the wiki links to these rather than copying them)
`PROMPT.md` (master spec) · `AGENTS.md` (working agreement) · `docs/SCOPE.md` (status table) ·
`docs/ASSUMPTIONS.md` (numbered rule decisions) · `docs/CHANGELOG.md` (per-step changes) ·
`docs/design/*.md` (one note per system) · `docs/PORT-REPORT.md` (M9 skill port residue)
