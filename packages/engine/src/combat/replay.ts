import type { BattleEvent } from './types';

/**
 * Replay of a recorded battle log (M4). Pure and content-free: the UI folds the
 * immutable `BattleEvent[]` a battle already produced into per-frame visual
 * state, so a recorded fight always replays identically. See docs/design/battle-ui.md.
 */

export interface ReplayUnit {
  key: string;
  side: 'attackers' | 'defenders';
  position: number;
  hp: number;
  maxHp: number;
  shield: number;
  rage: number;
  alive: boolean;
  /** Active buff/status tags, best-effort from applied/expired events. */
  buffs: string[];
}

export interface ReplayState {
  round: number;
  winner: 'attackers' | 'defenders' | null;
  units: ReplayUnit[];
}

export function initReplay(units: ReplayUnit[]): ReplayState {
  return { round: 0, winner: null, units: units.map((u) => ({ ...u, buffs: [...u.buffs] })) };
}

function mapUnit(state: ReplayState, key: string, fn: (u: ReplayUnit) => ReplayUnit): ReplayState {
  let changed = false;
  const units = state.units.map((u) => {
    if (u.key !== key) return u;
    changed = true;
    return fn(u);
  });
  return changed ? { ...state, units } : state;
}

/** Fold a single event into the replay state (immutable). */
export function stepReplay(state: ReplayState, event: BattleEvent): ReplayState {
  switch (event.type) {
    case 'roundStart':
      return { ...state, round: event.bigRound };
    case 'result':
      return { ...state, winner: event.winner };
    case 'hit':
    case 'reflect':
      return mapUnit(state, event.tgt, (u) => ({ ...u, hp: event.hpAfter, alive: event.hpAfter > 0 }));
    case 'heal':
      return mapUnit(state, event.tgt, (u) => ({ ...u, hp: event.hpAfter }));
    case 'shield':
      return mapUnit(state, event.tgt, (u) => ({ ...u, shield: event.shieldAfter }));
    case 'rageChange':
      return mapUnit(state, event.unit, (u) => ({ ...u, rage: event.rage }));
    case 'death':
      return mapUnit(state, event.unit, (u) => ({ ...u, hp: 0, alive: false }));
    case 'buffApplied':
      return mapUnit(state, event.unit, (u) => ({ ...u, buffs: addTag(u.buffs, event.tag) }));
    case 'buffExpired':
      return mapUnit(state, event.unit, (u) => ({ ...u, buffs: u.buffs.filter((t) => t !== event.tag) }));
    case 'immunity':
      return mapUnit(state, event.unit, (u) => ({ ...u, buffs: addTag(u.buffs, 'immune') }));
    default:
      return state;
  }
}

/** Fold the first `count` events (used for scrubbing / step-back). */
export function replayTo(units: ReplayUnit[], events: BattleEvent[], count: number): ReplayState {
  let state = initReplay(units);
  const upto = Math.min(Math.max(0, count), events.length);
  for (let i = 0; i < upto; i += 1) {
    const event = events[i];
    if (event) state = stepReplay(state, event);
  }
  return state;
}

/** The unit that just acted at `index` (hit src / action / rage unit), if any. */
export function lastActor(events: BattleEvent[], index: number): string | null {
  const event = events[index];
  if (!event) return null;
  switch (event.type) {
    case 'action':
    case 'rageChange':
    case 'buffApplied':
    case 'buffExpired':
    case 'immunity':
    case 'death':
      return event.unit;
    case 'hit':
    case 'reflect':
      return event.src;
    case 'heal':
    case 'shield':
    case 'control':
      return event.tgt;
    default:
      return null;
  }
}

/** The unit just affected at `index` (hit / heal / shield / control target), if any. */
export function lastTarget(events: BattleEvent[], index: number): string | null {
  const event = events[index];
  if (!event) return null;
  switch (event.type) {
    case 'hit':
    case 'reflect':
    case 'heal':
    case 'shield':
    case 'control':
      return event.tgt;
    default:
      return null;
  }
}

function addTag(tags: string[], tag: string): string[] {
  return tags.includes(tag) ? tags : [...tags, tag];
}
