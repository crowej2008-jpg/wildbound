import {
  ORB_SOCKETS,
  activeOrbSets,
  canSocket,
  emptyLoadout,
  equipOrb,
  orbColour,
  orbDismantleEssence,
  orbFlat,
  orbKind,
  orbLevelGold,
  orbLineValue,
  rollOrb,
  socketFamily,
  socketOpen,
  type AccountState,
  type OrbColour,
  type OrbFamily,
  type OrbInstance,
  type Rng,
} from '@wildbound/engine';
import type { GameConfig } from './config';
import { pay } from './equipment';
import { fail, ok, type Result } from './index';

/**
 * R3 Orbs (kb/orbs.md + the owner's wiki; content from scripts/gen-orbs.mjs). The system opens at player
 * Lv 50 and a Pokémon's sockets at 9★ (row 2 also needs Lv 240; Origins skip that). A level takes two
 * same-kind, same-colour, same-level copies that are neither socketed nor locked, plus Gold; Quick
 * Upgrade first fuses lower copies, three into one. Dismantling pays Orb Essence (red: no).
 * Gear is not built yet (R2), so the 8 sockets sit on the Pokémon directly: 4 "gear pieces" × 2 rows.
 */

export interface OrbView {
  id: string;
  kind: string;
  name: string;
  family: OrbFamily;
  colour: OrbColour;
  level: number;
  cap: number;
  flat: { field: string; value: number }[];
  lines: { field: string; value: number }[];
  locked: boolean;
  equippedOn: string | null;
  /** Same-kind, same-colour, same-level copies free to feed a level. */
  copies: number;
  levelGold: number | null;
  dismantleEssence: number | null;
}

export interface OrbSocketView {
  socket: number;
  family: 'any' | OrbFamily;
  open: boolean;
  orbId: string | null;
}

export interface OrbsPanelView {
  wildId: string;
  /** Player level gate for the whole system. */
  systemOpen: boolean;
  playerLevelNeeded: number;
  starsNeeded: number;
  sockets: OrbSocketView[];
  sets: { id: string; name: string; level: number; tiers: { level: number; active: boolean; text: string }[] }[];
  orbs: OrbView[];
  gold: number;
  orbEssence: number;
}

function wearer(state: AccountState): Map<string, string> {
  const on = new Map<string, string>();
  for (const [wildId, l] of Object.entries(state.loadouts)) for (const id of l.orbs ?? []) if (id) on.set(id, wildId);
  return on;
}

