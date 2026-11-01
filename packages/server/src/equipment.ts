import {
  canEquipRelic,
  coresUnlocked,
  equipCore,
  equipRelic,
  heldDismantleShards,
  heldLevelCost,
  heldLevelGate,
  heldRefineCost,
  refineBlock,
  rollHeldItem,
  rollRefine,
  settleRefine,
  relicUnlocked,
  type CurrencyId,
  coreStarCost,
} from '@wildbound/engine';
import type { AccountState, EquipmentTables, Loadout, RelicInstance, Rng, WildClass, Tier } from '@wildbound/engine';
import { fail, ok, type Result } from './index';
import { resonanceLevel } from './resonance';
import { equippedOn, loadoutOf } from './equipment-view';
import type { GameConfig, SpeciesMeta } from './config';

/**
 * Equipment actions (M7): pure `AccountState` transitions. The LocalServer wraps
 * them with `commit`; they never touch persistence. Every gate and cost comes from
 * `EquipmentTables.tuning`. See docs/design/equipment.md.
 */

interface SpeciesLookup {
  species: Map<string, { className: WildClass; tier: Tier; name: string }>;
  equipment: EquipmentTables;
}

function context(config: SpeciesLookup, state: AccountState, wildId: string) {
  const wild = state.roster.find((w) => w.id === wildId);
  const meta: Pick<SpeciesMeta, 'className' | 'tier'> | undefined = wild ? config.species.get(wild.speciesId) : undefined;
  return { wild, meta };
}

function withLoadout(state: AccountState, wildId: string, loadout: Loadout): AccountState {
  return { ...state, loadouts: { ...state.loadouts, [wildId]: loadout } };
}

export function pay(state: AccountState, cost: Partial<Record<CurrencyId, number>>): AccountState | null {
  for (const [id, amount] of Object.entries(cost)) {
    if ((state.currencies[id as CurrencyId] ?? 0) < (amount ?? 0)) return null;
  }
  const currencies = { ...state.currencies };
  for (const [id, amount] of Object.entries(cost)) {
    currencies[id as CurrencyId] = (currencies[id as CurrencyId] ?? 0) - (amount ?? 0);
  }
  return { ...state, currencies };
}



/** Remove consumed duplicates from the roster and drop their stale loadouts. */
export function consumeFodder(state: AccountState, ids: string[]): AccountState {
  if (ids.length === 0) return state;
  const removed = new Set(ids);
  const loadouts = { ...state.loadouts };
  const plates = { ...state.plates };
  const potential = { ...state.potential };
  for (const id of ids) {
    delete loadouts[id];
    delete plates[id];
    delete potential[id];
  }
  const slots = state.resonance.slots.map((id) => (id !== null && removed.has(id) ? null : id));
  return {
    ...state,
    roster: state.roster.filter((wild) => !removed.has(wild.id)),
    loadouts,
    plates,
    potential,
    resonance: { ...state.resonance, slots },
  };
}

// --- relics -----------------------------------------------------------------

export function equipRelicAction(
  config: SpeciesLookup,
  state: AccountState,
  wildId: string,
  instanceId: string | null,
  force = false,
): Result<AccountState> {
  const { wild, meta } = context(config, state, wildId);
  if (!wild || !meta) return fail('not_found', `no Wild ${wildId}`);
  const { tuning } = config.equipment;
  if (!relicUnlocked(meta.tier, tuning)) return fail('resource_locked', `Held items unlock at ${tuning.relic.minTier}`);
  const loadout = loadoutOf(state, wild.id, config.equipment);
  if (instanceId === null) return ok(withLoadout(state, wild.id, equipRelic(loadout, null)));

  const relic = state.equipment.relics.find((r) => r.id === instanceId);
  if (!relic) return fail('not_found', `no relic ${instanceId}`);
  const def = config.equipment.relics.find((d) => d.id === relic.defId);
  if (!def) return fail('not_found', `unknown relic ${relic.defId}`);
  if (!canEquipRelic(def, meta.className, meta.tier, tuning)) {
    return fail('invalid_input', `${def.name} is a ${def.className} held item`);
  }
  const wornBy = equippedOn(state, instanceId);
  let next = state;
  if (wornBy && wornBy !== wild.id) {
    if (!force) return fail('in_use', `${def.name} is equipped by another Wild`);
    next = withLoadout(next, wornBy, equipRelic(loadoutOf(next, wornBy, config.equipment), null));
  }
  return ok(withLoadout(next, wild.id, equipRelic(loadoutOf(next, wild.id, config.equipment), instanceId)));
}

