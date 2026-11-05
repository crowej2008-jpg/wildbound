# Misty Woods (M13.6)

The source's maze (`maze_*`, modes2_cfg 2026-10-02) via `scripts/import-misty.mjs`. Opens after story 3-10;
chapter 4 needs story 20-10 (`lv4_condition` 102010). Route: `/explore/misty-woods`. Squad: `misty`.

## Rules (built)
- **Map:** 4 chapters × 11 floors, the source's 96 nodes and links. A node with several possible kinds gets one
  rolled per cycle. The team steps from its node to a linked one.
- **Carry-over:** HP and Rage carry between fights; a knocked-out Pokémon stays down until revived. A lost fight
  can be retried with the rest; the team stays put.
- **Tiles** (source ids; reading): 1 fight, 2 boss (floor 11), 3 start, 4 tombstone (revives the first fallen at
  50 % HP), 5 fountain (heals everyone 30 % of max HP), 6 hire (pick 1 of 3 Supreme / Mythic helpers you do not own;
  they join at your team's average level and stars and fill empty slots), 7 Diamond shop (heal everyone 50, revive
  one 100). Ids 4 / 5 / 7 are matched by elimination; 6 sits on the source's `is_spe_hero` floors.
- **Enemies:** six at the team's average level, stats × the floor's `rate` % (30 → 195; reading).
- **Pay:** each floor's first win pays its Forest Coins (100 → 640) and 10 Diamonds on each boss (source).
- **Reset:** every 2 days (UTC midnights from the epoch); everything resets.

## Cut / not copied
Runes (`maze_rune_json`, 244) — cut by the owner (2026-11-04: "get rid of the runes but do the rest").
`reward_rate` (Gold / XP Candy figures per floor) is not copied (meaning unclear).

## Stand-ins
Fountain heal, revive HP, shop prices, the enemy curve, the hire pool.
