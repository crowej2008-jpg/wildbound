---
title: Summoning (gacha) and shops
type: system
milestone: M6
status: built
updated: 2026-10-31
sources: [docs/design/gacha.md, docs/design/shops.md, docs/CHANGELOG.md M6]
---

# Summoning (gacha) and shops (M6)

## Summon
- Two machines (Common, Premium). Cost order for a single draw: **free draw → ticket → gems**;
  ten-draw uses 10 tickets, then gems. Free-draw cooldown per machine (5 min Common / 1,440 min Premium).
- Ten-draw guarantees one Rare-or-better. **Pity:** Legendary+ forced at 1,000 Premium credits; box claims.
- **Wish:** species-level, ×`wishBoost` inside its tier; unlocked from the start.
- Duplicates grant fresh Wilds (no shard conversion) — they're now [Potential](collection-layers.md#potential) fodder.

## Shops
- Six shops with restock schedules (daily hours / interval days / manual), buy limits, one-time items,
  manual refresh counters. VIP gives a shop discount.

Content: `tuning/gacha.json`, `shops/*.json`. Engine: `engine/src/gacha/`, `engine/src/shop/`.
