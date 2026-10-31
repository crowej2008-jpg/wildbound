---
title: Combat numbers — measured vs open (E5)
type: system
milestone: E5
status: checked 2026-10-31
updated: 2026-10-31
sources: [reference/game-rebuild/kb/stats-and-combat.md, packages/content/tuning/combat.json]
---

# Combat numbers — measured vs open (E5, 2026-10-31)

Every named setting in `tuning/combat.json` checked against the research notes (`kb/stats-and-combat.md`).

## Changed in E5 (the notes answer them)
| Setting / rule | Was | Now | Evidence |
|---|---|---|---|
| `tpSymmetric` (team-Power cut on the defending side too) | false | **true** | "a weaker opponent's hits on us rose the same way when our Power fell" |
| Block INT side | attacker's | **blocker's** (size still open, `blockIntScale` 0) | Block INT is a tank line (held items, orbs, talents) |
| Counter reflect | absorbed by shields | **passes shields** | 124,772 target hits: "it passes shields, never crits, ignores blocks" |
| Wobbuffet's Counter | sheet 50% (E3 port) | **75%** of last round's HP lost | "the stone-18 text says 80%; the server deals 75%" |
| Ranked rival curve `baseLevel` | 12 | **16** | re-measured after the symmetric team cut: entry 0.50, mid 1.00, strong 0.00, maxed 0.61 |

## Already matching the notes (no change)
Time-out to the defender at 15 rounds · turn order by SPD re-sorted each round · Rage 1,000 / start 500 /
+250 per action / 125 + share on hit · crit floor 3%, slope 1.2, multiplier max(1.2, 1.2 + Crit INT − ½ Crit
Res) (× 1.59 in PvE comes out of the same formula) · block curve over Block − Guard Break, kept ≤ 80% ·
G = 1 + Boost − RDCT and P = 1 + PvP BST − PvP RDCT (c = 0: the 12% is the defender's "steady") · Ult
DMG↑/RED own factor · soul factor 0.266 / 80,000 · max-HP-share damage ignores RDCT · DEF does nothing ·
weather +30% · controls chance × (1 − (Res − Boost)) · crit and block independent.

## Still open (the notes don't settle them) — and the test that would
| Question | Current setting | Test |
|---|---|---|
| Faction bonus: a Water defender took × 1.43 of a Grass one (25% + about × 1.14 unexplained) | 25% inside G | same attacker, two defenders differing only in faction, attacker with and without the bonus |
| Defender class: DEF 1.00 · ATK × 1.113 · SKILL × 1.174 (one attacker, which had 9.4% vs DEF) | no class term (`classMult` empty) | repeat with attackers of each class and no class-targeted bonus |
| How much Block INT cuts a blocked hit (kept 0.62–0.80 by attacker) | 0 (kept = 80%) | one blocker, Block INT on / off, same attacker |
| Where the team-Power cut starts (between 66% and 77%) | 0.70 | one attacker's Power raised with HP-only items against a fixed stronger team |
| Floors under G and P | 0.1 / 0.1 (never reached in measurements) | a weak attacker against a very high DMG RDCT tank |
| Heal basis for "heals X%" without a stated basis | target max HP | a healer with S.ATK raised and HP unchanged |
| Turn-order ties; when durations tick | attackers first; end of own turn | fight logs with equal SPD units / 1-turn buffs |
