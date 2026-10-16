# Shops and currency sinks — M6

Read before editing `packages/engine/src/shop`, the shop logic in `packages/server`, the
`packages/content/shops/*.json` tables, or the client's Shop screen.

Covers PROMPT §7.4 (economy), §7.9 (shops & restock), §8 (Shop screen), §13 (M6). Reference read:
`reference/game-rebuild/kb/shop.md` (shapes only; every price here is our own).

## Currencies (PROMPT §7.4)

`CurrencyId` grows from the five M3 currencies to the full economy shape:

- **Core** (M3): `gold`, `gems`, `candy`, `shard`, `stone`.
- **Summon** (M6): `ticketCommon`, `ticketPremium`.
- **Per-mode / shop tokens** (M6 shape, sources land later): `arenaToken`, `guildCoin`, `homeCoin`,
  `forestCoin`, `islandCoin`, `wildCoin`.

The HUD shows the seven *primary* currencies (`HUD_CURRENCY_IDS`); the rest appear on the screen that
uses them. Every currency is a `Rewards` key, so any reward bundle (stage, mail, box, quest) can pay it.

## Restock schedule (PROMPT §7.9, reference shop_basic)

| Shop | Currency | Restock |
|---|---|---|
| Daily | `gems` | every day at 00:00, 12:00, 18:00 UTC |
| Forest | `forestCoin` | daily at 00:00 UTC |
| Island | `islandCoin` | daily at 00:00 UTC |
| Wilds | `wildCoin` | manual only (refresh costs tokens, 3 a day) |
| Guild | `guildCoin` | every 7 days at 00:00 UTC |
| PvP | `arenaToken` | every 30 days at 00:00 UTC |

`nextRestockAt(shop, now)` returns the next boundary; the client shows `nextRestockAt − now` as a
countdown in `1D 02:23:40` style. A restock resets every item's `bought` count except one-time lines.

## Items

Each item has `{ id, name, price, grants (a reward bundle), limit?, oneTime? }`. A purchase is refused
when the currency is short, the limit for the restock window is reached, or a one-time line is already
bought. Limits are per restock window; one-time lines are permanent.

The Daily shop pays in gems (available from M3), so it is the shop a new player can actually use; the
token shops are wired end to end but their currencies only get real sources in later milestones
(Arena M10, Guild M11), and the debug panel can grant them meanwhile.

## Server methods

| Method | Effect |
|---|---|
| `buyShopItem(shopId, itemId)` | Restock if due, validate price/limit, deduct, grant, record the buy |
| `refreshShop(shopId)` | Manual shops only: pay the refresh cost, reset `bought`, bump the daily counter |

## Done criterion (M6)

Unit tests prove: `nextRestockAt` matches the UTC schedule for each restock type; a restock resets
per-window limits but not one-time lines; a purchase deducts the exact price, grants the bundle, and
is refused when the limit/currency/one-time rule blocks it.
