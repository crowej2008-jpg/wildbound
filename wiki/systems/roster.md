---
title: Roster (84 Pokémon)
type: system
milestone: M2, replaced 2026-10-15, source ladders R1
status: built
updated: 2026-10-31
sources: [docs/design/roster-import.md, docs/ASSUMPTIONS.md override #4-8, opencode-session-2026-10 msg 36]
---

# Roster (84 Pokémon)

- **84 species ↔ 84 kits** in `packages/content/{species,kits}/<faction>.json`. Since **R1** (2026-10-31)
  everything except the owner's ids, names, descriptions, portrait seeds and kits is copied from the
  source by `scripts/import-species.mjs` (map: `scripts/data/source-hero-map.json`).
- **Factions (5, the source's):** water 18 · fire 18 · grass 19 · light 15 · dark 14. (Before R1 there
  were six invented ones: ember/tide/grove/volt/frost/shade.)
- **Classes:** the source's career — ATK (`striker`), DEF (`guardian`), SKILL (`adept`).
- **Quality:** rare · epic · legendary · supreme · mythic · **origin** (the 6 Origins).
- **Stars:** each species has the source's star ladder (e.g. Darkrai 5★–23★, Starmie 3★–7★). Each star
  card gives the form name (Beldum → Metang → Metagross), level cap (60…340), stats and the fodder for
  the next star. New copies start at the first star. **Evolve** = +1 star, consuming fodder.
- **Stats:** HP/ATK = basic + level × growth (P.ATK = S.ATK), DEF = level × growth, SPD = basic; each card
  also has a 25 % "DMG BST to [faction]".
- **Shards:** 30 / 40 / 50 per copy (imported; composing arrives with R9).
- **Skills:** all 84 ported faithfully in M9 — see [skill kits](skill-kits.md).

## Who's in it (by shipped tier, from the species JSON on 2026-10-31)
- **Mythic (29):** Necrozma, Origin Lugia, Origin Rayquaza, Shadow Mewtwo, Black Kyurem, Calyrex,
  Zacian, Arceus, Wind-God Pidgeot, Kyogre, Hoopa, Mewtwo, Mew, Darkrai, Cresselia, Jirachi,
  Solgaleo, Lunala, Deoxys, Meloetta, Snorlax, and shiny Kyogre, Cresselia, Mewtwo, Darkrai, Kyurem,
  Hoopa, Mew, Arceus.
- **Supreme (27):** Yveltal, Xerneas, Giratina, Zygarde, Palkia, Dialga, Ho-Oh, Groudon, Rayquaza,
  Lugia, Victini, Shaymin, Celebi, Keldeo, Manaphy, Infernape, Greninja, Mimikyu, Wobbuffet, Psyduck,
  God Ash-Pikachu, and shiny Charizard, Gengar, Venusaur, Raichu, Blastoise, God Ash-Pikachu.
- **Legendary (6):** Entei, Suicune, Raikou, Moltres, Articuno, Zapdos.
- **Epic (16):** Gyarados, Blaziken, Swampert, Sceptile, Typhlosion, Feraligatr, Meganium, Dragonite,
  Metagross, Garchomp, Hydreigon, Gardevoir, Slaking, Tyranitar, Salamence, Gengar.
- **Rare (6):** Charizard, Raichu, Starmie, Blastoise, Ninetales, Venusaur.

The definitive list is the species JSON; the owner's wiki is pokemon-wiki-sandy.vercel.app.

Related: [roster override](../decisions/pokemon-roster-override.md), [summoning](summoning-and-shops.md).
