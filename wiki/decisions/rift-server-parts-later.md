---
title: Rift Arena — server-wide parts wait for the shared backend
type: decision
date: 2026-11-04
status: active
sources: [owner in Claude chat 2026-11-04]
---

# Rift Arena: server-wide parts later (2026-11-04)

The source's New Rift Arena (`underground_new_*`) is cross-server. Asked about the three server-wide parts
(the Advanced ranking against other players, the Easy track's server "weakness" when players on the server
beat a floor boss, and the level sync), the owner said: *"ya just set them for server stuff but dont have that
a thing yet"*.

Reading:
- **Advanced ranking** (highest floor, then clear time; rank rewards by mail) and the **weakness** mechanic
  (`underground_new_weakness_json`: −10 % … −50 % HP / ATK on a boss's floor range once 5 / 15 / 25 / 35 / 45
  players pass it) are **server features**: keep their data and hooks, build them with the shared backend
  (M19). Until then the Advanced track is played unranked and the Easy track has no weakness.
- **Level sync** is not a server feature and stays as in the source.

Later the same day the owner added: *"im not gonna release the game to my friends most likely and ill just play it
by myself with cpus that are scaling but we will do that when it comes to it"*. So the server-wide parts may end
up as scaling CPU trainers instead of a shared backend; M19's "required" backend is to be revisited then.
