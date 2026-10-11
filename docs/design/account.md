# Account, roster, growth, squads (M3)

Read before editing `packages/engine/src/roster`, `packages/server`, `packages/content/tuning/account.json`,
`packages/content/tuning/growth.json`, or the client's HUD/Wilds/Squad screens.

## Goal

A new player has a persisted account: a roster of Wilds, currencies, and per-mode squads. They can
grant a Wild (debug, until M6 gacha), level it, raise stars, evolve it, and save a squad; reloading
restores exactly that state. The client talks only to `GameServer`; all rules and randomness live in
the engine/LocalServer (PROMPT §10).

## Domain (engine, `packages/engine/src/roster/`)

Pure types + functions. The engine owns the rules; it never imports content and never persists.

- `WildInstance` — `{ id, speciesId, level, stars, evolutionStage, locked, acquiredAt }`. `id` is a
  per-account unique instance id (the same species can be owned several times).
- `PlayerProfile` — `{ name, level, xp }`.
- `SquadMode` — `campaign | arenaAttack | arenaDefence | tower | worldBoss` (one squad group each, §7.2).
- `Squad` — six slots (`(string | null)[]`); slots 0–2 are the front row, 3–5 the back row.
- `CurrencyId` — `gold | gems | candy | shard | stone`.
- `StrategyId` — `aggressive | balanced | defensive` (one per squad).
- `AccountState` — `{ schemaVersion, profile, roster, squads, strategies, currencies, nextInstanceSeq }`.

### Growth rules (our tables, in `tuning/growth.json`)

| Rule | Formula | Reference shape |
|---|---|---|
| Level cost (level → level+1) | `candyCost = round(candyBase × level^candyExponent)`, `gold = candy × goldPerCandy` | reference Lv1→2 = 48 candies + 143 gold, gold ≈3× candies (`kb/pokemon-growth.md:28,188`) |
| Level cap | `maxLevelByStage[stage]` (60/80/100/140) | caps by stage (`kb/pokemon-growth.md:42,209`) |
| Star cost (star → star+1) | `shards = shardsPerStar × star`, `gold = goldPerStar × star` | stars raised by duplicate materials (`kb/pokemon-growth.md:39`) |
| Evolve (→ stage) | step `{ minLevel, minStars, candy, gold, stones }` | min level/star + materials (`kb/pokemon-growth.md:39-46`) |
| Respawn | costs gems; refunds `refundRate` of invested candy+gold; refuses if locked or in any squad | refuses in-lineup/locked/talents/relics (`kb/pokemon-growth.md:30,193`) |

Our model is simpler than the reference: **stars are a single 1..`maxStars` axis that multiplies
stats (`starStep`) and gates evolution**, not a per-quality star cap table; evolution has at most 3
stages (our species `stages.length`). Star material is a generic `shard` currency rather than
species-copy fodder. Documented as a deviation.

### Auto Formation (`squad.ts`, §7.2)

Input: the roster, the current saved slots, and a `powerOf(instance)` + `classOf(speciesId)` callback
(the server supplies these from the growth module). Steps: candidates = roster (one instance per
species); keep saved members that are still candidates in their slots; fill free slots by power desc
(tie-break stars desc, level desc, id asc); then re-sort so Guardians occupy the front row and each row
is strongest-first. Slots 0–2 are the front row, 3–5 the back row (positions decide who is hit first).

### Strategies

`StrategyId = aggressive | balanced | defensive`, stored per squad. The engine exposes the enum and
the server persists it; its combat effect (basic-skill rate / target preference, §7.2) is wired when
the battle setup reads squads in M4. Recorded as an open item.

## Save (server, `packages/server/src/save.ts`)

- `AccountSave` is `AccountState` plus a `schemaVersion`. `SAVE_VERSION` is bumped when the shape
  changes; `migrateSave(raw)` upgrades older versions and rejects unparseable/corrupt data with a
  typed `corrupt_save` error.
- Export/import is JSON (`serializeSave` / `parseSave`). On load the server keeps one-step backup
  (the previous good save) so a corrupt write can be recovered.

## Server boundary (`packages/server`)

`GameServer` gains one method per action (§10): `loadAccount`, `grantWild`, `grantRandomWild`,
`grantCurrency`, `levelUp`, `starUp`, `evolve`, `respawn`, `toggleLock`, `saveSquad`, `autoFormation`,
`setStrategy`, `exportSave`, `importSave`, `resetAccount`. All return typed `Result`; every mutating
action returns the full `AccountSnapshot` (`state` + per-instance `power` + per-mode `teamPower`).
`LocalServer` implements them against an injected `SaveStore` (async key/value): `MemoryStore` for
tests, `IndexedDbStore` for the browser. Autosave after every mutating action, with a one-step backup.

`buildConfig()` lifts the runtime tables (progress/growth/Power/species metas/starting account) from
validated content, so the server never hard-codes tuning.

## Client

- `ServerProvider` (React context) creates one `LocalServer`, loads the account, and exposes the
  account + action wrappers; components never touch the engine or IndexedDB directly.
- **HUD** (persistent, all screens): brand + "Milestone 3" + UTC clock, the player card
  (name + level), and currency pills (gold/gems/candy/shards/stones) with `+` → debug grant. A global
  error banner surfaces typed `Result` failures.
- **Wilds** (`/wilds`): roster list with faction filter + sort by power/recent; team Power shown;
  tap → Wild detail.
- **Wild detail** (`/wilds/:id`): portrait, Power, level/cap, stars, lock + respawn; tabs **Upgrade**
  (level +1/+10/Max with candy/gold costs, star-up with shard/gold cost) and **Evolve** (next form,
  requirement checklist, cost, Evolve button; per-stage preview row).
- **Squad editor** (`/squad`): mode tabs, six-slot front/back grid, pick-a-Wild panel, tap-to-assign,
  Auto Formation, Clear, strategy select, team Power. Placements save immediately.
- **More → Debug** (`/more`): grant each currency, grant a chosen species or a random Wild, export save
  (clipboard), import save, reset account.

### Simplifications vs. the reference

- The HUD omits the reference's avatar, VIP badge and trainer XP bar (XP is tracked but not awarded
  yet); these arrive with the campaign/idle loop (M5).
- Squad assignment is tap-to-assign only; drag-and-drop is deferred.
- Star material is the generic `shard` currency (not species-copy fodder) and evolution has ≤3 stages.

## Done criterion (M3)

Grant a Wild via debug, level it, evolve it, save a squad, reload the page, and see the same roster,
currencies and squad.
