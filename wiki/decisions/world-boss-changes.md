---
title: World Boss — drops, skip and an unkillable boss
type: decision
date: 2026-11-01
status: active
sources: [owner in Claude chat 2026-11-01, docs/ASSUMPTIONS.md #80]
---

# World Boss changes (2026-11-01)

Owner: *"make the drop reawrds five star shards and add the vip 14 perk and make the boss really strong"*,
then *"and the boss shouldnt be able to die"*.

- Every fight drops 5-Star Pokémon Shards ×15 (the amount the source's boss screen shows).
- Skip to end on the boss fight needs VIP 14 (source fight_basic dtype 12).
- The boss fights at its top star and level with HP ×200, Attack ×4, DEF ×3 (`pve.json` worldBoss.boss) and is
  held at 1 HP; every fight runs its rounds and scores its damage.
