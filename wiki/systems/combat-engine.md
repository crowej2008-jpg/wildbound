---
title: Combat engine
type: system
milestone: M1 (+M4 replay, M9 DSL v2, M10.5 strategies)
status: built
updated: 2026-10-31
sources: [docs/design/combat.md, packages/content/tuning/combat.json, opencode-session-2026-10 msg 34]
---

# Combat engine

Pure, deterministic 6v6 auto-battler in `packages/engine/src/combat/`. Rebuilt from the
**measured** model in `reference/game-rebuild/kb/stats-and-combat.md` (the Python reference sim was
never provided, so PROMPT §6 is the authority).

## Battle loop
- "Big rounds": every living unit acts once in effective-SPD order; ties → attackers first.
- `maxRounds` **15**; a time-out goes to the **defender** (survival trials flip it; Sky Pillar uses
  `roundLimit` as a time-out loss).

## Damage per hit
`raw = atk × rate` → `× G × P × K × Soul × Team × classMult × weather`
- `G = max(gFloor, 1 + dmgBoost − dmgRdct)`; `P` PvP floor; `K` ult/skill boost vs reduction;
  `Soul` saturating curve on spiritAtk − spiritDef; `Team` cuts only the weaker side.
- Crit and block roll independently afterwards. `hpShare` skills bypass everything.
- **R1:** the attacker's star-card "DMG BST to [faction]" (25 %) is added to the G pair when the
  defender is that faction (how the source combines it is open — ASSUMPTIONS #52).
- Unit stats come from the source formula since R1 — see [roster](roster.md).
- **DEF is inert** by default (`defendersUseDef: false`) — the measured model says so.

## Rage
1,000 bar; Strikers start full (first action = ult), others 500; +250 per action (SKILL class only — owner change); on hit
`125 + floor(1000 × hpLost / maxHp)`; ult empties the bar; normal action → basic skill 20% of the time.

## Status
Buffs are tag-keyed — same tag refreshes, never stacks. Controls: freeze/stun/sleep (skip),
silence (no ult), confusion (hits own side), paralysis (ult if full else skip), taunt = forced
targeting (fixed in M9). Heals use **target max HP** as basis.

## Determinism & replay
`runBattle` returns an immutable event log (+ `battleId`, `seed`). The M4 battle screen folds the
log into frames — no re-simulation. Golden lock in `packages/cli/tests/golden/` replays byte-for-byte.

## E1 additions (2026-10-31)
Event triggers on crit / blocked / dealing damage / being controlled / landing a control / after each
skill slot, once-per-battle caps, round and tag conditions, per-hit damage modifiers, ignore-block,
+% attack, basic-rate and rage-block — see [battle engine](../milestones/battle-engine.md). Gear adds
triggers and damage modifiers to a unit without touching its kit.

## Squad strategies (M10.5)
`aggressive` / `balanced` / `defensive` are live via `BattleConfig.strategies`
(`strategyUltHoldHp` 0.75). `balanced` = old behaviour.

## Settings
~40 named knobs in `tuning/combat.json`, each tagged seen / open / fitted / assumed. Uncertain rules
become settings, never magic constants. Weather default +30% (Ranked).

Related: [skill kits](skill-kits.md), [Build Lab](build-lab.md) (exposes these settings).
