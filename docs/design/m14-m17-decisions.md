# M14–M17 run: decisions taken without the owner (2026-11-05)

Owner, 2026-11-05: *"do m14 to 17 then stop … if you need me to pick a decision pick the recommended option and put all
that was worked on and what decisions after you are done"*. Every call below took the recommended option.

## M14.4 Joint Team + Wild Area
- Played solo: CPU teammates, rival squads, duel players; deterministic CPU ladders for season ranks (as for the Rift).
- Not copied: assist / borrowed Pokémon, level sync, chat tasks, the paid Squad Battle Pass, PvP marks / shields.
- Shop shelves gated by total squad-skill levels (60 / 80) instead of team level 6 / 8 (no team levels solo).
- Squad-skill values and costs, CPU teammate points, Wild Area fight strengths and zone drop amounts are stand-ins.
- Event weights from the source table (equal), not the wiki's observed odds.

## M14.5 Clash of Isles
- Solo against CPU guilds; CPU guilds do not raid the island you hold (no raids simulated).
- Left out: Assist Points / cheers, shield buying, robbing other players' islands, Season Weather, 2–3 team garrisons.
- One island held at a time; tokens paid on collect / switch / daily roll. Garrison strength is a stand-in.

## M14 close-out
- Shovel Carnival moved to M16 (owner). M14 = Victory Road, King's Trial, Paradise, Joint Team + Wild Area, Clash of
  Isles. Leaderboards everywhere use deterministic CPU ladders until the server work.

## M15 Account systems III
- Treasure level cost is a stand-in (10 + 5 × level Treasure Liquid; trainer_treasure_lev is not in the dumps).
- Treasure battle skills, Pure Crystal skills and fusion-skin battle skills are not built; only their stat parts count.
- Skin stats apply whether or not the skin is worn (as the source's collection bonus); wearing is cosmetic.
- Materials (liquid, accessories, refine, awaken stones, essences, vouchers, skin shards) come from the debug grant
  until M16 events hand them out.
- Awakening tasks counted: premium draws and egg smashes; other task kinds are listed but do not advance yet.
- Pure Crystal attribute ids 125 / 126 (no matching stat in the engine) are skipped.
