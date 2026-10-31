# Scope

One milestone at a time (see PROMPT.md §13). `pnpm check` gates every milestone.
Everything not yet built shows an honest "coming later" state in the client and is mapped below.

| System (PROMPT §7) | Screen(s) (§8) | Milestone | Status |
|---|---|---|---|
| Workspace, tooling, IP guard, hello-world client | App shell, Home, nav | M0 | built |
| Combat engine, event log, DSL, CLI simulator, golden parity | — (headless) | M1 | built |
| Species, Wild roster, kits, stat formula, Power, growth tuning, creature generator gallery | Gallery | M2 | built |
| Account, roster, growth, squads, LocalServer, saves | HUD, Wilds (Upgrade/Evolve), Squad editor, More/Debug | M3 | built |
| Battle UI (replay from log) | Battle screen, Result panels | M4 | built |
| Campaign, idle income, quests, mail, clock, tutorial | Campaign, Daily loop, Mail, Quests, Tutorial | M5 | built |
| Summoning (gacha) and shops | Summon, Shop | M6 | built |
| Equipment layers: Relics, Runes, Charms, Spirit Cores, Talents | Wild screen gear tabs | M7 | engine + server built; screens shipped in M11.0 |
| Trials, Tower, World Boss, Daily Dungeons, Link Crystal endgame | Challenges hub, Tower, Trials, World Boss, Dungeons, Link Crystal | M8 | built |
| Combat DSL expansion + faithful 84-creature skill kits | — (headless; Wild screen unchanged) | M9 | built |
| Arena, ranked ladder, weather, settlement | PvP hub, Arena, Rankings, Ranked | M10 | built (Arena + Ranked + hub + weekly settlement + balance pass - `docs/design/pvp.md`) |
| Growth/collection II: Potential, Orbs, Soul-hearts, Plates, Trinkets, Held Items, Resonance, Berries, VIP, Titles | Wild screen, Trainer, VIP, Titles | M11 | built - gear tabs/stat sheet, Potential, Orbs, Soul-hearts, Berries, Held Items, Plates, Trinkets, Resonance, VIP and Titles (save v13 at M11; v14 in 13.0a; v15 in 13.0b; v16 in 13.1; `docs/design/collection.md`) |
| Ancient Artifacts, Suppression, Ruins Adventure | Artifacts, Ruins Adventure | M12 | deferred by owner (2026-10-23) - not part of M13 |
| Explore modes: Hoopa's Vault, Rift Arena, Sky Pillar, Faction Tower, Misty Woods, Pet Home, Island Challenge, Ultra Wormhole | Explore hub + each mode | M13 | in progress - 13.0a campaign foundation, 13.0b Explore hub/shells, 13.1 Pet Home merge board and 13.2 Sky Pillar built; Gods Trials deferred |
| Combat/co-op modes: Victory Road + King's Trial, Paradise, Joint Team + Dynamax/Wild Area, Clash of Isles, Shovel Carnival | Combat hub + each mode | M14 | pending - full Victory Road tasks/badges/commission; 13.0a already ships the 60 gym gate fights |
| Guild, merge and events (simulated) | Guild, Events, Settings, Help | M15 | pending |
| Guild war and Relic Battlefield | Relic Battlefield, Guild War | M16 | pending |
| Cross-server PvP: Cross-Server Clash, Championship, SPT Temple | PvP hub sub-modes | M17 | pending |
| Visual-identity pass: 2D sprites, source-accurate UI palette, battle effects | Gallery, HUD, all screens | M18 | pending |
| Hardening + Fastify/SQLite backend (shared service) | all | M19 | pending (required) |
| Build Lab (owner's main goal) | Build Lab, Debug, Rules panel, Kit editor | M20 | pending |

## M13 plan (locked 2026-10-23)

Source shape is 182 chapters × 10 stages with 60 gym gates at 3-1, 6-1 … 180-1. M13 keeps that
shape, uses our own chapter/gym names and numbers, and removes all paid tracks, Vault passes, the
Pet Home assistant, and real-money SKUs. Gems remain earnable.

- **13.0a — campaign foundation:** 182×10 stages, 60 gym gate fights, gate checks, save v14,
  chapter index/chests (`docs/design/campaign-expansion.md`). **Built.**
- **13.0b - Explore foundation:** hub, eight mode shells, gate evaluation and reset countdowns
  (`docs/design/explore.md`). **Built.** Attempt/reward state lands with each playable mode.
- **13.1 - Pet Home** (A gate 1-10): 5×5 merge board, 21 tiles, 17 Home levels, summons,
  merges, lazy Home-Coin income, level rewards and two shops (`docs/design/pet-home.md`). **Built.**
- **13.2 — Sky Pillar** (A gate 7-1): 180 floors x 10 stages, six wings, two extra star
  conditions per stage, 10/20/30-star floor chests, 8-hour proofs and sweeps
  (`docs/design/sky-pillar.md`). **Built.**
- **13.3 — Hoopa's Vault** (B gate: server day 15): 300 floors; retrofit Resetter Shards → Held Item
  Resetters here (20 Resetter Shards = 1 Held Item Resetter).
- **13.4 — Rift Arena, part 1:** Barriers/Merchant.
- **13.5 — Rift Arena, part 2:** Ring Battle + Quiz (A gate 10-10 + Lv10); 250 floors.
- **13.6 — Misty Woods** (A gate 3-10): 244 runes.
- **13.7 — Faction Tower** (A gate 28-10): 3,000 floors.
- **13.8 — Island Challenge** (A gate 3-10 + Lv10): 90 levels, full simulated 5v5 alliance contest
  with bot alliances and settlement.
- **13.9 — Ultra Wormhole** (A gate 10-10 + Lv50): 135 hires.
- **13.10 — mode close-out:** rewards, resets, no dead buttons; M13 done criterion.

Deferred beyond M13: **Gods Trials** (parked; its local Suppression Treasures are not M12 artifact
Suppression). **B gates** remain future: Gods server day 29 + Lv45, Joint day 60 + Lv45, Relic first
merge + Lv45. M12 stays skipped. Full Victory Road tasks/badges/commission stay M14.

## Reference material

- `reference/game-rebuild/` — read-only copy of the research wiki/repo (kb/, atlas/, spec/,
  data/, live/ text). Media-heavy wiki-sources/ and screenshot folders are not mirrored to keep the
  repo lean and OneDrive-friendly.
- `reference/visual/` — local-only visual reference restored from the owner's workspace (full-screen
  `screens/` captures and the bot's `templates/` UI crops), used to match the source game's look. Ships
  with the rest of `reference/` (gitignored, never committed); see `reference/visual/README.md`.
- `reference/sim/` — reserved for the Python battle simulator (`battle_sim.py`, `kits.py`, and the
  two test files). **Not present on this machine as of M0.** M1 parity tests will be written against
  the formulas in `kb/stats-and-combat.md` and `spec/combat-hypotheses-2026-10-05.md` until the
  simulator is provided; see docs/ASSUMPTIONS.md.

## Deliberately deferred (explicit)

- The M19 backend (Fastify + SQLite `HttpServer`) is **required** for the owner's plan to run a shared
  online service for a small trusted group (owner decision 2026-10-17; see `docs/ASSUMPTIONS.md`
  › Owner content override, item 9). Local-only play remains possible, but the shared service is the
  target. Distribution stays private and invite-only — no public release.
- Real money / payments: never. A fake gem-purchase prototype may appear later behind a clear
  "not real money" label, or be omitted.