import { digItemRule, freedItems, initialDigSite, type AccountState } from '@wildbound/engine';
import type { GameConfig } from './config';
import { digGate, digRules } from './dig-site';

/**
 * Display-ready Dig Site view (M13.9). A cell shows what is under it only once its rock is gone, so the view
 * never gives away a buried item's place.
 */

export interface DigCellView {
  depth: number;
  /** Shown once the cell is cleared: bedrock, or the item lying there. */
  bedrock: boolean;
  item: { id: string; name: string; kind: string; free: boolean } | null;
}

export interface DigSiteView {
  unlocked: boolean;
  width: number;
  height: number;
  wall: { cells: DigCellView[]; shake: number; stability: number; over: boolean; collapsed: boolean; buried: number; free: number } | null;
  tools: { pick: number; hammer: number };
  fossils: { id: string; name: string; have: number; hours: number; gold: number }[];
  lab: ({ fossil: string; name: string; readyInMs: number } | null)[];
  museum: {
    groups: { id: string; name: string; pct: number; complete: boolean; pieces: { id: string; name: string; shown: boolean; stored: number; hp: number; atk: number }[] }[];
    shown: number;
    total: number;
  };
  spares: number;
  gold: number;
  soulHeartExp: number;
}

export function buildDigSiteView(config: GameConfig, state: AccountState, now: number): DigSiteView {
  const rules = digRules(config);
  const t = config.digSite;
  const site = state.digSite ?? initialDigSite(t.labSlots);
  const nameOf = (id: string) => digItemRule(rules, id)?.name ?? id;
  let wall: DigSiteView['wall'] = null;
  if (site.wall) {
    const w = site.wall;
    const rock = new Set(w.bedrock);
    const free = new Set(freedItems(w).map((i) => i));
    const at = new Map<number, (typeof w.items)[number]>();
    for (const item of w.items) for (const c of item.cells) at.set(c, item);
    wall = {
      cells: w.depth.map((depth, c) => {
        const item = at.get(c);
        const rule = item ? digItemRule(rules, item.id) : undefined;
        const clear = depth === 0 || rock.has(c);
        return {
          depth: rock.has(c) ? 0 : depth,
          bedrock: rock.has(c) && (clear || w.over),
          item: item && rule && (depth === 0 || w.over) ? { id: rule.id, name: rule.name, kind: rule.kind, free: free.has(item) } : null,
        };
      }),
      shake: w.shake,
      stability: rules.stability,
      over: w.over,
      collapsed: w.collapsed,
      buried: w.items.length,
      free: free.size,
    };
  }
  const shown = new Set(site.museum);
  let spares = 0;
  for (const [id, n] of Object.entries(site.storage)) spares += shown.has(id) ? n : Math.max(0, n - 1);
  return {
    unlocked: digGate(config, state, now),
    width: rules.width,
    height: rules.height,
    wall,
    tools: { pick: rules.tools.pick.shake, hammer: rules.tools.hammer.shake },
    fossils: t.cure.map((c) => ({ id: c.fossil, name: nameOf(c.fossil), have: site.fossils[c.fossil] ?? 0, hours: c.hours, gold: c.gold })),
    lab: site.lab.map((s) => (s ? { fossil: s.fossil, name: nameOf(s.fossil), readyInMs: Math.max(0, s.readyAt - now) } : null)),
    museum: {
      groups: t.groups.map((g) => {
        const pieces = t.pieces
          .filter((p) => p.group === g.id)
          .map((p) => ({ id: p.id, name: nameOf(p.id), shown: shown.has(p.id), stored: site.storage[p.id] ?? 0, hp: p.hp, atk: p.atk }));
        return { id: g.id, name: g.name, pct: g.pct, complete: pieces.every((p) => p.shown), pieces };
      }),
      shown: site.museum.length,
      total: t.pieces.length,
    },
    spares,
    gold: state.currencies.gold,
    soulHeartExp: state.currencies.soulHeartExp ?? 0,
  };
}
