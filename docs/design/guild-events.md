# Guild, merge and events (M16)

## Guild (`/guild`)
Source: modepages-guild_cfg `guild_*` via `scripts/import-guild-events.mjs` → `tuning/guild-events.json`.
- Join the CPU guild "Wildbound Rangers" (free). 24 CPU members add daily EXP and funds (`rollGuild`).
- Donations: 5 a day — 60,000 Gold (40 Guild Tokens, 10 EXP, 10,000 funds) or 10 Gems (200, 30, 20,000).
  Each donation counts for the daily quest.
- Guild levels 1–16 from EXP (members 30–36, display only).
- Red packets at trainer levels 10, 30, 50, 70, 90, 110: one share each.
- Guild beast: Flat Candy (10 / 50 EXP, 2 / 10 Guild Tokens each); 100 levels; its stat lines join the account-wide
  battle fold (`guildLines`).

## Events (`/events`)
Clock: the account's server day (`serverEpoch`).
- **Shovel Carnival**: days 8–11, then every 14 days. Treasure Shovels spin the wheel (×1 / ×10); the Gems pool starts
  at 16,000, +20 a draw, the 5 / 8 / 10 / 20 % segments pay that share and never take it below 16,000. 10 Credits a
  shovel; 18 milestones; Gems shovel shop (5 tiers, daily stock); Happy Exchange for Treasure Pieces.
- **Merge Event**: day 30, then every 60 days; one phase a day (Berry, Orb, Soul Heart, Treasure). Contribute the
  phase's material (10 : 1 point; Treasure Liquid 1 : 1); rank against a 100-entry CPU ladder; claim the tier reward
  once the phase ends.

Stand-ins and gaps: ASSUMPTIONS #114 and docs/design/m14-m17-decisions.md.
