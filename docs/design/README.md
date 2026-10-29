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
- M9 (design): `skill-kits.md` (the combat-DSL expansion the imported kits need — targeting, damage,
  effects/conditions, resources, triggers, cooldowns — and the plan to port all 84 creatures).
- M10 (design): `pvp.md` (Arena credits, ghosts and weekly settlement via Mail; the Ranked ladder with
  promotion matches, faction weather and best-of-3; live squad strategies; and the M10.6 measured
  balance pass with its tier-banded ghost pools).
- M13 (design): `explore.md` (the hub, gates, server-day clock and resets) and `pet-home.md` (the
  merge board, 17 Home levels, lazy 8-hour income, summons, level rewards and the two shops).