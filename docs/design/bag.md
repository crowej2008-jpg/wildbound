# The Bag — generic Pokémon shards and Pokémon boxes (R9, copied from the source)

Read before editing `packages/engine/src/bag`, `packages/server/src/bag.ts`, `packages/content/tuning/bag.json`
(written by `scripts/import-bag.mjs`) or the Bag screen. Source: `item_compound_json`, `item_hero_json`,
`item_use_json` 10503; rules from `kb/pokemon-growth.md` (shards into Pokémon and boxes) and `kb/gacha.md`.
Readings: ASSUMPTIONS #84.

## Compose (ITEM_COMPOSE)

| Shards | Make | The box |
|---|---|---|
| 3-Star Pokémon Shard ×40 | 3-Star Pokémon Box | random, opens itself: 14 Uncommon / Rare Pokémon at their first star (3★) |
| 5-Star Pokémon Shard ×50 | 5-Star Pokémon Box | random, opens itself: 36 cards at 5★ (Uncommon / Rare 5,000–7,776, Epic 1,000, Legendary 666) |
| 4 Star Pokémon Fragment ×50 | 4 Star Pokémon Chest | random, opens itself: the six Rare starters at 4★ |
| Selectable Precious Shard ×50 | Selectable Precious Giftbox | stays in the bag; a choice box |

One press makes 1 … 999 boxes (the source panel's cap). Random Pokémon boxes never stay in the bag: composing
opens them and the Pokémon land in the roster (kb: the next ROLE_CHANGE already carries them).

## Boxes held in the bag

| Box | Kind | Gives |
|---|---|---|
| Supreme Random Box | random | one of 21 Supremes at its first star, equal weight |
| Legendary Random Box | random | one of the six birds and beasts |
| Shiny Supreme Random Box | random | one of six Shiny Supremes |
| L & D Opt Box | choose a Pokémon | one of 15 Light / Dark Mythics |
| Selectable Precious Giftbox | choose an item | 50 shards of Raikou, Entei, Suicune, Zapdos, Moltres or Articuno |

The source Giftbox also offers 20 Golden Egg Vouchers; the Golden Egg is not built, so that choice is left out
until it is (ASSUMPTIONS #84). Species shards then make the Pokémon on its own page (E4: 50 a Legendary).

## Not copied yet

Other generic shards (faction 5S shards, Opt 5S, Epic, LF and Premium shards, the faction 4★ fragments) and their
boxes — Wildbound has no source for them yet; they come with the shops and events that give them.

## State (save v39)

New currency `preciousGiftbox`. The reward boxes (`boxSupreme`, `boxLegendary`, `boxShinySupreme`, `boxLD`) were
already currencies (Tower, daily dungeons); they can now be opened.

## Server methods

| Method | Effect |
|---|---|
| `getBag()` | Recipes with what the shards can make; every box's rows (chance or choice) |
| `composeBag(from, times, seed?)` | Spend shards; a random box opens itself, else the box goes to the bag |
| `openBagBox(boxId, times, seed?)` | Open held random boxes |
| `chooseBagBox(boxId, species)` | Open one choice box for the chosen species (a Pokémon, or the Giftbox's shards) |
