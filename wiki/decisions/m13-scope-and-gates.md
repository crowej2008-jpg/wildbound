---
title: M13 scope, campaign size and unlock gates
type: decision
date: 2026-10-23
status: active
sources: [docs/SCOPE.md "M13 plan (locked 2026-10-23)", docs/ASSUMPTIONS.md M13 #35-43, opencode-session-2026-10 msgs 80-84]
---

# M13 scope, campaign size and unlock gates (locked 2026-10-23)

Owner answers: `1. A … 4. A 5. A 6. B …` then `1. follow the source 2. later 3. do what you recommend`, then `a`.

| # | Decision |
|---|---|
| Split | M13 split into sub-milestones (13.0a … 13.10), each green + committed. |
| Campaign | **Follow the source: 182 chapters × 10 stages** (1,820 stages), 60 gym gates at 3-1, 6-1 … 180-1. Gym fights now; full Victory Road layer (tasks/badges/commission) in M14 (option A). |
| Gates | Two classes. **A** = campaign stage + player level. **B** = server-day gates, *only* for Gods Trials, Joint Battle, Relic Battlefield and Hoopa's Vault. |
| Island | Full simulated 5v5 alliance contest with bot alliances. |
| Rift | Two steps: Barriers + Merchant, then Ring Battle + Quiz. |
| Content volume | **6B — match the source counts** (1,800 Sky stages, 3,000 Faction floors, 244 runes, 135 hires…) with our own names/numbers. No copied rows. |
| Paid | Removed — see [free-to-play](free-to-play.md). |
| Gods Trials | Parked — see [M12/Gods](m12-artifacts-deferred.md). |

## Gate table

| Mode | Gate | Type |
|---|---|---|
| [Pet Home](../systems/pet-home.md) | Clear 1-10 | A |
| [Sky Pillar](../systems/sky-pillar.md) | Clear 7-1 | A |
| [Misty Woods](../systems/misty-woods.md) | Clear 3-10 | A |
| [Rift Arena](../systems/rift-arena.md) | Clear 10-10 + Lv10 | A |
| [Faction Tower](../systems/faction-tower.md) | Clear 28-10 | A |
| [Island Challenge](../systems/island-challenge.md) | Clear 3-10 + Lv10 | A |
| [Ultra Wormhole](../systems/ultra-wormhole.md) | Clear 10-10 + Lv50 | A |
| [Hoopa's Vault](../systems/hoopa-vault.md) | Server day 15 | B |
| [Gods Trials](../systems/gods-trials.md) | Server day 29 + Lv45 | B (later) |
| Joint Battle | Server day 60 + Lv45 | B (M14) |
| Relic Battlefield | First merge + Lv45 | merge (M16) |

"Server day" counts from the saved `serverEpoch` (day 1 = account creation); the debug fast-forward
moves the clock. Gate values live in `packages/content/tuning/explore.json`.

Related: [campaign](../systems/campaign.md), [explore hub](../systems/explore-hub.md), [M13](../milestones/m13.md).
