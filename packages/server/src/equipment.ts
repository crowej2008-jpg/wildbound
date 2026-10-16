import {
  allocateTalent,
  canAllocateTalent,
  canEquipRelic,
  charmsUnlocked,
  chooseTree,
  coresUnlocked,
  equipCharm,
  equipCore,
  equipRelic,
  equipRune,
  relicLevelCost,
  relicRefineCost,
  relicUnlocked,
  runeLevelCost,
  runesUnlocked,
  talentsUnlocked,
  type CurrencyId,
} from '@wildbound/engine';
import type { AccountState, EquipmentTables, Loadout, WildClass, Tier } from '@wildbound/engine';
import { fail, ok, type Result } from './index';
import { CHARM_UPGRADE_COPIES, equippedOn, loadoutOf } from './equipment-view';
import type { GameConfig, SpeciesMeta } from './config';

/**
 * Equipment actions (M7): pure `AccountState` transitions. The LocalServer wraps
 * them with `commit`; they never touch persistence. Every gate and cost comes from
 * `EquipmentTables.tuning`. See docs/design/equipment.md.
 */

interface SpeciesLookup {
  species: Map<string, { className: WildClass; tier: Tier }>;
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

function pay(state: AccountState, cost: Partial<Record<CurrencyId, number>>): AccountState | null {
  for (const [id, amount] of Object.entries(cost)) {
    if ((state.currencies[id as CurrencyId] ?? 0) < (amount ?? 0)) return null;
  }
  const currencies = { ...state.currencies };
  for (const [id, amount] of Object.entries(cost)) {
    currencies[id as CurrencyId] = (currencies[id as CurrencyId] ?? 0) - (amount ?? 0);
  }
  return { ...state, currencies };
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
  if (!relicUnlocked(meta.tier, tuning)) return fail('resource_locked', `Relics unlock at ${tuning.relic.minTier}`);
  const loadout = loadoutOf(state, wild.id, config.equipment);
  if (instanceId === null) return ok(withLoadout(state, wild.id, equipRelic(loadout, null)));

  const relic = state.equipment.relics.find((r) => r.id === instanceId);
  if (!relic) return fail('not_found', `no relic ${instanceId}`);
  const def = config.equipment.relics.find((d) => d.id === relic.defId);
  if (!def) return fail('not_found', `unknown relic ${relic.defId}`);
  if (!canEquipRelic(def, meta.className, meta.tier, tuning)) {
    return fail('invalid_input', `${def.name} is a ${def.className} relic`);
  }
  const wornBy = equippedOn(state, instanceId);
  let next = state;
  if (wornBy && wornBy !== wild.id) {
    if (!force) return fail('in_use', `${def.name} is equipped by another Wild`);
    next = withLoadout(next, wornBy, equipRelic(loadoutOf(next, wornBy, config.equipment), null));
  }
  return ok(withLoadout(next, wild.id, equipRelic(loadoutOf(next, wild.id, config.equipment), instanceId)));
}

// --- runes ------------------------------------------------------------------

export function equipRuneAction(
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
  if (!runesUnlocked(wild.stars, tuning)) return fail('resource_locked', `Runes unlock at ${tuning.runes.minStars}★`);
  if (socket < 0 || socket >= tuning.runes.sockets) return fail('invalid_input', `no rune socket ${socket}`);
  const loadout = loadoutOf(state, wild.id, config.equipment);
  if (instanceId === null) return ok(withLoadout(state, wild.id, equipRune(loadout, socket, null)));

  const rune = state.equipment.runes.find((r) => r.id === instanceId);
  if (!rune) return fail('not_found', `no rune ${instanceId}`);
  const wornBy = equippedOn(state, instanceId);
  let next = state;
  if (wornBy && wornBy !== wild.id) {
    if (!force) return fail('in_use', `${rune.id} is socketed in another Wild`);
    const prev = loadoutOf(next, wornBy, config.equipment);
    next = withLoadout(next, wornBy, equipRune(prev, prev.runes.findIndex((id) => id === instanceId), null));
  }
  return ok(withLoadout(next, wild.id, equipRune(loadoutOf(next, wild.id, config.equipment), socket, instanceId)));
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

// --- charms -----------------------------------------------------------------

export function equipCharmAction(
  config: SpeciesLookup,
  state: AccountState,
  wildId: string,
  charmId: string | null,
): Result<AccountState> {
  const { wild } = context(config, state, wildId);
  if (!wild) return fail('not_found', `no Wild ${wildId}`);
  const { tuning } = config.equipment;
  if (!charmsUnlocked(wild.stars, tuning)) return fail('resource_locked', `Charms unlock at ${tuning.charms.minStars}★`);
  const loadout = loadoutOf(state, wild.id, config.equipment);
  if (charmId === null) return ok(withLoadout(state, wild.id, equipCharm(loadout, null)));
  if (!config.equipment.charms.some((c) => c.id === charmId)) return fail('not_found', `unknown charm ${charmId}`);
  if ((state.equipment.charms[charmId] ?? 0) <= 0) return fail('insufficient_items', 'no copies of that charm');
  return ok(withLoadout(state, wild.id, equipCharm(loadout, charmId)));
}

export function upgradeCharmAction(config: SpeciesLookup, state: AccountState, charmId: string): Result<AccountState> {
  const def = config.equipment.charms.find((c) => c.id === charmId);
  if (!def) return fail('not_found', `unknown charm ${charmId}`);
  if (def.maxStars <= 0) return fail('invalid_input', `${def.name} cannot be starred`);
  const stars = state.equipment.charmStars[charmId] ?? 1;
  if (stars >= def.maxStars) return fail('at_level_cap', `${def.name} is already ${def.maxStars}★`);
  const owned = state.equipment.charms[charmId] ?? 0;
  if (owned < CHARM_UPGRADE_COPIES) return fail('insufficient_items', `need ${CHARM_UPGRADE_COPIES} copies of ${def.name}`);
  return ok({
    ...state,
    equipment: {
      ...state.equipment,
      charms: { ...state.equipment.charms, [charmId]: owned - CHARM_UPGRADE_COPIES },
      charmStars: { ...state.equipment.charmStars, [charmId]: stars + 1 },
    },
  });
}

/** Consume one copy of each equipped charm (skipped for preview battles). */
export function consumeCharms(state: AccountState, wildIds: string[]): AccountState {
  const charms = { ...state.equipment.charms };
  let changed = false;
  for (const wildId of wildIds) {
    const charm = state.loadouts[wildId]?.charm;
    if (charm && (charms[charm] ?? 0) > 0) {
      charms[charm] = (charms[charm] ?? 0) - 1;
      changed = true;
    }
  }
  return changed ? { ...state, equipment: { ...state.equipment, charms } } : state;
}

// --- upgrades ---------------------------------------------------------------

export function levelRelicAction(config: SpeciesLookup, state: AccountState, instanceId: string): Result<AccountState> {
  const relic = state.equipment.relics.find((r) => r.id === instanceId);
  if (!relic) return fail('not_found', `no relic ${instanceId}`);
  const { tuning } = config.equipment;
  if (relic.level >= tuning.relic.maxLevel) return fail('at_level_cap', 'max relic level');
  const paid = pay(state, relicLevelCost(relic.level, tuning));
  if (!paid) return fail('insufficient_items', 'not enough gold or candy');
  const relics = paid.equipment.relics.map((r) => (r.id === instanceId ? { ...r, level: r.level + 1 } : r));
  return ok({ ...paid, equipment: { ...paid.equipment, relics } });
}

export function refineRelicAction(config: SpeciesLookup, state: AccountState, instanceId: string): Result<AccountState> {
  const relic = state.equipment.relics.find((r) => r.id === instanceId);
  if (!relic) return fail('not_found', `no relic ${instanceId}`);
  const { tuning } = config.equipment;
  if (relic.refine >= tuning.relic.maxRefine) return fail('at_level_cap', 'max relic refine');
  const paid = pay(state, relicRefineCost(relic.refine, tuning));
  if (!paid) return fail('insufficient_items', 'not enough gold or stone');
  const relics = paid.equipment.relics.map((r) => (r.id === instanceId ? { ...r, refine: r.refine + 1 } : r));
  return ok({ ...paid, equipment: { ...paid.equipment, relics } });
}

export function levelRuneAction(config: SpeciesLookup, state: AccountState, instanceId: string): Result<AccountState> {
  const rune = state.equipment.runes.find((r) => r.id === instanceId);
  if (!rune) return fail('not_found', `no rune ${instanceId}`);
  const { tuning } = config.equipment;
  if (rune.level >= tuning.runes.maxLevel) return fail('at_level_cap', 'max rune level');
  const paid = pay(state, runeLevelCost(rune.level, tuning));
  if (!paid) return fail('insufficient_items', 'not enough gold');
  const runes = paid.equipment.runes.map((r) => (r.id === instanceId ? { ...r, level: r.level + 1 } : r));
  return ok({ ...paid, equipment: { ...paid.equipment, runes } });
}

// --- talents ----------------------------------------------------------------

export function chooseTreeAction(
  config: SpeciesLookup,
  state: AccountState,
  wildId: string,
  treeId: string | null,
): Result<AccountState> {
  const { wild, meta } = context(config, state, wildId);
  if (!wild || !meta) return fail('not_found', `no Wild ${wildId}`);
  const { tuning } = config.equipment;
  if (!talentsUnlocked(meta.tier, tuning)) return fail('resource_locked', `Talents unlock at ${tuning.talents.minTier}`);
  const loadout = loadoutOf(state, wild.id, config.equipment);
  if (treeId === null) return ok(withLoadout(state, wild.id, chooseTree(loadout, null, tuning)));
  const tree = config.equipment.talentTrees.find((t) => t.id === treeId);
  if (!tree) return fail('not_found', `unknown tree ${treeId}`);
  if (tree.className !== meta.className) return fail('invalid_input', `${tree.name} is a ${tree.className} path`);
  return ok(withLoadout(state, wild.id, chooseTree(loadout, treeId, tuning)));
}

export function allocateTalentAction(
  config: SpeciesLookup,
  state: AccountState,
  wildId: string,
  tier: number,
  option: number,
): Result<AccountState> {
  const { wild, meta } = context(config, state, wildId);
  if (!wild || !meta) return fail('not_found', `no Wild ${wildId}`);
  const { tuning } = config.equipment;
  if (!talentsUnlocked(meta.tier, tuning)) return fail('resource_locked', `Talents unlock at ${tuning.talents.minTier}`);
  const loadout = loadoutOf(state, wild.id, config.equipment);
  const tree = loadout.treeId ? config.equipment.talentTrees.find((t) => t.id === loadout.treeId) : undefined;
  if (!tree) return fail('invalid_input', 'choose a talent path first');
  if (!canAllocateTalent(loadout, tree, tier, option, tuning)) return fail('resource_locked', 'that tier is not available yet');
  const paid = pay(state, { gold: tuning.talents.allocateGold });
  if (!paid) return fail('insufficient_items', 'not enough gold');
  return ok(withLoadout(paid, wild.id, allocateTalent(loadoutOf(paid, wild.id, config.equipment), tier, option, tuning)));
}

export function resetTalentsAction(config: SpeciesLookup, state: AccountState, wildId: string): Result<AccountState> {
  const { wild, meta } = context(config, state, wildId);
  if (!wild || !meta) return fail('not_found', `no Wild ${wildId}`);
  const { tuning } = config.equipment;
  if (!talentsUnlocked(meta.tier, tuning)) return fail('resource_locked', `Talents unlock at ${tuning.talents.minTier}`);
  const loadout = loadoutOf(state, wild.id, config.equipment);
  if (!loadout.treeId) return fail('invalid_input', 'no talent path to reset');
  const paid = pay(state, { gems: tuning.talents.resetGems });
  if (!paid) return fail('insufficient_items', 'not enough gems');
  const spent = loadout.talents.filter((t) => t >= 0).length;
  const currencies = { ...paid.currencies, gold: (paid.currencies.gold ?? 0) + spent * tuning.talents.allocateGold };
  return ok({ ...paid, currencies, loadouts: { ...paid.loadouts, [wildId]: chooseTree(loadout, null, tuning) } });
}

/** Re-export so callers can type against `GameConfig` without a second import. */
export type EquipmentConfig = GameConfig;
