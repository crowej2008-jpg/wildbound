# Account systems III (M15)

Owner request 2026-11-05: trainer treasures, Z Ring, Pure Crystals, fusion skins, Golden Egg, Awakening as one
milestone. Page: `/account-systems`, linked from the Trainer screen.

## Data
`scripts/import-account3.mjs` → `packages/content/tuning/account3.json` (schema `account3-schema.ts`).

## Rules
- **Treasures**: each unlocks when its Victory Road gym is beaten. Level (Treasure Liquid), accessories, refines
  (need a treasure level), awakening stars. Skill level = highest tier whose level / accessory / refine needs are met.
  Each treasure boosts one faction (one per faction; two once five are unlocked). Resonance = 5th-highest skill level.
- **Z Ring**: levels from Wristband Essence; higher levels raise the Pure Crystal cap. Crystals (one per faction)
  level from Crystal Essence and add stats to that faction.
- **Fusion skins**: 18 skins; shards level them; each level adds stats and a perk.
- **Golden Egg**: 1 free smash a day; vouchers for ×1/×10/×30; each smash = 1 Egg Point; points buy Pokémon shards.
- **Awakening**: server day 60 and twelve 18★ Pokémon. Pick one trainee; tasks add progress to 600; then it may
  evolve 18★→19★. 19★ and beyond cost Awakening Stones plus own-copy fodder.
- All stat lines fold into battle through `account3Lines` (account-wide + the unit's faction).

## Stand-ins and gaps
See ASSUMPTIONS #113 and docs/design/m14-m17-decisions.md.
