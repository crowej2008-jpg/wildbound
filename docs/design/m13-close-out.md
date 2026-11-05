# M13 close-out (13.10, 2026-11-05)

Every Explore mode is live, gated, and loads through the server boundary (`packages/server/src/m13-close-out.test.ts`)
and from the hub in the browser (`tests/e2e/m13-close-out.spec.ts`); each has its own e2e spec too.

| Mode | Gate | Reset | Pays | Copy / own | Stand-ins and open items |
|---|---|---|---|---|---|
| Hoopa's Vault | server day 15 | daily keys | held items, orbs, bags | source | orb colours as built (owner) |
| Rift Arena | 10-10 + Lv10 | weekly season, daily lives | Time Coins, milestones, Merchant | source + owner purpose | difficulty, level sync; leaderboard later |
| Sky Pillar | 7-1 | permanent | Potential Shards, chests | source | — |
| Faction Tower | 28-10 | daily | Gold, Star Shards, Faction Coins, milestones | source + owner wiki | 5-floor bonus curve, enemy curve; leaderboards later |
| Misty Woods | 3-10 | every 2 days | Forest Coins, Diamonds | source (runes cut) | fountain / revive / shop numbers, hire pool |
| Pet Home | 1-10 | daily | Home Coins, orbs, chests | source | income step 5 s (reading) |
| Berry Grove | 3-10 + Lv10 | daily fights | berries, seeds, Mulch, Essence, Potions | owner's own | every number |
| Dig Site | 10-10 + Lv50 | none (unlimited) | soul hearts, Soul-heart EXP, museum stats | owner's own | every number |

Fixed in the close-out: the hub's Misty Woods countdown now follows its 2-day cycle (it showed the daily reset).

Deferred by the owner: every mode's difficulty curve (after M20, `wiki/decisions/difficulty-curves-at-the-end.md`);
leaderboards and ranked rewards wait for the server parts / scaling CPUs.
