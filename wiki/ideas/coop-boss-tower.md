---
title: Co-op boss rush tower (idea)
type: idea
status: designed in chat; not in the roadmap or repo
updated: 2026-10-31
sources: [Claude chats with the owner, Oct 2026]
---

# Co-op boss rush tower (idea)

Designed by Jayden in Claude chats; **not yet in SCOPE.md or any milestone**. Needs the
[backend](../systems/backend.md) for real two-player play. Likely home: M14 (combat/co-op modes).

## Shape
- **Pairs:** 2 players form a party; each picks **3 Pokémon**; the six combine into one team; both
  watch the same battle. Partners can't pick duplicates. Max two accounts per person.
- Pick partner **and** the 3 Pokémon on **Monday**; locked to that partner for the week. Either
  player can leave and re-pair until the pair's first run. Only one partner needs to be online.
- **Tower:** the same **300 floors** every week, **5 stages per floor**. Every enemy team is a boss
  team with huge stats — a strategy *and* stat check; micro stat changes should matter at high floors.
  Very little randomness.
- Bosses scale with the **highest resonance** on the team (earlier idea: average of both players').
- Floors 100, 200, 300 hand-crafted; other boss gimmicks built from existing mechanics.
- **Entry:** 25 total awakened levels on each account.
- **Tries:** 5 per pair per week. A wipe uses a try; the next try resumes where they left off. Between
  tries, unlimited **build** changes on the already-picked Pokémon (applied at next try start).
- **Weekly ban list (3 mons):** 2 random + the previous week's most-used (all tied mons banned). Nothing
  banned in week one; no mon banned two weeks running; reroll a random pick that hits the most-used.
- Resets at the end-of-week reset.

## Rewards
- **Leaderboard of pairs:** tie-break highest floor → fewest tries → earliest. Top pair: **5k diamonds
  + a special title**, both partners get the full prize.
- **Every stage cleared:** 50k gold + one random of: 50 optional 5★ shards, or 5 Resetter Shards.
- **Every 100 floors:** one random of: Lv7 orb; one mythic held item of choice (usable only when
  Hoopa stage > 181); an artifact selection box (one of 50 mythic artifacts, 1,000 breakthrough stones,
  20k relic tablets, 10k quenching hammers, 5 quenching blueprints); 10 optional future devices.

## Dependencies
Resonance ✔ (M11), [held items](../systems/held-items.md) ✔, Resetter Shards (13.3), artifacts
(deferred M12), awakening levels (not in the game yet), titles ✔, backend (M19).
