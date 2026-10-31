---
title: Hoopa's Vault
type: system
milestone: M13.3
status: next — planned, not started
updated: 2026-10-31
sources: [opencode-session-2026-10 msgs 94-97, docs/SCOPE.md]
---

# Hoopa's Vault (M13.3) — gate: server day 15 (B)

Owner said "lets work on all of m13.3" on 2026-10-31 08:07; OpenCode stopped at 08:09 (usage limit)
after only reading files. **Nothing is built yet.**

## Rules (agreed plan)
- **300 floors**; floor N+1 unlocks after N; first-clear chest per floor.
- **Keys:** 5 free Vault Secret Keys per UTC day (claim once); keys persist; no paid source.
- **Multiplier:** ×1, ×3 once highest floor > 31, ×5 once > 71. A run reserves `multiplier` keys;
  win consumes them, Exit/loss refunds.
- **Run:** start escape 10 / Hoopa 0, target 40. Two route cards per stage:
  Strong (+10 escape, better drops), Normal (+5), Battle buff (+5, run-scoped dmg buff),
  Drop blessing (+5, better guardian drops).
- Route battle round cap = **escape − Hoopa**; time-out = loss. Hoopa advances by rounds fought.
- At 40: **Exit Guardian**, fixed 15 rounds. Win = bag + 3 guardian drops, key consumed.
  Loss/Exit = key refunded, bag lost. No team changes mid-run.
- **Loot:** held items, Held Item Shards, Resetter Shards. Quality bands ~ rare 1+, epic 11+,
  legendary 31+, supreme 71+, **mythic 181+**. Resetter lumps grow with floor (×1 at 51–100 … ×3–4 at 251–300).

## Build order
1. **13.3a** — Resetter currencies + compound + new refine ladder + 27 mythic held items
   ([decision](../decisions/resetter-shards-and-refine.md), [held items](held-items.md)).
2. **13.3b** — `engine/src/hoopa-vault/`, 300-floor content + generator, save **v18**.
3. **13.3c** — `hoopa-vault.ts` + view, `/explore/hoopa-vault`, e2e (day-14 locked/day-15 open, run,
   Exit refund, compound, refine, reload mid-run), `docs/design/hoopa-vault.md`, `pnpm check`, push.

## Decided defaults
- Treasure Finders **deferred** to M14 (their parts come from Dynamax).
- Paid Vault passes removed.

## Open
Refine cost ladder (owner's vs source's) → [open questions](../open-questions.md). Held Items must be
rebuilt to the source (random lines, re-roll refine, 75 items) in 13.3a.
