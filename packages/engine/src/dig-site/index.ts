import { mulberry32 } from '../rng';

/**
 * Dig Site (M13.9, the owner's replacement for the Ultra Wormhole). A wall of layered rock hides shaped items and
 * undiggable bedrock; the pick and the hammer wear rock away and shake the wall; when the shake reaches the
 * wall's stability it collapses and only fully uncovered items are kept. Walls are free and unlimited (the main
 * series' rule). Fossils are cured in a timed lab and, with treasures, shown in a museum for account stats.
 * Pure: the tuning and the seed are arguments. See docs/design/dig-site.md.
 */

export type DigTool = 'pick' | 'hammer';
export type DigItemKind = 'soulHeart' | 'exp' | 'fossil' | 'treasure';

export interface DigItemRule {
  id: string;
  name: string;
  kind: DigItemKind;
  weight: number;
  shape: number[][];
  quality?: 'blue' | 'purple' | 'orange' | 'red';
  exp?: number;
}

export interface DigToolRule {
  center: number;
  edge: number;
  diagonal: number;
  shake: number;
}

export interface DigRules {
  width: number;
  height: number;
  depthMin: number;
  depthMax: number;
  stability: number;
  tools: Record<DigTool, DigToolRule>;
  itemsMin: number;
  itemsMax: number;
  bedrockMin: number;
  bedrockMax: number;
  bedrock: number[][][];
  items: DigItemRule[];
}

export interface BuriedItem {
  id: string;
  cells: number[];
}

export interface DigWall {
  seed: number;
  /** Rock left on each cell (row-major), 0 = cleared. */
  depth: number[];
  /** Cells holding bedrock (never dug). */
  bedrock: number[];
  items: BuriedItem[];
  shake: number;
  /** True once collapsed or finished. */
  over: boolean;
  collapsed: boolean;
}

function pickWeighted<T extends { weight: number }>(rng: () => number, rows: readonly T[]): T {
  const total = rows.reduce((s, r) => s + r.weight, 0);
  let x = rng() * total;
  for (const r of rows) if ((x -= r.weight) < 0) return r;
  return rows[rows.length - 1]!;
}

function place(rules: DigRules, rng: () => number, taken: Set<number>, shape: number[][]): number[] | null {
  const w = Math.max(...shape.map(([x]) => x!)) + 1;
  const h = Math.max(...shape.map(([, y]) => y!)) + 1;
  for (let tries = 0; tries < 60; tries += 1) {
    const ox = Math.floor(rng() * (rules.width - w + 1));
    const oy = Math.floor(rng() * (rules.height - h + 1));
    const cells = shape.map(([x, y]) => (oy + y!) * rules.width + ox + x!);
    if (cells.every((c) => !taken.has(c))) {
      for (const c of cells) taken.add(c);
      return cells;
    }
  }
  return null;
}

/** A fresh wall from a seed: layered rock, bedrock, and 2–4 buried items. */
export function newWall(rules: DigRules, seed: number): DigWall {
  const rng = mulberry32(seed >>> 0);
  const span = rules.depthMax - rules.depthMin + 1;
  const depth = Array.from({ length: rules.width * rules.height }, () => rules.depthMin + Math.floor(rng() * span));
  const taken = new Set<number>();
  const items: BuriedItem[] = [];
  const count = rules.itemsMin + Math.floor(rng() * (rules.itemsMax - rules.itemsMin + 1));
  for (let i = 0; i < count; i += 1) {
    const rule = pickWeighted(rng, rules.items);
    const cells = place(rules, rng, taken, rule.shape);
    if (cells) items.push({ id: rule.id, cells });
  }
  const bedrock: number[] = [];
  const rocks = rules.bedrockMin + Math.floor(rng() * (rules.bedrockMax - rules.bedrockMin + 1));
  for (let i = 0; i < rocks; i += 1) {
    const shape = rules.bedrock[Math.floor(rng() * rules.bedrock.length)]!;
    const cells = place(rules, rng, taken, shape);
    if (cells) bedrock.push(...cells);
  }
  return { seed, depth, bedrock: bedrock.sort((a, b) => a - b), items, shake: 0, over: false, collapsed: false };
}

/** An item is free once every cell it covers is cleared. */
export function itemFree(wall: DigWall, item: BuriedItem): boolean {
  return item.cells.every((c) => wall.depth[c] === 0);
}

export function freedItems(wall: DigWall): BuriedItem[] {
  return wall.items.filter((i) => itemFree(wall, i));
}

/** Strike the wall at (x, y). Bedrock takes no wear. Collapses when the shake reaches the stability. */
export function strike(rules: DigRules, wall: DigWall, tool: DigTool, x: number, y: number): DigWall {
  if (wall.over || x < 0 || y < 0 || x >= rules.width || y >= rules.height) return wall;
  const t = rules.tools[tool];
  const rock = new Set(wall.bedrock);
  const depth = [...wall.depth];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const cx = x + dx;
      const cy = y + dy;
      if (cx < 0 || cy < 0 || cx >= rules.width || cy >= rules.height) continue;
      const cell = cy * rules.width + cx;
      if (rock.has(cell)) continue;
      const wear = dx === 0 && dy === 0 ? t.center : dx === 0 || dy === 0 ? t.edge : t.diagonal;
      depth[cell] = Math.max(0, depth[cell]! - wear);
    }
  }
  const shake = Math.min(rules.stability, wall.shake + t.shake);
  const next: DigWall = { ...wall, depth, shake };
  const allFree = next.items.length > 0 && next.items.every((i) => itemFree(next, i));
  if (shake >= rules.stability) return { ...next, over: true, collapsed: true };
  if (allFree) return { ...next, over: true };
  return next;
}

/** Stop digging (keeping what is free). */
export function leaveWall(wall: DigWall): DigWall {
  return wall.over ? wall : { ...wall, over: true };
}

export function digItemRule(rules: DigRules, id: string): DigItemRule | undefined {
  return rules.items.find((i) => i.id === id);
}

/** The account's Dig Site: the wall in progress, raw fossils, the curing lab, stored pieces and the museum. */
export interface DigSiteState {
  wall: DigWall | null;
  /** Walls started (seeds the next wall). */
  walls: number;
  /** Raw fossils waiting to be cured. */
  fossils: Record<string, number>;
  /** Lab slots: a fossil curing until `readyAt` (epoch ms). */
  lab: ({ fossil: string; readyAt: number } | null)[];
  /** Cured fossils and treasures not yet displayed (or spare copies). */
  storage: Record<string, number>;
  /** Pieces on display in the museum (one of each). */
  museum: string[];
}

export function initialDigSite(labSlots: number): DigSiteState {
  return { wall: null, walls: 0, fossils: {}, lab: Array.from({ length: labSlots }, () => null), storage: {}, museum: [] };
}
