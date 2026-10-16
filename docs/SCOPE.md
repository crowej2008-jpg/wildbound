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
| Equipment layers: Relics, Runes, Charms, Spirit Cores, Talents | Wild screen Equip/Runes/Cores/Talents | M7 | built |
| Trials, Tower, World Boss, Daily Dungeons, Link Crystal endgame | Challenges hub, Tower, Trials, World Boss, Dungeons, Link Crystal | M8 | built |
| Arena, ranked ladder, weather, settlement | PvP hub, Arena, Rankings | M9 | pending |
| Build Lab (owner's main goal) | Build Lab, Debug, Rules panel, Kit editor | M10 | pending |
| Social + events (simulated), settings, help | Guild, Events, Settings, Help | M11 | pending |
| Hardening + optional Fastify/SQLite backend | all | M12 | pending |

## Reference material

- `reference/game-rebuild/` — read-only copy of the research wiki/repo (kb/, atlas/, spec/,
  data/, live/ text). Media-heavy wiki-sources/ and screenshot folders are not mirrored to keep the
  repo lean and OneDrive-friendly.
- `reference/sim/` — reserved for the Python battle simulator (`battle_sim.py`, `kits.py`, and the
  two test files). **Not present on this machine as of M0.** M1 parity tests will be written against
  the formulas in `kb/stats-and-combat.md` and `spec/combat-hypotheses-2026-10-05.md` until the
  simulator is provided; see docs/ASSUMPTIONS.md.

## Deliberately deferred (explicit)

- M12 backend (Fastify + SQLite `HttpServer`) is optional; local-only play remains the product if
  deferred.
- Real money / payments: never. A fake gem-purchase prototype may appear later behind a clear
  "not real money" label, or be omitted.