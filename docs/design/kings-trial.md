# King's Trial (M14.2)

`scripts/import-kings-trial.mjs` → `packages/content/tuning/kings-trial.json`, from the source's champion_challenge
tables (evening_cfg 2026-10-02). Route: `/kings-trial` (linked from Victory Road).

## Built
- 7 regions, 36 Elite Four / Champion trainers. A trainer opens once its Victory Road gyms and the trainers before it
  are beaten.
- **Champion Points** come from claimed achievement tasks (645, source) and weekly tasks (16, source). A trainer's
  progress = points / its `score` threshold (reading: `score` is a running total); chests at 30 / 60 / 100; at 100 it
  can be fought. First clears pay the source rewards; Champions grant their battle privilege (+5 % HP or lifesteal to a
  class or faction).
- Achievement point milestones (30, source) pay Diamonds.
- Tracked task events: login days, outfits, resonance level, Arena wins against stronger teams; weekly: Daily Shop
  buys, Premium draws, World Boss, Sky Pillar, Rift, Ranked. A small `counters` slice keeps lifetime and weekly totals.

## Not copied / waiting
Golden Egg and fusion-skin tasks (no such systems); weekly tasks on Pokémon Park, Clash of Isles, Relic Battlefield,
ladder and Gods (their modes are not built). Enemies are a stand-in (the gym the trainer follows, a few levels up).
Items with no Wildbound equivalent are listed as `notCopied` in the tuning.
