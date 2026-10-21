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
| Growth/collection II: Potential, Orbs, Soul-hearts, Plates, Trinkets, Held Items, Resonance, Berries, VIP | Wild screen, Trainer, VIP | M11 | in progress - M11.0 gear tabs/stat sheet; M11.1 Trainer/materials/save v7; M11.2 Potential; M11.3 Orbs; M11.4 Soul-hearts; M11.5 Berries |
| Ancient Artifacts, Suppression, Ruins Adventure | Artifacts, Ruins Adventure | M12 | pending |
| Explore modes: Hoopa's Vault, Rift Arena, Gods Trials, Sky Pillar, Faction Tower, Misty Woods, Pet Home, Island Challenge, Ultra Wormhole | Explore hub + each mode | M13 | pending |
| Combat/co-op modes: Victory Road + King's Trial, Paradise, Joint Team + Dynamax/Wild Area, Clash of Isles, Shovel Carnival | Combat hub + each mode | M14 | pending |
| Guild, merge and events (simulated) | Guild, Events, Settings, Help | M15 | pending |
| Guild war and Relic Battlefield | Relic Battlefield, Guild War | M16 | pending |
| Cross-server PvP: Cross-Server Clash, Championship, SPT Temple | PvP hub sub-modes | M17 | pending |
| Visual-identity pass: 2D sprites, source-accurate UI palette, battle effects | Gallery, HUD, all screens | M18 | pending |
| Hardening + Fastify/SQLite backend (shared service) | all | M19 | pending (required) |
| Build Lab (owner's main goal) | Build Lab, Debug, Rules panel, Kit editor | M20 | pending |

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