# Joint Team (M14.4): Joint Team Battles + the Wild Area (Joint Team Dynamax)

`scripts/import-joint-team.mjs` → `packages/content/tuning/joint-team.json`, from cross_joint_team_* (modes_cfg) and
cross_giant_battle_* (modes2_cfg) plus the owner's wiki pages. Route: `/joint-team` (Combat hub). Squad: `jointTeam`.
Gate: server day 15 and trainer level 45 (source). Played solo: teammates, rival squads and duel players are CPUs.

## Joint Team Battles
- Weekly season; Monday is matchmaking, battles Tuesday–Sunday. 3 free challenges a day (Joint Challenge Tickets add
  more), 3 free rival refreshes. Three CPU rival squads at ×0.85 / ×1 / ×1.2 your team's strength.
- A challenge scores 60 Team Points win or lose, a win more against a stronger squad (source 60 + up to 30); each pays
  50 Core Skill Stones (source).
- Personal milestones by battles fought (1–35) and squad milestones by squad points (100–10,000) pay Squad Exchange
  Coins and Core Skill Stones (source). The two CPU teammates add 150 squad points per battle you fight (stand-in).
- Season rank among 50 CPU squads (deterministic ladder); last season's rank reward is claimed the next week (wiki).
- Shop (source rows, Squad Exchange Coins); shelves 2 / 3 open at 60 / 80 total squad-skill levels (stand-in for
  team level 6 / 8). Squad skills: HP, P.ATK, S.ATK, Crit, Crit Res, Guard Break, Block, DMG Boost, DMG Reduction,
  Lv 0–120, paid in Core Skill Stones (20 + 4 / level); permanent account-wide lines (stand-in values).
- Not copied: assist / borrowed Pokémon, level sync, chat tasks, the paid Squad Battle Pass.

## Wild Area (Joint Team Dynamax)
- Open Tuesday–Sunday 10:00–22:00 UTC (source open_time / open_days). Energy 120, +1 every 90 s, full each day; Energy
  Canisters +15. Zones Outer / Middle / Inner cost 2 / 3 / 4 energy × the multiplier.
- Events (source weights): Pokémon group (5 pts), Dynamax group (10), Ultra Dynamax group (Inner, 10), treasure chest
  (5), capture guess (5 / 10 if right), rival trainer duel (Inner, 10 + Team Badges). Fights are against generated
  teams scaled by event and zone; points × the multiplier on a win; a loss refunds all but the base cost.
- Advance by beating Dynamax Moltres twice (Outer) and Dynamax Rayquaza twice (Middle) — guaranteed by the 5th / 10th
  explore — or with 1 / 2 Teleporters. Reaching Inner pays 2 Team Badges.
- Multipliers ×1–×100 unlock by energy spent this season (20 / 90 / 300 / 2,000 / 4,000). Drops by zone: Berry
  Essence, Reforge Potions, Teleporters, Dynamax Fragments (season-long HP / ATK boosts in the Wild Area).
- Season rank among 50 CPU players; last season's rank reward claimed the next week.
- Not copied: marks / shields, Treasure Finder Parts, Shiny Fragments, orb / berry boxes (listed as notCopied).
