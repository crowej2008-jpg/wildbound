# Pokémon Park

Tuning: `scripts/import-park.mjs` → `packages/content/tuning/park.json`. Needs the M16 guild; page `/pokemon-park`.

- Weekly season. Open Tuesday–Sunday, 09:00–21:00 UTC. Day resets at 09:00: 30 stamina, fainted Pokémon return.
- Enter any open grid; move to a neighbour (1 stamina). Grids collapse at 12:00, 16:00 and 19:00 by their phase list;
  standing on one moves you to a random open grid.
- Explore (1): wild Pokémon or an egg (equal weight; eggs only while the refresh's 4 remain and the 4-slot bag has room).
  Wild: fight (win = points × grid quality and a small reward; loss = the team faints for the day and leaves the park)
  or slip away (1 stamina). Eggs hatch in 30 minutes for shards, Berry Essence and points.
- Mythical boss: 12:15 and 19:15 UTC for 10 minutes; one HP bar that CPU players also hit; each attack is a 10-round
  battle (+50 points); first attack pays the join reward; the last hit wins the egg phase for your guild. After the
  window: attack-count rewards, fight-rank and score rewards, guild rank (1st with the last hit, else 10th).
- Season: points rank against CPU players; last season's rank pays the personal table.
