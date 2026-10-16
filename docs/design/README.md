# Design notes

One note per system, written *before* coding it, per the working agreement (PROMPT.md §14). Each
note records decisions, assumptions and the reference files it read.

Planned notes (alphabetical): balance, combat, economy, gacha, growth, pve, pvp, server-api, squads, time.

Status:
- M0: no system notes yet — M0 is scaffolding. `docs/RULES.md` and `docs/ASSUMPTIONS.md` carry the
  current rules and open questions.
- M1: `combat.md` (engine combat model, event log, DSL, golden lock).
- M2: `wilds.md` (species schema, stat formula, Power) and `art.md` (procedural portrait generator
  and gallery).
- M3: `account.md` (account/roster/growth/squad domain, save codec, LocalServer boundary, client
  screens).
- M4: `battle-ui.md` (event-log replay reducer, battle setup/seed, the `/combat` screen, playback).
- M5: `pve.md` (campaign ladder, idle income, daily quests/mail, tutorial, debug clock) and
  `balance.md` (the authored campaign difficulty curve and how the starter roster clears it).
- M6: `gacha.md` (machines, pity, wish, boxes) and `shops.md` (restock schedules, limits).
- M7: `equipment.md` (relics, rune sockets/sets, charms, spirit cores, talents, loadouts).
- M8: `pve-modes.md` (Tower, Trials, World Boss, Daily Dungeons, the Link Crystal, `BattleRules`).
- 2026-10-15 content override: `roster-import.md` (the owner-override roster import — attribute→faction,
  rarity→tier, generated stats, the 17 ported skill kits, parity-kit fixtures, relaxed coverage rule).