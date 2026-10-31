---
title: Visual identity pass
type: system
milestone: M18
status: pending
updated: 2026-10-31
sources: [opencode-session-2026-10 msgs 53-58, docs/design/art.md]
---

# Visual identity pass (M18)

- **Sprites:** today creatures are procedural SVG portraits. Raster sprites can go in
  `packages/client/public/art/` ([IP guard allowance](../decisions/ip-guard-and-art.md)). The agent
  won't draw recognisable Pokémon; real sprites must be supplied by the owner. Planned pipeline:
  manifest → `spriteFor(id, stage)` → `<img>` with SVG fallback.
- **UI:** match the source's visual language from `reference/game-rebuild/ui-kit.md` + screenshots —
  palette `#F8A838` orange, `#58C8C8` teal, `#F8E868` yellow, `#58B8F8` sky; skewed buttons; hexagon
  battle bar; teal modal headers; currency pills; red-dot badges; big italic Power numbers.
- **Battle effects:** projectiles, bursts, freeze/shield/heal, crit pops, ult cut-ins — driven by the
  existing event log.
- Owner ideas: "more skins" ([change list](../ideas/change-list-2026-10.md)).
- Related owner project outside this repo: the "Rig Gallery" artifact of animated Pokémon rigs he
  wants for the remake.
