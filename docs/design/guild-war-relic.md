# Guild War + Relic Battlefield (M17)

Tuning: `scripts/import-guild-war-relic.mjs` → `packages/content/tuning/guild-war-relic.json`. Both need the M16 guild
and open from the Guild page.

## Guild War (`/guild-war`, squad `guildWar`)
- Weekly season (ISO week). Five bosses; each has 5 rounds of HP per difficulty; when every boss has lost all 5
  rounds the next of 15 difficulties opens; after 15 comes the endless stage (damage only).
- Attempts: one per daily activity mark reached (30 / 60 / 100 activity points).
- A challenge is one battle against the boss; all damage counts. Every battle pays 300 Guild Tokens (6 Guild
  Chests), each kill 100 more.
- CPU members deal 12,000,000 damage a day, spread over the bosses (stand-in).
- Rewards: yesterday's rank among the guild (daily table), last season's personal rank and guild rank.

## Relic Battlefield (`/relic-battlefield`, squad `relic`)
- Season: Tuesday 09:00 → Sunday 22:00 UTC. Map 1 of the source (91 grids).
- You start on grid 1; three CPU guilds start on 6, 86 and 91 and spread 2 grids a season day.
- Attack (10 stamina) a grid next to one you hold; neutral grids fall after ⌈garrison ÷ 3⌉ wins, CPU grids after 3.
  Hold at most 12 (release one to free a slot). Each held grid scores every 30 minutes (10–50 points).
- Explore (5 stamina, 2 min cooldown): the source's live events — lose 10–20 % condition, heal 30–50 %, or +4 / +5
  stamina. Condition scales your team's HP in attacks.
- 13 tasks (stamina spent, explores, wins, grids taken by tier, the core relic) pay Relic Coins.
- Standings: your guild score against the CPU guilds; last season's place pays Relic Coins and Gems.

Stand-ins and gaps: ASSUMPTIONS #115 and docs/design/m14-m17-decisions.md.
