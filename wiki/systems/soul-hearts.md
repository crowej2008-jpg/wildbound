---
title: Soul-hearts (owner's nine sets)
type: system
milestone: M11.4
status: built
updated: 2026-10-31
sources: [opencode-session-2026-10 msgs 69-71 (owner's list, verbatim), docs/CHANGELOG.md M11.4, packages/content/equipment/cores.json]
---

# Soul-hearts — the owner's nine sets

Jayden replaced the source's sets with his own list on 2026-10-20. Full replacement of the 12
placeholders; more source sets can be added later as content.

| Set | 2-piece | 4-piece | 6-piece |
|---|---|---|---|
| **Common** | Soul Heart DEF +10% | Soul Heart ATK +10% | DMG reduction +10% on entering battle (first 3 rounds) |
| **Flying** | Control Res +10% | Control Res +25% | Control Immunity every 3 turns, **starting turn 3** (owner follow-up) |
| **Fire** | +10% dmg vs shielded enemies | +30% dmg vs shielded | "Puncture" every 3 turns — attacks nullify enemy shields |
| **Superpower** | Sp.Atk +10% | Crit Intensity +20% | Sp.Atk +30% |
| **Water** | +50% Soul Heart DEF and +25% DMG red., first round only | Restore 25% HP every 4 rounds | 50% chance to heal 10% max HP when attacked |
| **Bug** | Lifesteal 5% | Lifesteal 12% | Lifesteal 25% |
| **Thunder** | Guard Break +10% | Guard Break +25% | Attacks: 10% chance to paralyse |
| **Rock** | Soul Heart DEF +15% | DMG reduction +15% | Restore 10% HP every turn |
| **Grass** | Shield = 20% max HP at battle start | 50% of overheal → shield | +20% dmg while shielded |

## Interpretation rules (agent's, encoded as data)
- **Same-stat ladders take the highest tier, not the sum** (Bug 6pc = 25% lifesteal, not 42%).
  Distinct effects at 2/4/6 all apply.
- Cadences are named settings in `combat.json`/`cores.json` (`controlImmunityEvery: 3`,
  `punctureEvery: 3`): Puncture and immunity at turns 3/6/9; Water heal end of rounds 4/8/12; Rock heal
  at turn start.
- "Puncture" is a new buff kind; hooks live in `engine/src/combat/soulheart.ts`.
