# Source retrofit close-out (R10, 2026-11-04)

The snapshot after R1–R9: what now comes from the source, what is still a stand-in and what each stand-in waits
for. Numbers in `docs/ASSUMPTIONS.md` (#50–#91); per-system pages in `wiki/systems/`.

## Copied from the source

| Area | What | Where |
|---|---|---|
| Growth | Stars, evolution lines, star fodder, shards per Pokémon, base stats and classes, level caps (340, then Resonance) | R1, #50–#54 |
| Held items | Items, main stats, line pools, levels, refine | R5, #56–#57 |
| Orbs | 12 kinds, 5 colours, 26 sets, sockets, levelling, dismantle | R3, #65 |
| Potential | Per-species trees, costs, options | R4, #64 |
| Plates, trinkets, soul-hearts, berries | Stages and skills, trinket levels 0–40, soul-heart sets and stars, berries and breakthroughs | R6a–R6d, #66–#70 |
| Resonance, VIP, titles, Trainer Tokens | All tables | R7–R8, #71–#74 |
| Dailies | Daily quests, Sign In | R9, #75–#76 |
| Modes | Daily dungeons, Pokémon Tower, World Boss (owner changes), Sky Pillar floors / pays / conditions / chests | R9, #78–#80, #88 |
| Economy | Summoning (shown odds, duplicates), the Bag, six shops, Arena and Ranked reward tables, Campaign idle rates, Pet Home | R9, #83–#87, #89 |

## Still stand-ins (and what each waits for)

| Stand-in | Waits for |
|---|---|
| Enemies in Campaign, Tower, daily dungeons, Sky Pillar; Campaign first-clear / repeat rewards; Tower floor pay | The per-stage / monster rows (not in the dumps) |
| Trainer XP curve (cap 80), so content gated above Lv 80 is unreachable | The source's trainer-XP table |
| Level-up candy / gold curve | The per-level cost table |
| Per-species milestone stat rows and talent stat bonuses (count as 0) | `hero_upstage_attr_json` |
| Orb flat stats above +7, % line ceilings | `hero_orb_basic_json` |
| Arena credit ladder, weekly bands, opponents; Ranked weather | The score and rank-reward tables |
| Summoning: server-side odds (the shown odds are used); the Premium multi-draw size | Not recorded in `reference/` |
| Shop draw weights (uniform) | Not in the dumps |
| Pet Home income step (5 s) and board layout | Not in the source table |
| Held-item album, soul-heart feeding and EXP items, berry line kinds | Their tables / later steps |

## Owner departures (deliberate)

World Boss drops, VIP 14 skip and an unkillable boss (#80); Trials removed (#81); kit changes (#59–#60); DEF on
(#69); fashion stats made up, no set skills; summon-pool Pokémon (#82).

## Balance readings

- **Cost curves:** R1–R9 replaced the M11.12 authored curves with the source's tables; nothing was retuned in R10.
- **Tier list (#90–#91):** maxed and geared on the owner's wiki builds (others copy Wobbuffet's or God
  Ash-Pikachu's), 50,000 battles: Necrozma 60 %, Zacian 54 %, Dialga 53 %, Wobbuffet 53 %; most of the field sits in
  48–53 %. The meta-six check does not pass; four of the six have Mechas in the source, which Wildbound does not
  have, and the Relic slot (Artifacts) is deferred. See `wiki/systems/e6-tier-list.md`.
- **Mode difficulty curves:** moved to after M21 (owner 2026-11-04).

## Checks

Unit tests, `content:validate` and the Playwright e2e suite run in CI on every push; the last R9/R10 pushes are
green. Known flake: `tests/e2e/bag.spec.ts` (Selectable Precious Giftbox) failed once and passed on rerun.
