# Pet Home (M13.1)

Read before editing `packages/content/tuning/pet-home.json`, `packages/engine/src/pet-home`,
`packages/server/src/pet-home*.ts`, or `packages/client/src/pages/PetHome.tsx`.

Pet Home is a merge board, not a resident-placement or decoration system. The earlier
habitat/decoration plan was replaced after the source audit. The player summons a hidden ball onto
a tile, opens it into a Wild, merges two Wilds of the same merge level, and earns Home Coins from
the board while the Home level rises.

Reference read (shapes only; every name, number and description here is ours):

- `reference/game-rebuild/kb/pet-home.md` — the 2026-10-04 audit and the source's visible counts.
- `reference/game-rebuild/kb/clock-and-calendar.md` — UTC daily reset.

Paid content is deliberately absent: no Pet Home assistant, no paid tier, no real-money SKU.

## Data shape

`packages/content/tuning/pet-home.json` is parsed by `petHomeSchema` and re-exported as
`PET_HOME`.

| Table | Shape | Notes |
| --- | --- | --- |
| `levels` | 17 rows, Lv 0–16 | lifetime XP, revealed tile count, merge cap, padlock gem price, one-time reward |
| `tiles` | 21 rows on a 5×5 grid | four inert corners; each row has `row`, `col`, `unlockLevel`, `locked` |
| `income` | 16 rows, merge Lv 1–16 | `coinsPerFiveSeconds` |
| `shops.home` | 84 offers in five level bands | Home Exchange, paid in Home Coins |
| `shops.deluxe` | 48 offers, Home Lv 10 | Orb Atelier, paid in Orb Essence |
| `home` | daily/offline rules | 50 free summons, 8 h offline cap, 300 s settlement |

The runtime never generates these tables. `scripts/generate-pet-home.mjs` is the one-time dev
generator and the JSON is committed.

### Home levels

Level 0 starts with six active tiles and merge cap 8. The board grows to 21 tiles and the merge
cap to 16 at level 16. A new tile is either free or padlocked; a padlocked tile costs the
**current** Home level's gem price, not the price of the level that revealed it. Unrevealed
positions are inert and cannot be selected.

XP is awarded per action, not per minute: **+10 on opening a ball** and **+10 on a merge**. The
level is derived from lifetime XP, so an action cannot lose progress. Level rewards are one-time
claims for every level from 1 upward.

### Board and merges

Each tile holds either nothing, an unopened ball, or an opened Wild. A ball hides its species
until `openPet`. Opening records the species in the album and grants XP. Two opened Wilds of the
same merge level combine: the source is removed, the target gains one level, and the merge grants
XP. The target's tile is kept. A pair cannot merge above the current Home level's merge cap.

A released Wild leaves the board; it does not refund the summon. Releasing is the escape valve
when the board is full, including the stuck "one of every level" state the source describes.
A ball cannot be merged and does not earn income until it is opened.

### Income

Each opened Wild of merge level *L* earns the authored `coinsPerFiveSeconds` value. The table
doubles by merge level, so combining two equal Wilds is income-neutral (2 × L = L + 1). The visible
income is that value × 12 for a per-minute display. Settlement runs every **5 minutes** (300 s).
Each settlement tick pays the 5-second rate sixty times over. Offline time is credited for at
most **8 hours** in whole ticks; a partial tick is preserved and time beyond the cap is dropped.
The server settles lazily on read/action, not on a timer.

### Summons and shops

The first 50 summons each UTC day are free. Paid summons use the authored bracket list
(10 / 30 / 80 / 250 / 600 gems as the paid count rises); the last matching `afterPaid` bracket
wins. Counters reset at the UTC day boundary.

The Home Exchange is open at Home Lv 0 and the Orb Atelier at Home Lv 10. Each page shows nine
deterministic offers from the current band (day + refresh count seed the selection). Every offer
can be bought once per page. A refresh costs 40 gems for refreshes 1–10 and 80 for 11–30, with
30 refreshes per day; a shop's bought offers are cleared when that shop refreshes. The current
implementation shares the daily refresh counter between both shops. The daily reset also clears
purchases and resets the refresh counter.

## Server and save

`packages/server/src/pet-home.ts` owns gate checks, currency spending, summon count bookkeeping
and daily reset/settlement. `pet-home-view.ts` is a pure display read. Both use the campaign
`1-10` gate from `explore.json`; every write fails with `resource_locked` while the gate is shut.

Save **v16** adds `petHome`:

- `xp`, `unlockedTiles`, `pets`, `nextPetSeq`
- `lastSettledAt`, `summonDay`, `freeSummonsUsed`, `paidSummonsUsed`
- `levelClaims`, `album`
- `shopDay`, `shopRefreshes`, `shopBought`

`initialPetHome(now, day)` is the default. v15 and older saves migrate with a fresh slice.

## Screen

`/explore/pet-home` is the live screen. It shows the 5×5 board with four inert cells, current
Home level/XP/merge cap/income, free-tile count, the summon control, tile unlocks, open/release,
same-level merge choices, level rewards, both shops with refresh counts and an album of all 84
Wilds. A locked mode shows the gate checklist and a Campaign link instead of interactive controls.
The Explore card is `live`; the old shell copy is gone.

## Tests

- Content: 17 levels, 21 tiles, 16 income rows, 84 + 48 shop rows, reset/offline shape.
- Engine: level/merge-cap derivation, hidden ball → open → merge, cap rejection, capped
  settlement and remainder, padlock/claim pricing, deterministic shop pages and refresh costs.
- Server: free/paid summons, open/merge/release, padlock spending, level claims, shop purchase and
  refresh, lazy settlement, gate rejection, persistence, v15 → v16 migration.
- E2E: freshly cleared save, summon/open/merge, padlock unlock, level claim, shop purchase/refresh,
  album; locked Explore card and gate page.
