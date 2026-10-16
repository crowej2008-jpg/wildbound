# Summoning (gacha) — M6

Read before editing `packages/engine/src/gacha`, the summoning logic in `packages/server`, the
`packages/content/tuning/gacha.json` table, or the client's Summon screen.

Covers PROMPT §7.5 (summoning), §8 (Summon screen), §13 (M6). Reference read:
`reference/game-rebuild/kb/gacha.md` (shapes only; every number here is our own).

## Goal

Two deterministic, seeded summoning machines with **exact** pity and guarantee rules, real
probabilities shown in the UI, a featured-target *wish*, a per-machine credit box, history, and a
draw animation.

## Two machines (PROMPT §7.5)

| | Common | Premium |
|---|---|---|
| Ticket | `ticketCommon` ×1 (×10 for a ten-draw) | `ticketPremium` ×1 (×10) |
| Gem fallback | none | 180 a draw / 1,620 a ten-draw |
| Free draws | 5 a day (5 min cooldown) | 1 a day (24 h cooldown) |
| Credits per draw | 1 | 20 |
| Credit box | every 100 credits | every 20 draws (400 credits) |
| Pity | — | 1,000 credits ⇒ guaranteed Legendary+ |
| Wish | no | yes |
| Ten-draw guarantee | one Rare-or-better | one Rare-or-better |

Price rule: a **single** draw spends a free draw while one is left and off cooldown, else a ticket,
else gems (Premium only). A **ten-draw** spends 10 tickets, else gems (Premium only). This is decided
on the server; the client only asks for a machine and a count.

### Credits, boxes and pity

Every draw adds `creditPerDraw` to the machine's `boxCredits`. A box is claimable while
`boxCredits ≥ boxCreditsNeeded`; claiming spends exactly that many credits and grants the machine's
box reward, and repeats. The Premium machine also adds `creditPerDraw` to `pityCredits`; when that
reaches `pityThreshold` (1,000) the draw itself is forced to **Legendary-or-better** and `pityCredits`
resets to 0. Any *natural* Legendary-or-better draw also resets `pityCredits` to 0.

This follows PROMPT §7.5's literal numbers. The reference audit describes the same feature as a
"+1 box credit per draw" with a separate "VIP credit" of 20 (see `docs/ASSUMPTIONS.md`); we keep the
master prompt's numbers and note the difference.

## Rates (our own numbers)

Rates live in `packages/content/tuning/gacha.json` as per-**tier** weights. Within a tier every Wild
of that tier is equally likely, except a wished Wild, whose weight is multiplied by `wishBoost`.

Tier order (`common < rare < epic < legendary < supreme < mythic`) drives the guarantees. The pool is
built from the content species and their tiers, so the real per-species probability is
`tierWeight / totalWeight / tierCount`. The UI prints exactly that.

## Pool & duplicates

A draw grants a fresh `WildInstance` (level 1, 1★, stage 0) exactly like the debug `grantWild`, so a
duplicate species becomes a second instance. A result is marked **new** when the species was not in the
roster before the draw. (The reference converts duplicates to shards; we allow duplicate instances and
note it in `docs/ASSUMPTIONS.md` — shard conversion can arrive with the equipment layers.)

## Wish

The Premium machine stores one `wishedSpeciesId` (or none). It is applied inside its tier only: if the
rolled tier contains the wished species, that species' weight is `wishBoost` instead of 1. PROMPT
describes a *Wild* target; the reference targets a *faction* — we implement the prompt's Wild target.

## State & determinism

`AccountState.gacha` (save v3) holds per-machine `{ freeRemaining, nextFreeAt, boxCredits, pityCredits,
lifetimeDraws }`, the wish, the UTC day key for the free-draw refill, and a 50-entry history. All
randomness flows through an injected `Rng`; `summon(machine, count, seed?)` uses `mulberry32(seed)`
when a seed is given, else the server's stream, so tests can pin outcomes.

## Server methods

| Method | Effect |
|---|---|
| `summon(machine, count, seed?)` | Validate cost, spend free draws/tickets/gems, roll, grant instances, update credits/history |
| `claimGachaBox(machine)` | Spend `boxCreditsNeeded` credits, grant the box reward (repeatable) |
| `setWish(speciesId \| null)` | Set/clear the Premium wish |

## Done criterion (M6)

Unit tests prove: pity fires at the exact credit count; the ten-draw guarantee always yields a
Rare-or-better; credits/box accounting adds correctly; the cost fallback (free → ticket → gems) is
exact; and a seeded draw set is reproducible.
