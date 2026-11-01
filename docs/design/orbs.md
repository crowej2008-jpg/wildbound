# Orbs (R3)

Copied from the source as far as it is recorded: `kb/orbs.md`, the owner's wiki (`/orbs`, `/orbs/sets`,
`/orbs/stats`) and `hero_orb_decompose_json`. The orb tables themselves (`hero_orb_basic`, `_suit`,
`_pos`) are not in the dumps; `scripts/gen-orbs.mjs` writes `packages/content/equipment/orbs.json` and
lists every stand-in. Replaces the M7/M11 stand-in "runes" (four sets of four, Orb Essence levelling).

## Rules
- 12 kinds in six twin pairs (same stats): defensive Sharp · Placating · Momentum · Pure · Mystique ·
  Erudite, offensive Leisure · Wonder · Fortune · Defensive · Quick · Etiquette. Each kind has two
  fixed lines and a pool of three % lines.
- 5 colours: green (+3 cap), blue (+5), purple (+7), orange (+10), red (+10). Green–purple carry the
  first fixed line and 1 % line; orange and red both fixed lines and 2 % lines. % lines are rolled once.
- Opens at player Lv 50; a Pokémon's sockets at 9★. 8 sockets = 2 rows × 4 gear pieces (Core, Cube,
  trinket slot, Wings); row 2 also needs Lv 240 (Origins skip it). Families per socket: piece 1 any /
  defensive, piece 2 defensive / offensive, piece 3 offensive / defensive, piece 4 any / offensive.
  Until Gear (R2) exists the sockets sit on the Pokémon.
- Levelling: 2 free copies (same kind, colour, level; not socketed, not locked) + Gold 10,000 … 1,000,000.
  Quick Upgrade fuses lower copies three into one first.
- 26 sets (8 + 8 three-kind, 5 + 5 five-kind). A set needs one orb of each of its kinds; an orb counts
  toward one set; the tier is the set's lowest orb level (3 / 5 / 7 / 10), tiers stack. Orb ATK / HP
  tiers scale only the orbs' own flat stats. Class tiers ("+15 % DMG Reduction vs [ATK]") are damage mods.
- Dismantle: Orb Essence by colour and level (green +1 = 1 … orange +10 = 1,458,000); red cannot.

## Stand-ins (owner 2026-11-01: build now, scale to +10)
- Flat stats: one colour (red) +1…+7 recorded; +8…+10 continue ×1.5; other colours scale by the kb's
  level-1 attack line (22 green … 125 red), geometric between.
- % lines: ceilings L × 0.8 % (DMG Boost / RDCT), L × 1.2 % (PVP / BOSS), others the best +7 roll ÷ 7;
  rolls land at 80–100 % of the ceiling; all colours share them.
- Which sets switch on when several fit: biggest first, then the highest lowest-level, then table order.
- BOSS lines are counted on the sheet; boss modes read them once R9 copies those modes.