// --- cores ------------------------------------------------------------------

export function equipCoreAction(
  config: SpeciesLookup,
  state: AccountState,
  wildId: string,
  socket: number,
  instanceId: string | null,
  force = false,
): Result<AccountState> {
  const { wild } = context(config, state, wildId);
  if (!wild) return fail('not_found', `no Wild ${wildId}`);
  const { tuning } = config.equipment;
  if (!coresUnlocked(wild.stars, tuning)) return fail('resource_locked', `Spirit cores unlock at ${tuning.cores.minStars}★`);
  if (socket < 0 || socket >= tuning.cores.sockets) return fail('invalid_input', `no core socket ${socket}`);
  const loadout = loadoutOf(state, wild.id, config.equipment);
  if (instanceId === null) return ok(withLoadout(state, wild.id, equipCore(loadout, socket, null)));

  const core = state.equipment.cores.find((c) => c.id === instanceId);
  if (!core) return fail('not_found', `no core ${instanceId}`);
  const wornBy = equippedOn(state, instanceId);
  let next = state;
  if (wornBy && wornBy !== wild.id) {
    if (!force) return fail('in_use', `${core.id} is socketed in another Wild`);
    const prev = loadoutOf(next, wornBy, config.equipment);
    next = withLoadout(next, wornBy, equipCore(prev, prev.cores.findIndex((id) => id === instanceId), null));
  }
  return ok(withLoadout(next, wild.id, equipCore(loadoutOf(next, wild.id, config.equipment), socket, instanceId)));
}

export function starUpCoreAction(config: SpeciesLookup, state: AccountState, instanceId: string): Result<AccountState> {
  const core = state.equipment.cores.find((c) => c.id === instanceId);
  if (!core) return fail('not_found', `no core ${instanceId}`);
  const { tuning } = config.equipment;
  const cost = coreStarCost(core, tuning);
  if (cost === null) return fail('at_level_cap', 'max soul-heart stars');
  const paid = pay(state, { soulHeartExp: cost });
  if (!paid) return fail('insufficient_items', 'not enough Soul-heart EXP');
  const cores = paid.equipment.cores.map((c) => (c.id === instanceId ? { ...c, stars: c.stars + 1 } : c));
  return ok({ ...paid, equipment: { ...paid.equipment, cores } });
}

// --- upgrades ---------------------------------------------------------------

function findHeld(config: SpeciesLookup, state: AccountState, instanceId: string) {
  const relic = state.equipment.relics.find((r) => r.id === instanceId);
  const def = relic ? config.equipment.relics.find((d) => d.id === relic.defId) : undefined;
  return { relic, def };
}

function withRelic(state: AccountState, next: RelicInstance): AccountState {
  const relics = state.equipment.relics.map((r) => (r.id === next.id ? next : r));
  return { ...state, equipment: { ...state.equipment, relics } };
}

/** Raise a held item one level: source shard table, resonance gates from Lv 31, cap 200. */
export function levelRelicAction(config: SpeciesLookup, state: AccountState, instanceId: string): Result<AccountState> {
  const { relic } = findHeld(config, state, instanceId);
  if (!relic) return fail('not_found', `no held item ${instanceId}`);
  const { held } = config.equipment;
  const cost = heldLevelCost(relic.level, held);
  if (cost === null) return fail('at_level_cap', 'max held item level');
  const gate = heldLevelGate(relic.level, held);
  if (resonanceLevel(config, state) < gate) return fail('resource_locked', `needs resonance level ${gate}`);
  const paid = pay(state, { heldItemShard: cost });
  if (!paid) return fail('insufficient_items', 'not enough Held Item Shards');
  return ok(withRelic(paid, { ...relic, level: relic.level + 1 }));
}

/**
 * Roll a new line into one slot of a worn item (source: HELD_REFINE). The roll waits until it is
 * kept or dropped; prices follow the owner's ladder in Held Item Resetters.
 */
