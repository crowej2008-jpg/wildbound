import { mulberry32 } from '../rng';
import type { MistyFloorRule, MistyHelper, MistyNode, MistyRules, MistyState, MistyTile } from './types';

export * from './types';

export type MistyError = 'node_missing' | 'not_reachable' | 'chapter_locked' | 'no_team' | 'not_hire' | 'no_fallen' | 'bad_pick';

const DAY = 86_400_000;

/** The 2-day cycle a moment falls in (counted from the Unix epoch, UTC midnights). */
export function mistyCycle(rules: MistyRules, now: number): number {
  return Math.floor(Math.floor(now / DAY) / rules.cycleDays);
}

export function mistyCycleEndsIn(rules: MistyRules, now: number): number {
  return (mistyCycle(rules, now) + 1) * rules.cycleDays * DAY - now;
}

export function startNode(rules: MistyRules, chapter: number): MistyNode {
  return rules.nodes.find((n) => n.chapter === chapter && n.tiles.includes('start'))!;
}

/** Roll one kind for every multi-kind node (deterministic per cycle). */
export function rollTiles(rules: MistyRules, cycle: number): Record<string, MistyTile> {
  const rng = mulberry32((cycle * 2654435761) >>> 0);
  const out: Record<string, MistyTile> = {};
  for (const n of rules.nodes) if (n.tiles.length > 1) out[String(n.id)] = n.tiles[Math.floor(rng() * n.tiles.length)]!;
  return out;
}

export function initialMisty(rules: MistyRules, now: number): MistyState {
  const cycle = mistyCycle(rules, now);
  return {
    cycle,
    chapter: 1,
    at: startNode(rules, 1).id,
    done: [],
    rolled: rollTiles(rules, cycle),
    hp: {},
    rage: {},
    fallen: [],
    helpers: [],
    hireOffer: null,
    paid: [],
    chaptersCleared: [],
  };
}

/** A new cycle resets the whole run. */
export function rollMisty(rules: MistyRules, state: MistyState, now: number): MistyState {
  return state.cycle === mistyCycle(rules, now) ? state : initialMisty(rules, now);
}

export function tileOf(state: MistyState, node: MistyNode): MistyTile {
  return state.rolled[String(node.id)] ?? node.tiles[0]!;
}

/** Nodes the team can step to from where it stands. */
export function reachable(rules: MistyRules, state: MistyState): MistyNode[] {
  return rules.nodes.filter((n) => n.chapter === state.chapter && n.pre.includes(state.at) && !state.done.includes(n.id));
}

export function floorRule(rules: MistyRules, chapter: number, floor: number): MistyFloorRule | undefined {
  return rules.floors.find((f) => f.chapter === chapter && f.floor === floor);
}

/** Can the team step onto this node? (chapter 4 also needs its campaign stage, checked by the server). */
export function stepBlock(rules: MistyRules, state: MistyState, nodeId: number): MistyError | null {
  const node = rules.nodes.find((n) => n.id === nodeId);
  if (!node) return 'node_missing';
  if (!reachable(rules, state).some((n) => n.id === nodeId)) return 'not_reachable';
  return null;
}

/** Move onto a resolved node; the boss node also clears the chapter and opens the next one. */
export function arrive(rules: MistyRules, state: MistyState, node: MistyNode): MistyState {
  const moved: MistyState = { ...state, at: node.id, done: [...state.done, node.id], hireOffer: null };
  if (tileOf(state, node) !== 'boss' || node.floor < 11) return moved;
  const cleared = [...moved.chaptersCleared, node.chapter];
  const next = node.chapter + 1;
  if (next > 4) return { ...moved, chaptersCleared: cleared };
  return { ...moved, chaptersCleared: cleared, chapter: next, at: startNode(rules, next).id };
}

/** After a fight: record each fielded unit's HP / Rage; the knocked out fall. */
export function recordFight(
  state: MistyState,
  units: { id: string; hpFraction: number; rage: number; alive: boolean }[],
): MistyState {
  const hp = { ...state.hp };
  const rage = { ...state.rage };
  const fallen = new Set(state.fallen);
  for (const u of units) {
    if (u.alive) {
      hp[u.id] = Math.max(0.01, Math.min(1, u.hpFraction));
      rage[u.id] = u.rage;
    } else {
      fallen.add(u.id);
      delete hp[u.id];
      delete rage[u.id];
    }
  }
  return { ...state, hp, rage, fallen: [...fallen] };
}

/** First-win floor pay for a node, once per floor per cycle. */
export function floorPay(rules: MistyRules, state: MistyState, node: MistyNode): { state: MistyState; forestCoin: number; gems: number } {
  const key = `${node.chapter}:${node.floor}`;
  const rule = floorRule(rules, node.chapter, node.floor);
  if (!rule || state.paid.includes(key)) return { state, forestCoin: 0, gems: 0 };
  return { state: { ...state, paid: [...state.paid, key] }, forestCoin: rule.forestCoin, gems: rule.gems };
}

/** Fountain: every living unit heals by `fountainHeal` of max HP. */
export function fountain(rules: MistyRules, state: MistyState): MistyState {
  const hp: Record<string, number> = {};
  for (const [id, f] of Object.entries(state.hp)) hp[id] = Math.min(1, f + rules.fountainHeal);
  return { ...state, hp };
}

/** Revive one fallen unit at `reviveHp` (tombstone or the shop). */
export function revive(rules: MistyRules, state: MistyState, id: string): { ok: true; state: MistyState } | { ok: false; error: MistyError } {
  if (!state.fallen.includes(id)) return { ok: false, error: 'no_fallen' };
  return {
    ok: true,
    state: { ...state, fallen: state.fallen.filter((f) => f !== id), hp: { ...state.hp, [id]: rules.reviveHp } },
  };
}

/** Full heal of every living unit (the shop). */
export function healAll(state: MistyState): MistyState {
  const hp: Record<string, number> = {};
  for (const id of Object.keys(state.hp)) hp[id] = 1;
  return { ...state, hp };
}

/** Hire one of the offered helpers (it joins at full HP). */
export function hire(state: MistyState, speciesId: string, level: number, stars: number): { ok: true; state: MistyState } | { ok: false; error: MistyError } {
  if (!state.hireOffer) return { ok: false, error: 'not_hire' };
  if (!state.hireOffer.includes(speciesId)) return { ok: false, error: 'bad_pick' };
  const helper: MistyHelper = { id: `helper-${state.helpers.length + 1}`, speciesId, level, stars };
  return { ok: true, state: { ...state, helpers: [...state.helpers, helper], hireOffer: null } };
}
