---
title: Summoning (gacha) and shops
type: system
milestone: M6, R9
status: built
updated: 2026-11-04
sources: [docs/design/gacha.md, docs/design/shops.md, docs/ASSUMPTIONS.md #83, reference/game-rebuild/kb/gacha.md]
---

# Summoning (gacha) and shops

## Summon (R9, copied from the source — 2026-11-04, save v38)
- **Common Gacha:** C.Gacha Voucher ×1 / ×10, no gem price; 5 free draws a day on a 5-minute timer; 30 pool rows
  (about 87 % "Other" 1★–3★ Pokémon, 13 % 5★ Epics).
- **Premium Gacha:** Premium GV ×1 / ×10 or 180 / 1,620 gems; ×20 … ×50 on tickets only (size is a stand-in,
  ASSUMPTIONS #83); 1 free draw a day on a 24-hour timer; 116 rows (Legendary + Supreme + Mythic together 0.58 %).
- Price pick: free → ticket → gems. The daily refill keeps the running free-draw timer.
- Odds are the ones the source **shows** (`fake_weight`). A draw gives the Pokémon at the row's star. No pity, no
  ten-draw guarantee (the source has neither). Duplicates are fresh copies.
- **Credit boxes** (repeat): Common 100 credits → 5-Star Pokémon Shard ×50; Premium 20 → Selectable Precious Shard ×5.
- **Wishing Well:** after 200 Premium draws pick Water / Fire / Grass; that faction's Legendaries × 1.8.
- **Supreme Gift:** VIP credits (+20 Premium, +1 Common a draw); 1,000 open one of 27 Legendary / Supreme Pokémon,
  from VIP 14.
- Not copied: the Supreme Gacha (off in the source), event gachas (M15), the full-bag refusal.

## Shops (M6 — R9 re-copy pending)
- Six shops with restock schedules (daily hours / interval days / manual), buy limits, one-time items,
  manual refresh counters. VIP gives a shop discount.

Content: `tuning/gacha.json` (`scripts/import-gacha.mjs`), `shops/*.json`. Engine: `engine/src/gacha/`,
`engine/src/shop/`. Server: `server/src/gacha.ts`.
