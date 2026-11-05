# Rift Arena (M13.4 / 13.5)

The source's New Rift Arena (`underground_new_*`). Opens after story 10-10 and trainer level 10.
Route: `/explore/rift-arena`. Server-wide parts wait for the backend
([decision](../../wiki/decisions/rift-server-parts-later.md)).

## Rift Barriers (built, 13.4 part 1)
- **Season:** Tuesday 07:00 → Sunday 22:00 UTC (source `open_time` / `end_time`). Closed otherwise.
- **Difficulty 1–10** is locked at the season's first visit from the account's resonance; the fielded team
  fights at most at that difficulty's synced level (own squad: `rift`).
- **Floors:** 250 — Easy 1–100, then Advanced 101–250; a boss every 5th floor (enemies ×1.5).
- **Lives:** 5 a UTC day; a lost challenge costs one.
- **Drops:** Advanced floors 50 Time Coins, 250 on a boss floor (source). Easy floors drop Time Credits, Time Coins,
  Gold and XP Candies (the source lists those kinds; amounts are stand-ins). Easy floor rewards at 20 / 40 / 60 /
  80 / 100 by difficulty (Gold + XP Candies, source).
- **Challenge chests** at 3 / 10 / 20 / 30 challenges (wins and losses; source). The 6 / 15 / 25 chests hold only
  Lucky Coins and 4-star Evo Boxes, which Wildbound lacks, and are left out.
- **Season end:** leftover Time Coins become Gold at the source's ratio (100 each, read as Gold per coin); Time
  Credits are taken back.

## Stand-ins
Which resonance reaches which difficulty (0, then 100, 150 … 500), the synced level (100 + 25 per difficulty, and
only down-syncing for now), Easy drop amounts, the enemies.

## Not built yet
- 13.4 part 2: hiring (1 free a season), season bans, Time Credit equipment upgrades
  (`underground_new_develop_json`), the Mystic Merchant (only its 6 orb-box rows are in the dumps).
- Server-wide (backend): the Advanced ranking and its rewards, the Easy track's weakness.
- 13.5: Ring Battle ranks and Predictions.