export function refineRelicAction(
  config: SpeciesLookup,
  state: AccountState,
  instanceId: string,
  slot: number,
  rng: Rng,
): Result<AccountState> {
  const { relic, def } = findHeld(config, state, instanceId);
  if (!relic || !def) return fail('not_found', `no held item ${instanceId}`);
  if (!equippedOn(state, instanceId)) return fail('invalid_input', 'only a worn held item can be refined');
  if (relic.pending) return fail('invalid_input', 'keep or drop the last refine first');
  const { held } = config.equipment;
  const block = refineBlock(relic, def, held, slot);
  if (block === 'no_slots') return fail('resource_locked', `${def.name} has no refinable lines`);
  if (block === 'main_stat') return fail('invalid_input', 'the main stat cannot be refined');
  if (block === 'slot_limit') return fail('resource_locked', 'reached the maximum refinable line count');
  if (block === 'max_refine') return fail('at_level_cap', 'no refines left');
  const cost = heldRefineCost(relic, held) ?? 0;
  const paid = pay(state, { heldItemResetter: cost });
  if (!paid) return fail('insufficient_items', 'not enough Held Item Resetters');
  return ok(withRelic(paid, rollRefine(relic, def, held, slot, rng)));
}

/** Keep (`true`) or drop (`false`) the pending refine roll (source: HELD_REFINE_CONFIRM). */
export function settleRefineAction(
  config: SpeciesLookup,
  state: AccountState,
  instanceId: string,
  keep: boolean,
): Result<AccountState> {
  const { relic } = findHeld(config, state, instanceId);
  if (!relic) return fail('not_found', `no held item ${instanceId}`);
  if (!relic.pending) return fail('invalid_input', 'refine first');
  return ok(withRelic(state, settleRefine(relic, keep)));
}

export function lockRelicAction(config: SpeciesLookup, state: AccountState, instanceId: string): Result<AccountState> {
  const { relic } = findHeld(config, state, instanceId);
  if (!relic) return fail('not_found', `no held item ${instanceId}`);
  return ok(withRelic(state, { ...relic, locked: !relic.locked }));
}

/**
 * Dismantle unworn, unlocked held items for Held Item Shards: the item's own value plus every
 * shard spent on its levels (source: HELD_DECOMPOSE).
 */
export function dismantleRelicsAction(config: SpeciesLookup, state: AccountState, instanceIds: string[]): Result<AccountState> {
  if (instanceIds.length === 0) return fail('invalid_input', 'nothing to dismantle');
  const ids = new Set(instanceIds);
  let shards = 0;
  for (const id of ids) {
    const { relic, def } = findHeld(config, state, id);
    if (!relic || !def) return fail('not_found', `no held item ${id}`);
    if (equippedOn(state, id)) return fail('in_use', `${def.name} is worn`);
    if (relic.locked) return fail('resource_locked', `${def.name} is locked`);
    shards += heldDismantleShards(relic, def, config.equipment.held);
  }
  const relics = state.equipment.relics.filter((r) => !ids.has(r.id));
  return ok({
    ...state,
    equipment: { ...state.equipment, relics },
    currencies: { ...state.currencies, heldItemShard: (state.currencies.heldItemShard ?? 0) + shards },
  });
}

/** Turn Resetter Shards into Held Item Resetters (20 → 1, item_compound_json). */
export function compoundResettersAction(config: SpeciesLookup, state: AccountState, count: number): Result<AccountState> {
  if (!Number.isInteger(count) || count < 1) return fail('invalid_input', 'count must be a positive integer');
  const per = config.equipment.held.resetterCompound;
  const paid = pay(state, { resetterShard: per * count });
  if (!paid) return fail('insufficient_items', 'not enough Resetter Shards');
  return ok({
    ...paid,
    currencies: { ...paid.currencies, heldItemResetter: (paid.currencies.heldItemResetter ?? 0) + count },
  });
}

/** Add a freshly rolled held item to the account (Vault drops, tests). */
export function grantRelic(config: SpeciesLookup, state: AccountState, defId: string, rng: Rng): Result<AccountState> {
  const def = config.equipment.relics.find((d) => d.id === defId);
  if (!def) return fail('not_found', `unknown held item ${defId}`);
  const seq = state.equipment.nextSeq;
  const inst = rollHeldItem(def, config.equipment.held, rng, `re${seq}`);
  return ok({
    ...state,
    equipment: { ...state.equipment, relics: [...state.equipment.relics, inst], nextSeq: seq + 1 },
  });
}

/** Re-export so callers can type against `GameConfig` without a second import. */
export type EquipmentConfig = GameConfig;