function freeCopies(state: AccountState, orb: OrbInstance, level: number, exclude: Set<string>): OrbInstance[] {
  const worn = wearer(state);
  return state.equipment.orbs
    .filter(
      (o) =>
        !exclude.has(o.id) &&
        o.kind === orb.kind &&
        o.colour === orb.colour &&
        o.level === level &&
        !o.locked &&
        !worn.has(o.id),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

const PCT = (v: number) => `${Math.round(v * 1000) / 10}%`;
function lineText(field: string, value: number, vs?: string): string {
  if (field === 'orbAtk') return `Orb ATK +${PCT(value)}`;
  if (field === 'orbHp') return `Orb HP +${PCT(value)}`;
  if (field === 'dmgVs') return `DMG Boost vs [${vs}] +${PCT(value)}`;
  if (field === 'rdctVs') return `DMG RDCT vs [${vs}] +${PCT(value)}`;
  return `${field} +${PCT(value)}`;
}

export function orbsView(config: GameConfig, state: AccountState, wildId: string): OrbsPanelView | null {
  const wild = state.roster.find((w) => w.id === wildId);
  if (!wild) return null;
  const t = config.equipment.orbs;
  const meta = config.species.get(wild.speciesId);
  const origin = meta?.tier === 'origin';
  const loadout = state.loadouts[wildId] ?? emptyLoadout(config.equipment.tuning);
  const worn = wearer(state);
  const sockets = Array.from({ length: ORB_SOCKETS }, (_, socket) => ({
    socket,
    family: socketFamily(t, socket),
    open: socketOpen(t, socket, wild.stars, wild.level, origin),
    orbId: loadout.orbs[socket] ?? null,
  }));
  const mine = loadout.orbs.flatMap((id) => {
    const o = id ? state.equipment.orbs.find((x) => x.id === id) : undefined;
    return o ? [o] : [];
  });
  const sets = activeOrbSets(t, mine).map(({ set, level }) => ({
    id: set.id,
    name: set.name,
    level,
    tiers: set.tiers.map((tier) => ({
      level: tier.level,
      active: level >= tier.level,
      text: tier.lines.map((l) => lineText(l.field, l.value, l.vs)).join(' · '),
    })),
  }));
  const orbs = state.equipment.orbs.map((o) => {
    const k = orbKind(t, o.kind);
    const flat = orbFlat(t, o);
    return {
      id: o.id,
      kind: o.kind,
      name: k?.name ?? o.kind,
      family: k?.family ?? 'defensive',
      colour: o.colour,
      level: o.level,
      cap: orbColour(t, o.colour)?.cap ?? 0,
      flat: Object.entries(flat).map(([field, value]) => ({ field, value: value ?? 0 })),
      lines: o.lines.map((l) => ({ field: l.field, value: orbLineValue(t, l, o.level) })),
      locked: o.locked === true,
      equippedOn: worn.get(o.id) ?? null,
      copies: freeCopies(state, o, o.level, new Set([o.id])).length,
      levelGold: orbLevelGold(t, o),
      dismantleEssence: orbDismantleEssence(t, o),
    } satisfies OrbView;
  });
  return {
    wildId,
    systemOpen: state.profile.level >= t.unlock.playerLevel,
    playerLevelNeeded: t.unlock.playerLevel,
    starsNeeded: t.unlock.stars,
    sockets,
    sets,
    orbs,
    gold: state.currencies.gold ?? 0,
    orbEssence: state.currencies.orbEssence ?? 0,
  };
}

function withOrbs(state: AccountState, orbs: OrbInstance[]): AccountState {
  return { ...state, equipment: { ...state.equipment, orbs } };
}

export function equipOrbAction(
  config: GameConfig,
  state: AccountState,
  wildId: string,
  socket: number,
  orbId: string | null,
  force = false,
): Result<AccountState> {
  const wild = state.roster.find((w) => w.id === wildId);
  if (!wild) return fail('not_found', `no Wild ${wildId}`);
  const t = config.equipment.orbs;
  if (state.profile.level < t.unlock.playerLevel) return fail('resource_locked', `Orbs open at player Lv ${t.unlock.playerLevel}`);
  if (!Number.isInteger(socket) || socket < 0 || socket >= ORB_SOCKETS) return fail('invalid_input', `no orb socket ${socket}`);
  const origin = config.species.get(wild.speciesId)?.tier === 'origin';
  if (!socketOpen(t, socket, wild.stars, wild.level, origin)) {
    return fail('resource_locked', socket < 4 ? `orb sockets open at ${t.unlock.stars}★` : `the second row opens at Lv ${t.unlock.secondRow.level}`);
  }
  const tuning = config.equipment.tuning;
  const loadout = state.loadouts[wildId] ?? emptyLoadout(tuning);
  const set = (s: AccountState, id: string, sock: number, value: string | null) => ({
    ...s,
    loadouts: { ...s.loadouts, [id]: equipOrb(s.loadouts[id] ?? emptyLoadout(tuning), sock, value) },
  });
  if (orbId === null) return ok(set(state, wildId, socket, null));
  const orb = state.equipment.orbs.find((o) => o.id === orbId);
  if (!orb) return fail('not_found', `no orb ${orbId}`);
  if (!canSocket(t, orb, socket)) return fail('invalid_input', `that socket takes ${socketFamily(t, socket)} orbs`);
  let next = state;
  const wornBy = wearer(state).get(orbId);
  if (wornBy && !(wornBy === wildId)) {
    if (!force) return fail('in_use', `${orbId} is socketed in another Pokémon`);
    const prev = next.loadouts[wornBy]!;
    next = set(next, wornBy, prev.orbs.findIndex((id) => id === orbId), null);
  } else if (wornBy === wildId) {
    next = set(next, wildId, loadout.orbs.findIndex((id) => id === orbId), null);
  }
  return ok(set(next, wildId, socket, orbId));
}

/**
 * Raise an orb one level: two free copies at its level + that level's Gold. With `quick`, missing
 * copies are first fused from lower ones (three of level L − 1 make one of L, paying that step's Gold).
 */
export function levelOrbAction(config: GameConfig, state: AccountState, orbId: string, quick = false): Result<AccountState> {
  const t = config.equipment.orbs;
  const orb = state.equipment.orbs.find((o) => o.id === orbId);
  if (!orb) return fail('not_found', `no orb ${orbId}`);
  const gold = orbLevelGold(t, orb);
  if (gold === null) return fail('at_level_cap', 'this orb is at its colour cap');

  let pool = [...state.equipment.orbs];
  let goldNeeded = gold;
  const used = new Set<string>([orb.id]);
  // Make `count` copies of `level` available, fusing lower ones when allowed. Returns their ids.
  const gather = (level: number, count: number): string[] | null => {
    const have = freeCopies({ ...state, equipment: { ...state.equipment, orbs: pool } }, orb, level, used).slice(0, count);
    for (const o of have) used.add(o.id);
    const ids = have.map((o) => o.id);
    if (ids.length === count) return ids;
    if (!quick || level <= 1) return null;
    for (let i = ids.length; i < count; i += 1) {
      const parts = gather(level - 1, 3);
      if (!parts) return null;
      const fused: OrbInstance = { ...orb, id: `fused-${level}-${i}-${parts[0]}`, level, locked: false };
      goldNeeded += t.levelGold[level - 2] ?? 0;
      pool = [...pool.filter((o) => !parts.includes(o.id)), fused];
      used.add(fused.id);
      ids.push(fused.id);
    }
    return ids;
  };
  const copies = gather(orb.level, t.copiesPerLevel);
  if (!copies) return fail('insufficient_items', `needs ${t.copiesPerLevel} free copies at +${orb.level}${quick ? '' : ' (or Quick Upgrade)'}`);
  const paid = pay(state, { gold: goldNeeded });
  if (!paid) return fail('insufficient_items', 'not enough Gold');
  const consumed = new Set(copies);
  const orbs = pool
    .filter((o) => !consumed.has(o.id) && !o.id.startsWith('fused-'))
    .filter((o) => state.equipment.orbs.some((s) => s.id === o.id))
    .map((o) => (o.id === orb.id ? { ...o, level: o.level + 1 } : o));
  return ok(withOrbs(paid, orbs));
}

export function lockOrbAction(state: AccountState, orbId: string): Result<AccountState> {
  const orb = state.equipment.orbs.find((o) => o.id === orbId);
  if (!orb) return fail('not_found', `no orb ${orbId}`);
  return ok(withOrbs(state, state.equipment.orbs.map((o) => (o.id === orbId ? { ...o, locked: !o.locked } : o))));
}

export function dismantleOrbsAction(config: GameConfig, state: AccountState, orbIds: string[]): Result<AccountState> {
  const t = config.equipment.orbs;
  const worn = wearer(state);
  let essence = 0;
  for (const id of orbIds) {
    const orb = state.equipment.orbs.find((o) => o.id === id);
    if (!orb) return fail('not_found', `no orb ${id}`);
    if (orb.locked || worn.has(id)) return fail('in_use', `${id} is locked or socketed`);
    const e = orbDismantleEssence(t, orb);
    if (e === null) return fail('invalid_input', 'red orbs cannot be dismantled');
    essence += e;
  }
  const drop = new Set(orbIds);
  const next = withOrbs(state, state.equipment.orbs.filter((o) => !drop.has(o.id)));
  return ok({ ...next, currencies: { ...next.currencies, orbEssence: (next.currencies.orbEssence ?? 0) + essence } });
}

/** Add a freshly rolled orb (drops, shops and tests). */
export function grantOrb(config: GameConfig, state: AccountState, kind: string, colour: OrbColour, rng: Rng, level = 1): Result<AccountState> {
  const t = config.equipment.orbs;
  if (!orbKind(t, kind) || !orbColour(t, colour)) return fail('not_found', `no orb ${kind}/${colour}`);
  const seq = state.equipment.nextSeq;
  const orb = rollOrb(t, `orb${seq}`, kind, colour, rng, level);
  return ok({ ...state, equipment: { ...state.equipment, orbs: [...state.equipment.orbs, orb], nextSeq: seq + 1 } });
}
