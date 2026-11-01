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

Tiers within each quality at max: S ≥60%, A 53–60, B 48–53, C 43–48, D <43.

### Origin

- **S**: Zacian (Striker, 77%), Necrozma (SKILL, 62%)
- **A**: Shadow Mewtwo (Striker, 59%), Origin Lugia (Guardian, 56%)
- **B**: Origin Rayquaza (SKILL, 50%), Calyrex (Guardian, 49%)

### Mythic

- **S**: Darkrai (SKILL, 72%)
- **A**: Shiny Hoopa (Striker, 58%), Shiny Mewtwo (Striker, 58%), Snorlax (Guardian, 57%), Hoopa (Striker, 55%)
- **B**: Jirachi (Striker, 51%), Mewtwo (Striker, 51%), Meloetta (Striker, 50%), Shiny Darkrai (SKILL, 50%), Lunala (SKILL, 50%), Shiny Kyogre (Guardian, 49%), Kyogre (Guardian, 49%)
- **C**: Solgaleo (Striker, 48%), Shiny Arceus (SKILL, 47%), Shiny Mew (SKILL, 46%), Arceus (SKILL, 46%), Shiny Cresselia (SKILL, 45%), Mew (SKILL, 45%), Shiny Kyurem (SKILL, 44%), Cresselia (SKILL, 44%), Deoxys (Guardian, 43%), Black Kyurem (SKILL, 43%)
- **D**: Wind-God Pidgeot (SKILL, 39%)

### Supreme

- **S**: Ho-Oh (Striker, 71%), Yveltal (SKILL, 61%)
- **A**: Groudon (Striker, 60%), Lugia (SKILL, 57%), Mimikyu (Striker, 55%), Greninja (Striker, 53%)
- **B**: Shiny Raichu (Striker, 53%), Keldeo (Striker, 52%), Dialga (SKILL, 52%), Shiny Charizard (Striker, 52%), Xerneas (SKILL, 51%), Zygarde (Guardian, 49%)
- **C**: Infernape (SKILL, 47%), Giratina (Striker, 47%), Shiny Blastoise (Guardian, 46%), Shiny God Ash-Pikachu (Striker, 46%), Celebi (SKILL, 45%), God Ash-Pikachu (Striker, 45%), Victini (Guardian, 43%), Shiny Venusaur (SKILL, 43%)
- **D**: Palkia (Guardian, 43%), Wobbuffet (Guardian, 42%), Psyduck (SKILL, 41%), Rayquaza (SKILL, 39%), Shaymin (SKILL, 38%), Manaphy (SKILL, 38%), Shiny Gengar (SKILL, 37%)

## Findings (agent's reading — owner decides)
- Fights average ~3.3 rounds; most Pokémon ult about once. Favours burst over Rage builders/healers.
- Dialga: rank 18 / 5 / 3 of 56 at HP ×1 / ×3 / ×6. Friend's version (Dialga + 2 allies): 19 / 9 / 7.
  Owner keeps the current Dialga ([owner changes](../decisions/kit-changes-2026-10-31.md)).
- Top: Zacian 77%, Darkrai 72% (best early/mid), Ho-Oh 71%. Bottom: Shiny Gengar, Manaphy, Shaymin,
  Wind-God Pidgeot, Rayquaza, Psyduck (37–41%).
- At equal star and level, quality barely changes stats; kits decide.
- Guardians score low on win rate (short fights hide soaking); Snorlax is the exception (57%).

No Pokémon numbers changed. Next in E6: every mode's difficulty curve.
