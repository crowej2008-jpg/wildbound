# Summoning (gacha) — R9, copied from the source

Read before editing `packages/engine/src/gacha`, `packages/server/src/gacha.ts`,
`packages/content/tuning/gacha.json` (written by `scripts/import-gacha.mjs`) or the Summon screen.
Replaces the M6 design (pity, ten-draw guarantee, species wish, tier rates — none of them are in
the source). Source: `chest_basic_json`, `chest_reward_json`, `chest_score_json`, `item_hero_json`
10502, `vip_priv_json` chest_score; rules the tables leave out from `kb/gacha.md` (journal-checked
2026-10-04). Readings: ASSUMPTIONS #83.

## Two gachas

| | Common Gacha (chest 1) | Premium Gacha (chest 2) |
|---|---|---|
| Ticket | C.Gacha Voucher (`ticketCommon`) ×1 / ×10 | Premium GV (`ticketPremium`) ×1 / ×10 |
| Gems | none | 180 a draw / 1,620 a ten-draw |
| Multi-draw | ×10 | ×10, and ×20 … ×50 on tickets only (the "plus" multi) |
| Free draws | 5 a day, 5-minute timer | 1 a day, 24-hour timer |
| Box credits | 1 a draw; 100 → 5-Star Pokémon Shard ×50 | 1 a draw; 20 → Selectable Precious Shard ×5 |
| VIP credits | +1 a draw | +20 a draw |
| Pool | 30 rows | 116 rows |

Price pick (the source client's own): a single draw takes a free draw while one is left and its
timer has run, else a ticket, else gems; a ten-draw takes 10 tickets, else gems. The daily reset
refills the free draws but **keeps the running timer**, so a late free Premium draw can cost a day.
Boxes repeat; a claim spends the box's credits.

## Pools and odds

Each pool row is a Pokémon at a star (the source's card id: hero × 10,000 + form × 100 + star) with a
weight in parts per million and a display group (Other / Epic / Legendary / Supreme / Mythic). A draw
picks one row by weight and grants that Pokémon **at the row's star** (a 1★ Caterpie, a 4★
Poliwhirl, a 5★ Lugia). The weights are the odds the source *shows* (`fake_weight`); its server's own
odds are not in the dumps, so Wildbound uses the shown ones. The rates sheet lists every row and the
group totals. No pity and no ten-draw guarantee — the source has neither.

## Wishing Well (Premium)

Unlocks after 200 Premium draws in total. The player picks Water, Fire or Grass (or none); that
faction's Legendary rows weigh × 1.8 (+80 %). Light and Dark Legendaries are not affected (and
none are in the Premium pool).

## Supreme Gift (VIP credit box)

Every draw adds VIP credits (Premium 20, Common 1), account-wide. 1,000 open a Supreme Gift from VIP
14 (`vip_priv` chest_score; the box's own text says "SVIP15" — the client's gate is used): one of 27
Legendary and Supreme Pokémon at equal weight, at its first star. Repeats.

## Not copied

- The Supreme Gacha (chest 5) — off in the source (no VIP level opens it).
- Event gachas (themed pools, their own tickets) — events arrive with M16.
- The full-bag refusal (result 415) — the Pokémon bag is not built yet.

## State (save v38)

`AccountState.gacha`: `{ day, machines: { common, premium: { freeRemaining, nextFreeAt, boxCredits,
lifetimeDraws } }, vipCredits, wishFaction, history[50] }`; history rows carry the star and the source
(`common` / `premium` / `supremeGift`).

## Server methods

| Method | Effect |
|---|---|
| `summon(machine, count, seed?)` | Price, spend, draw, grant at the drawn star, add box and VIP credits |
| `claimGachaBox(machine)` | Spend the box's credits, grant its reward (repeatable) |
| `setWishFaction(faction \| null)` | Set or clear the Wishing Well (unlocked, Water / Fire / Grass) |
| `openSupremeGift(seed?)` | VIP 14+ and 1,000 VIP credits → one Legendary / Supreme Pokémon |
| `getGacha()` | View: machines, rates, Wishing Well, Supreme Gift, history |
