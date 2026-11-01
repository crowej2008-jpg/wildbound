---
title: M8 PvE modes (Tower, Trials, World Boss, Dungeons, Link Crystal)
type: system
milestone: M8
status: built
updated: 2026-10-31
sources: [docs/design/pve-modes.md, docs/ASSUMPTIONS.md M8, opencode-session-2026-10 msg 26]
---

# M8 PvE modes

Challenges hub at `/combat`; routes `/tower`, `/trials`, `/boss`, `/dungeons`, `/crystal`.

| Mode | Shape |
|---|---|
| **Tower** | Floors permanent; climbs reset **weekly**, sweeps **daily** (PROMPT §7.6, not the source's per-day reset). Milestone chests. |
| **Trials** (5) | Stormwall Bastion (faction-locked), Silent Peak (no ultimates), Locked Vale (Lv40 cap), Lastlight Stand (survive 8 rounds), Moonfall Crypt (Tue/Thu/Sat). |
| **Tower** (R9) | Normal 1,000 floors + Hard 750 floors with a lineup rule per five-floor stage; source achievements; climbs reset daily (ASSUMPTIONS #79). |
| **Daily Dungeons** (R9: the source's 4, open daily) | Gold, Vanity, XP & ASC, Shard — ten difficulties by trainer level, two runs a day, C–S grades, sweeps, one-off grade chests (ASSUMPTIONS #78). Replaced the seven weekday stand-ins. |
| **World Boss** | 7-day rotation; local ghost ladder (own history + deterministic bots); milestones. |
| **Link Crystal** | Endgame level lift; unlocks on a Wild that is final-form **and** at form cap; star gate 10★ (our max). Feeds [Resonance](collection-layers.md#resonance). |

- Enemies come from a **difficulty curve** (`generateEnemies`), not authored floor tables.
- `BattleRules { noUltimate, survivalRounds }` added for trials.
- Names above are the agent's; owner was offered renames and didn't ask for any.

Not to be confused with the M13 [Faction Tower](faction-tower.md) or the planned
[co-op boss tower](../ideas/coop-boss-tower.md).
