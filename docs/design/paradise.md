# Pokémon Paradise (M14.3)

`scripts/import-paradise.mjs` → `packages/content/tuning/paradise.json`, from the source's poke_catching tables
(modes_cfg 2026-10-02) and the owner's wiki page (game-modes/pokemon-paradise). Opens after story 2-5 (sys_open 105).
Route: `/paradise` (Combat hub).

## Built
- **Parks:** 3 seasons rotate every 14 days. A new Park resets gear, the Dex, Paradise Points, Exploration EXP and the
  shop; Advanced / Master Balls and Scanners carry over.
- **Stamina:** 10, up to 20 with the Energy Drink; refills at the daily reset. Exploring costs 1 (the Energy Drink
  gives a 5–20 % chance it is free) and pays 30 Exploration EXP.
- **Routes:** exploring picks a pool by weight (pools need their scene open), an entry in it (the Small Radar's 10–18 %
  chance favours an entry not logged yet), and a landing step by the entry's weights: Trace → Footprint → Drop item →
  Pokémon. Tracking moves one step (20 % base, up to 35 % with the Radar; a Scanner makes it sure); a miss ends the
  route. Each step reached is logged in the Dex once (its stars and Paradise Points).
- **Catching:** at the Pokémon step a ball is thrown — Poké Ball (unlimited, the entry's rate 5–50 %), Advanced Ball
  (×1.5), Master Ball (sure); the Sports Gloves multiply the Poké / Advanced rate up to ×1.8 and may keep an Advanced
  Ball. A catch adds the Pokémon at its card's star and logs it; a miss lets it flee and leaves 5 of its shards.
- **Gear:** Energy Drink, Small Radar, Sports Gloves, Lv 0–20, paid in Exploration EXP; scenes open when all gear
  reaches Lv 5 / 10 / 15.
- **Dex stars** (147 per Park) pay the source milestones. **Shop:** the source rows for Paradise Points or EXP, with
  per-Park limits and gear-level gates.

## Readings / not copied
A missed throw lets the Pokémon flee (one throw per Pokémon); a failed track ends the route. Category-complete
cosmetics, Golden Egg Vouchers, the leaderboard and the paid Paradise Pass are not copied.
