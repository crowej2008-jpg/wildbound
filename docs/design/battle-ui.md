# Battle UI — replay from the event log (M4)

Read before editing `packages/engine/src/combat/replay.ts`, `packages/server/src/battle.ts`, or the
client's `/combat` screen.

## Goal

The engine already decides a whole battle and returns a complete `BattleEvent[]` (M1, `combat.md`).
M4 makes that *visible*: a mobile-first battle screen that replays a recorded log, step by step, with
HP/rage bars, floating damage/heal popups and a compact result panel (PROMPT §6, §8, §13).

**The engine never renders and the client never simulates.** The client's only job is to fold the
immutable event list into per-frame visual state. This keeps the fight deterministic: the same log
always replays identically (PROMPT §6.1 "a recorded battle replays identically on every run").

## Scope (this milestone = a minimal vertical slice)

One screen, one flow, fully working end to end:

- Play/pause, a speed toggle (1×/2×/4×), single-step forward/back, restart, skip-to-end.
- 6v6 field with HP + rage bars, alive/dead state and a shield badge.
- Floating damage / heal / crit / block / miss popups over the target.
- A round header (`Turn r / maxRounds`) and a compact result panel (winner, rounds, per-unit
  damage/heal breakdown, expandable raw log).

Deliberately **deferred** (tracked in `docs/SCOPE.md`): team preview / pre-battle formation screen,
weather + per-round banner art, buff/debuff icon tooltips, camera shake and status-icon art,
pause-on-hit cinematic, and replay of any mode other than the campaign squad. Those are polish, not
the vertical slice.

## Precedence — the log is the source of truth

A battle is generated once by the server (`runBattle`), then stored as `{ units, events, winner }`.
Every frame is derived by folding the first *n* events; there is no per-frame randomness and no
re-simulation. This is why "replay" and "the fight" can never disagree.

## Engine — `packages/engine/src/combat/replay.ts`

Pure, content-free, testable. A reducer over the existing `BattleEvent` union:

- `ReplayUnit` — `{ key, side, position, hp, maxHp, shield, rage, alive, buffs }` (a snapshot of one
  combatant's visible state).
- `ReplayState` — `{ round, winner, units }`.
- `initReplay(units)` — seed from the server-built unit list (hp = maxHp, shield 0, alive true, rage =
  class start).
- `stepReplay(state, event) → ReplayState` — immutable fold of one event:
  - `roundStart` → `round`; `result` → `winner`.
  - `hit`/`reflect` → target `hp = hpAfter`, `alive = hpAfter > 0`.
  - `heal` → target `hp = hpAfter`; `shield` → target `shield = shieldAfter`.
  - `rageChange` → unit `rage`; `death` → `hp 0`, `alive false`.
  - `buffApplied`/`buffExpired`/`immunity` → maintain the unit's `buffs` tag set.
- `replayTo(units, events, count)` — fold the first `count` events (used for scrubbing/step-back).
- `lastActor(events, index)` / `lastTarget(...)` — tiny helpers for highlighting who just acted.

Assumption (recorded in `ASSUMPTIONS.md`): `hit.hpAfter` already accounts for shields, so the shield
bar is shown as the last `shield` event's value and is *not* decremented per hit — an approximation
until the engine logs shield absorption explicitly.

## Server — `packages/server/src/battle.ts`

Turns an account squad into a battle. Reuses the growth module exactly like `instancePower`:

- `slotToPosition(slot)` — front slots 0–2 map to field positions 4–6, back slots 3–5 to 1–3
  (PROMPT §6.1: positions 1–3 back row, 4–6 front row).
- `buildSquadSpecs(state, mode, side)` — read the saved squad (auto-fill from the roster when empty),
  resolve each owner's `CoreStats` → `SheetInput`, kit (`kitById(speciesId)` converted with the same
  `kitToEngine` shape as the CLI), per-unit Power.
- Enemy = a mirrored "echo" of the player's squad (same species/level/stars/stage, reversed order),
  so a fresh account can always fight. A real campaign stage supplies the defender list in M5.
- `startBattle(config, state, mode, seed?)` → `BattleView`:
  `{ seed, mode, winner, rounds, events, units: BattleUnitSeed[], teams: { attackers, defenders } }`.
  `BattleUnitSeed` extends `ReplayUnit` with `{ name, speciesId, className, power }` for the UI.
  The seed comes from `config.rng()` (server-side randomness, PROMPT §10); an explicit seed makes
  tests/library replays reproducible.

`GameServer` gains `startBattle(mode, seed?)`; `LocalServer` implements it (reads its own state; does
**not** mutate the save). It returns `Result<BattleView>`.

## Client — `/combat`

- `Combat.tsx`: calls `startBattle('campaign')`, holds the `BattleView`, and owns the playback clock
  (a `setTimeout` loop; interval = `baseDelay / speed`, base ≈ 550 ms). Reduced-motion (`prefers-
  reduced-motion`) starts paused and skips popup animation.
- `BattleField.tsx`: two halves (defenders top, attackers bottom), each a back row (positions 1–3)
  and a front row (4–6) so the front rows face each other. Each `UnitCard` shows a small procedural
  portrait, name, HP bar, rage bar, shield badge and buff chips; the current actor/target is
  highlighted; the popup layer floats damage/heal numbers keyed off the event just applied.
- `ResultPanel.tsx`: winner banner + per-unit damage-dealt/taken and healing, sorted; a "battle log"
  disclosure lists the raw folded events (`describeEvent`).
- i18n keys under `combat.*`; styles in `tokens.css`. The bottom-nav Combat tab is now live (it was
  an honest "built in M4" placeholder).

Playback is presentation only: pausing slows the clock, it never changes the outcome.

## Done criterion (M4)

Open Combat, press play, and watch a recorded battle replay to a result; pause, step and change speed
freely; press restart and see the identical fight (same winner, same per-unit HP). Reload the page
and the same recorded battle replays identically.

## Reference files read

`PROMPT.md` §6 (combat model), §8 (screens, mobile portrait), §10 (server boundary), §11 (UI),
§13 (M4). `docs/design/combat.md` (event log), `account.md` (squads/save).
