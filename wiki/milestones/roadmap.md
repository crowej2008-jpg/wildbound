---
title: Roadmap
type: milestones
updated: 2026-10-31
sources: [docs/SCOPE.md, AGENTS.md, PROMPT.md §13]
---

# Roadmap (plan of record since 2026-10-17)

Order: **M10 → all remaining modes/systems → sprites → server → Build Lab.**
Numbers changed twice — see [renumbering](../decisions/milestone-renumbering.md).

| M | What | Status |
|---|---|---|
| M0 | Foundations, tooling, IP guard | built |
| M1 | [Combat engine](../systems/combat-engine.md) | built |
| M2 | Content core (now the [84-Pokémon roster](../systems/roster.md)) | built |
| M3 | Account, roster, growth, squads, LocalServer, saves | built |
| M4 | Battle UI (replay from event log) | built |
| M5 | [Campaign, idle, daily loop](../systems/campaign.md) | built |
| M6 | [Summoning and shops](../systems/summoning-and-shops.md) | built |
| M7 | Equipment layers (UI finished in M11.0) | built |
| M8 | [Tower, Trials, World Boss, Dungeons, Link Crystal](../systems/pve-modes.md) | built |
| M9 | [Skill kits — DSL v2 + 84-kit port](../systems/skill-kits.md) | built |
| M10 | [PvP — Arena + Ranked](../systems/pvp.md) | built |
| M11 | [Collection layers II](../systems/collection-layers.md) | built |
| M12 | [Artifacts, Suppression, Ruins](../systems/artifacts-and-relic.md) | **deferred** |
| E | [Battle engine completion](battle-engine.md) — triggers, held-item skills, unmodelled kit clauses | **in progress** (E1–E2 built) |
| R | [Source retrofit](source-retrofit.md) — built systems copied exactly from the source | in progress (R0, R1, R5 built; paused for E) |
| M13 | [Explore modes](m13.md) | in progress (13.3 after R) |
| M14 | Victory Road + King's Trial, Paradise, Joint Team + Dynamax/Wild Area, Clash of Isles (Shovel Carnival → M16) | **done 2026-11-05** (Victory Road, King's Trial, Paradise, Joint Team + Wild Area, Clash of Isles) |
| M15 | [Account systems III](m15.md): trainer treasures, Z Ring, Pure Crystals, fusion skins, Golden Egg, Awakening | **done 2026-11-05** |
| M16 | Guild, merge, events (simulated; includes Shovel Carnival) | **done 2026-11-05** (CPU guild, Shovel Carnival, Merge Event) |
| M17 | Guild war + Relic Battlefield (needs M12) | **done 2026-11-05** (solo vs CPU guilds) |
| M18 | Cross-server PvP: Clash, Championship, SPT Temple | **done 2026-11-05** (solo vs CPU players) |
| M19 | [Visual identity](../systems/visual-identity.md) | pending |
| M20 | [Shared backend](../systems/backend.md) (required; owner 2026-11-04: probably solo with scaling CPUs — revisit) | pending |
| M21 | [Build Lab](../systems/build-lab.md) | pending (last) |
| After M21 | [Mode difficulty curves](../decisions/difficulty-curves-at-the-end.md) | parked: owner 2026-11-04, "at the very end" |

Parked outside the numbering: [Gods Trials](../systems/gods-trials.md) ("after M13 and others").
Workflow: since 2026-11-01 no list-and-wait between milestones; stop only for the owner's own calls
([owner rules](../project/owner-rules.md)).
