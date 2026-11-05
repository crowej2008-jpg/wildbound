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
- Awakening tasks counted: premium draws, egg smashes and Origin shards spent (composing or Origin skill levels —
  added in the follow-up). Light / Dark themed draws and ancient-artifact quenching still do not advance: Wildbound has
  neither system.
- Pure Crystal attribute ids 125 / 126 (no matching stat in the engine) are skipped.

## M16 Guild, merge and events
- Guild played solo: you join a ready-made CPU guild for free (no creation cost / VIP gate); 24 CPU members add daily
  EXP and funds; no chat, ranks, applications or authority roles.
- Red packets: the player keeps one share of each packet they unlock (gems ÷ shares); CPU packets are not simulated.
- Guild beast privileges (idle bonus, park stamina, boss damage…) are listed in the source but not applied — they
  belong to modes that are M17 or not built.
- No real server merges solo. The Merge Event runs on a stand-in schedule (server day 30, then every 60 days): four
  one-day phases where you contribute that phase's material for points ranked against a CPU ladder; rank rewards are
  stand-ins (Gems + Z Ring / crystal essence, giving M15 materials a source).
- Shovel Carnival from the owner's wiki: starts server day 8, every 14 days, 4 days. The twelve non-pool wheel
  segments share 96.35 % equally. Stand-in prize mappings: Red Soul Heart Chest → 800 Soul Heart EXP, C.Gacha Voucher →
  Common tickets, Level 7 Ruby Orb → 2,000 Orb Essence, the accessory / gear / evolve picks in the Happy Exchange →
  M15 treasure materials and Golden Egg Vouchers. The Mecha (armor device) shop is not built. Unused shovels and Treasure
  Pieces carry over; the Happy Exchange stays open between carnivals.
- Other events on the owner's wiki (Weekend Bash: Elven Treasure and Bingo, Flower Event, Ruins Adventure) are not
  built: no source tables and only short wiki summaries.

## M17 Guild War + Relic Battlefield
- The roadmap said "needs M12" (the cross-server backend, still skipped). Recommended option taken: build both solo
  against CPU guilds and CPU ladders now, like Clash of Isles; real cross-server play waits for M20 (backend).
- Guild War: boss round HP (2,000,000 × 1.6 per difficulty) and CPU members' damage (12,000,000 a day) are stand-ins;
  bosses are picked from the tower enemy pool. Guild Chest = 50 Guild Tokens. Titles (Expert / Monster Hunter, Ultimate
  Guild, Power of Unity) are not granted. Not built: assist Pokémon, level sync, the last-hit bonus battle.
- Relic Battlefield: map 1 only; your base is grid 1, CPU guilds start at 6, 86 and 91 and grow 2 grids a season day
  (up to 12); they never retake your grids. Neutral grids need ⌈garrison ÷ 3⌉ wins, CPU grids 3 (their guard teams).
  Explore events change a single "team condition" (HP %) instead of per-team HP; no revives. Season place rewards
  (Relic Coins + Gems) are stand-ins. Relic items 26001–26004 / 72011 pay Relic Coins, which have no shop yet.
- Pokémon Park (beast park) is not in this run: it was not on the M17 line of the roadmap.

## Follow-up (owner: "finish these if you can")
- Relic Coins: a Relic Battlefield shop (stand-in rows: Gold, Ascension Stones, M15 materials, 5★ shards, Premium
  tickets) — the source has no relic shop table.
- Guild War season: the guild ranks now give the Ultimate Guild (1st) / Power of Unity (2nd–10th) title cards from
  titles.json. Expert / Monster Hunter (personal) have no data in the dumps and stay out.
- Pokémon Park (built in the follow-up): kept the source's real-time windows (open 09:00–21:00 UTC, boss at 12:15 /
  19:15 UTC — 07:15 / 14:15 Toronto). HP is not tracked per Pokémon: a loss faints the whole fielded team for the day.
  Egg snatching is reduced to "the last hit takes the egg"; CPU players hit the boss at a steady rate (stand-in).
