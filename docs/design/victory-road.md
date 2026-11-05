# Victory Road (M14.1)

`scripts/import-victory-road.mjs` → `packages/content/tuning/victory-road.json`, from `champion_road_area_json`,
`champion_road_chapter_json` and `champion_road_chapter_progress_json` (modepages-pvp_cfg 2026-10-03) plus the retired
`dun_champion_task_json` (the only gym tasks in the dumps). Route: `/victory-road` (linked from the campaign).

## Built
- 8 regions (Kanto … Galar), 60 gyms = the story gates built in 13.0a (gym N gates chapter 3N-1).
- **Progress** (reading): 30 when the gym is reached (the stage before its gate is cleared), 60 when its task is done,
  100 when it is beaten. The gym fight itself stays open from 30 (as in 13.0a), so untracked tasks never block the story.
- **Chests** at 30 / 60 / 100 (source rewards: Diamonds, Resonation Shards, Trainer title cards), each once.
- **Gym task** (one per gym, retired table): pays 300 / 500 Diamonds once. Tracked: trainer level, story stage, Tower
  floor, gyms, Pokémon levels / stars, plates, trinkets, berry stars, orb levels, Faction Tower floor, Misty Woods.
  Not tracked yet (count as done): Premium Gacha count, Arena / Ranked plays, guild, gold dungeon, Megastar fights
  (King's Trial), red 3-star gear.
- **Badges** (one per beaten gym) with the source privileges:
  - AFK Profit +3 … 35 % — the best badge counts, on every idle line.
  - Class / faction battle stats (+3 % HP, P.ATK or S.ATK) — they stack, on matching Pokémon.
  - Faction Tower coins +10 / 20 %, Misty Woods coins +10 %, Sky Pillar Potential Shards +10 % (challenge / sweep) —
    the best of each.
  - Daily Diamonds: the top badge's 100 … 200 a day.
- Not wired yet: Arena / Ranked token bonuses, ladder-coin bonus, shop unlocks (PvP, Forest, Ladder, League Rank
  shops; Rift shop goods) — their modes' parts come later.
