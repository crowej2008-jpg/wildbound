---
title: E6 tier list (Supreme, Mythic, Origin)
type: system
updated: 2026-11-01
milestone: E6
sources: [scripts/balance/tier.ts]
---

# E6 tier list

Owner scope (2026-11-01): *"the only pokemon that matter are supremes, mythics and origins anything else is
always fodder"* — 56 Pokémon. Page for the owner: the published tier list artifact.

## Method
Random 6v6 teams from the 56, 50,000 battles per stage, same star / level / skill levels, no gear, placed
Guardians → Strikers → SKILL front to back; sides swap every other battle. Score = win rate of the teams a
Pokémon was on (≈10,700 battles each; ±2 points is noise). Stages: early star 5 Lv100, mid star 10 Lv300,
max star 23 Lv340 (Origin skills LV1/2/3). "Long fights": max stage with HP ×3 / ×6.
Run: `tsx scripts/balance/tier.ts <early|mid|max> <battles> [out.json]` (env `HPMUL`, `DIALGA=friend`).

Tiers within each quality at max: S ≥60%, A 53–60, B 48–53, C 43–48, D <43. ★ = the owner's real meta six.
Rage rule: +125 per action, SKILL +250 (owner 2026-11-01).

### Origin

- **S**: Zacian (Striker, 77%), Necrozma (SKILL, 62%)
- **A**: Shadow Mewtwo (Striker, 59%), ★ Origin Lugia (Guardian, 56%)
- **B**: Origin Rayquaza (SKILL, 50%), Calyrex (Guardian, 49%)

### Mythic

- **S**: Darkrai (SKILL, 72%)
- **A**: Shiny Hoopa (Striker, 58%), Shiny Mewtwo (Striker, 58%), Snorlax (Guardian, 57%), Hoopa (Striker, 55%)
- **B**: Jirachi (Striker, 51%), Mewtwo (Striker, 51%), Meloetta (Striker, 50%), Shiny Darkrai (SKILL, 50%), Lunala (SKILL, 50%), Shiny Kyogre (Guardian, 49%), Kyogre (Guardian, 49%)
- **C**: Solgaleo (Striker, 48%), Shiny Arceus (SKILL, 47%), Shiny Mew (SKILL, 46%), Arceus (SKILL, 46%), Shiny Cresselia (SKILL, 45%), Mew (SKILL, 45%), Cresselia (SKILL, 44%), Shiny Kyurem (SKILL, 44%), Deoxys (Guardian, 43%), Black Kyurem (SKILL, 43%)
- **D**: Wind-God Pidgeot (SKILL, 39%)

### Supreme

- **S**: Ho-Oh (Striker, 71%), Yveltal (SKILL, 61%)
- **A**: Groudon (Striker, 60%), Lugia (SKILL, 57%), Mimikyu (Striker, 55%), ★ Greninja (Striker, 53%)
- **B**: Shiny Raichu (Striker, 53%), Keldeo (Striker, 52%), Dialga (SKILL, 52%), Shiny Charizard (Striker, 52%), Xerneas (SKILL, 51%), Zygarde (Guardian, 49%)
- **C**: Infernape (SKILL, 48%), Giratina (Striker, 47%), ★ Shiny Blastoise (Guardian, 46%), Shiny God Ash-Pikachu (Striker, 46%), Celebi (SKILL, 45%), ★ God Ash-Pikachu (Striker, 45%), Victini (Guardian, 43%), Shiny Venusaur (SKILL, 43%)
- **D**: Palkia (Guardian, 43%), ★ Wobbuffet (Guardian, 42%), ★ Psyduck (SKILL, 41%), Rayquaza (SKILL, 39%), Shaymin (SKILL, 38%), Manaphy (SKILL, 38%), Shiny Gengar (SKILL, 37%)

## Findings (agent's reading — owner decides)
- **Base-kit check only.** Owner: the real meta is God Ash Pikachu, Wobbuffet, Greninja, Shiny Blastoise,
  Psyduck, Origin Lugia — *"its when they are maxed that things start to get crazy, like plates trinkets and
  a bunch of stuff we havent added yet"*. Without gear four of the six sit in the bottom half. The geared
  re-check (everything maxed) runs after the retrofit; it passes when those six come out on top.
- Fights average ~3.3 rounds — owner: the real game is about 3 too, except Wobbuffet mirrors.
- Dialga: rank 18 / 6 / 3 of 56 at HP ×1 / ×3 / ×6. Friend's version (Dialga + 2 allies): 20 / 9 / 7.
  Owner keeps the current Dialga ([owner changes](../decisions/kit-changes-2026-10-31.md)).
- Top: Zacian 77%, Darkrai 72% (best early/mid), Ho-Oh 71%. Bottom: Shiny Gengar, Manaphy, Shaymin,
  Wind-God Pidgeot, Rayquaza, Psyduck (37–41%).
- At equal star and level, quality barely changes stats; kits decide.
- Guardians score low on win rate (short fights hide soaking); Snorlax is the exception (57%).

No Pokémon numbers changed. Next in E6: every mode's difficulty curve.

## R10 geared re-check (2026-11-04)
Owner: "Auto best-by-power". `GEAR=max tsx scripts/balance/tier.ts max 50000` gives every Pokémon star 23 /
Lv340 / skills LV3, plates 18, trinket 40, and per layer the option with the highest power
(`scripts/balance/max-build.ts`): red soul-hearts at max stars (one set), the best held item × main stat with
max lines at max level, red +10 orbs, two max berries, Potential Lv6 in every tier.

| Meta six | Ungeared rank | Geared rank (win %) |
|---|---|---|
| Shiny Blastoise | 35 | **2** (70%) |
| Wobbuffet | 50 | **4** (66%) |
| Greninja | 15 | 13 (55%) |
| Origin Lugia | 12 | 19 (51%) |
| God Ash-Pikachu | 41 | 43 (45%) |
| Psyduck | 51 | 50 (40%) |

Top of the geared list: Darkrai 75%, Shiny Blastoise, Snorlax, Wobbuffet, Yveltal, Necrozma, Shiny Hoopa, Ho-Oh,
Zacian (77% → 59%). **Not a pass: two of the six reach the top.**

Finding (agent's reading): power counts flat stats only, so best-by-power gives **every** Pokémon the same kit
(Thunder soul-hearts, the same no-set orbs, two Bergamot Berries, Potential option 1 everywhere). The set bonuses,
orb sets, berry skills and Potential options that act through effects are invisible to it. Gear as picked mostly
adds bulk, which lifts the Guardians (Blastoise, Wobbuffet, Snorlax) and dilutes the burst Strikers. The four
that did not rise are the ones whose real builds lean on effects. Next step is the owner's: give the real builds
for the meta six (a per-species override would be added to `max-build.ts`), or keep this as the reading.
