import {
  addSpent,
  berriesUnlocked,
  berryCultivatable,
  berryDef,
  berryDelta,
  berryElement,
  breakthroughBerry,
  cultivateBerry,
  cultivationFull,
  cultivationProgress,
  emptyLoadout,
  equipBerry,
  lineCap,
  reforgeBerryLine,
  rollBerry,
  type AccountState,
  type BerryInstance,
  type CurrencyId,
  type Rng,
} from '@wildbound/engine';
import type { GameConfig } from './config';
import { pay } from './equipment';
import { fail, ok, type Result } from './index';

/**
 * R6d: berries from the source (scripts/import-berries.mjs; kb/berries.md and the dump's `_berries` note).
 * A Pokémon carries two, never two of one type. Elevation (stars) feeds same-berry and any-berry copies at 1★
 * that were never cultivated, plus Gold; Breakthrough (+1…+4) needs the trainer level and Mulch and opens a
 * new line; Cultivation costs 100 Berry Essence a time (Fast: up to 10) and grows the lines towards their
 * caps; Reforge re-rolls one line's kind for 10 / 20 / 35 / 35 / 35 Reforge Potions by its position; only
 * uncultivated berries can be dismantled (50 Essence green, 40 the rest); Rebirth (100 Diamonds) gives back
 * everything spent on the berry. Readings: ASSUMPTIONS #70.
 */

export interface BerryLineView {
  field: string;
  kind: string;
  value: number;
  cap: number;
  /** Reforge Potions to re-roll this line. */
  reforgeCost: number;
}

export interface BerryView {
  id: string;
  defId: string;
  name: string;
  tier: string;
  typeId: number;
  star: number;
  maxStar: number;
  stage: number;
  cultivatable: boolean;
  cultivated: boolean;
  locked: boolean;
  progress: number;
  /** The skill at the berry's star (Commons: their fixed one). */
  skill: { name: string; text: string } | null;
  stats: { hp: number; pAtk: number; sAtk: number };
  lines: BerryLineView[];
  equippedOn: string | null;
  /** Price of the next star (null at the top or for Commons) and the free copies it could use. */
  elevate: { sameCopies: number; anyCopies: number; gold: number; freeSame: number; freeAny: number } | null;
  breakthrough: { stage: number; trainerLevel: number; currency: string; amount: number; open: boolean } | null;
  dismantleEssence: number | null;
  /** Diamonds to rebirth (null when there is nothing to give back), and what would come back. */
  rebirth: { gems: number; returns: Record<string, number>; berries: number } | null;
}

export interface BerriesPanelView {
  wildId: string;
  unlocked: boolean;
  starsNeeded: number;
  slots: (string | null)[];
  berries: BerryView[];
  cultivateEssence: number;
  fastCultivateTimes: number;
  essence: number;
  gems: number;
  reforgePotions: number;
  gold: number;
  trainerLevel: number;
  mulch: Record<string, number>;
}

function wearers(state: AccountState): Map<string, string> {
  const on = new Map<string, string>();
  for (const [wildId, l] of Object.entries(state.loadouts)) for (const id of l.berries ?? []) if (id) on.set(id, wildId);
  return on;
}

function findBerry(state: AccountState, id: string): BerryInstance | undefined {
  return state.equipment.berries.find((b) => b.id === id);
}

/** Fodder: 1★, never cultivated, not carried, not locked, not the berry itself. */
function fodder(state: AccountState, target: BerryInstance, sameDef: boolean): BerryInstance[] {
  const worn = wearers(state);
  return state.equipment.berries.filter(
    (b) =>
      b.id !== target.id &&
      b.star === 1 &&
      !b.cultivated &&
      !b.locked &&
      !worn.has(b.id) &&
      (!sameDef || b.defId === target.defId),
  );
}

function berryView(config: GameConfig, state: AccountState, b: BerryInstance, worn: Map<string, string>): BerryView {
  const t = config.equipment.berries;
  const def = berryDef(t, b.defId)!;
  const cultivatable = berryCultivatable(def);
  const star = t.stars.find((s) => s.star === b.star);
  const nextBreak = t.breakthrough.find((s) => s.stage === b.stage + 1);
  const delta = berryDelta(t, b);
  const skill = def.skills.find((s) => s.star === Math.max(1, b.star)) ?? null;
  const freeSame = fodder(state, b, true).length;
  return {
    id: b.id,
    defId: def.id,
    name: def.name,
    tier: def.tier,
    typeId: def.typeId,
    star: b.star,
    maxStar: def.maxStar,
    stage: b.stage,
    cultivatable,
    cultivated: b.cultivated,
    locked: b.locked,
    progress: cultivationProgress(t, b),
    skill: skill ? { name: skill.name, text: skill.text } : null,
    stats: { hp: delta.core.hp ?? 0, pAtk: delta.core.pAtk ?? 0, sAtk: delta.core.sAtk ?? 0 },
    lines: b.lines.map((l, i) => {
      const e = berryElement(t, l.element);
      return {
        field: e?.field ?? '?',
        kind: e?.kind ?? 'core',
        value: l.value,
        cap: lineCap(t, l.element, b.stage),
        reforgeCost: t.reforgePotions[i] ?? t.reforgePotions[t.reforgePotions.length - 1] ?? 0,
      };
    }),
    equippedOn: worn.get(b.id) ?? null,
    elevate:
      cultivatable && star?.next
        ? { ...star.next, freeSame, freeAny: fodder(state, b, false).length - Math.min(freeSame, star.next.sameCopies) }
        : null,
    breakthrough:
      cultivatable && nextBreak
        ? {
            stage: nextBreak.stage,
            trainerLevel: nextBreak.trainerLevel,
            currency: nextBreak.cost.currency,
            amount: nextBreak.cost.amount,
            open: state.profile.level >= nextBreak.trainerLevel,
          }
        : null,
    dismantleEssence: !b.cultivated && !worn.has(b.id) && !b.locked ? def.dismantleEssence : null,
    rebirth:
      cultivatable && (b.spent || b.star > def.initStar || b.stage > 0 || b.cultivated)
        ? { gems: t.rebirthGems, returns: { ...(b.spent?.currencies ?? {}) }, berries: b.spent?.fodder.length ?? 0 }
        : null,
  };
}

export function berriesView(config: GameConfig, state: AccountState, wildId: string): Result<BerriesPanelView> {
  const wild = state.roster.find((w) => w.id === wildId);
  if (!wild) return fail('not_found', `no Wild ${wildId}`);
  const { tuning } = config.equipment;
  const worn = wearers(state);
  const loadout = state.loadouts[wildId] ?? emptyLoadout(tuning);
  const t = config.equipment.berries;
  const mulch: Record<string, number> = {};
  for (const s of t.breakthrough) mulch[s.cost.currency] = state.currencies[s.cost.currency as CurrencyId] ?? 0;
  return ok({
    wildId,
    unlocked: berriesUnlocked(wild.stars, tuning),
    starsNeeded: tuning.berries.minStars,
    slots: Array.from({ length: tuning.berries.slots }, (_, i) => loadout.berries?.[i] ?? null),
    berries: state.equipment.berries.map((b) => berryView(config, state, b, worn)),
    cultivateEssence: t.cultivateEssence,
    fastCultivateTimes: t.fastCultivateTimes,
    essence: state.currencies.berryEssence ?? 0,
    gems: state.currencies.gems ?? 0,
    reforgePotions: state.currencies.reforgePotion ?? 0,
    gold: state.currencies.gold ?? 0,
    trainerLevel: state.profile.level,
    mulch,
  });
}

function withBerry(state: AccountState, next: BerryInstance): AccountState {
  return {
    ...state,
    equipment: { ...state.equipment, berries: state.equipment.berries.map((b) => (b.id === next.id ? next : b)) },
  };
}

export function equipBerryAction(
  config: GameConfig,
  state: AccountState,
  wildId: string,
  slot: number,
  berryId: string | null,
): Result<AccountState> {
  const wild = state.roster.find((w) => w.id === wildId);
  if (!wild) return fail('not_found', `no Wild ${wildId}`);
  const { tuning } = config.equipment;
  if (!berriesUnlocked(wild.stars, tuning)) return fail('resource_locked', `Berries unlock at ${tuning.berries.minStars}★`);
  if (!Number.isInteger(slot) || slot < 0 || slot >= tuning.berries.slots) return fail('invalid_input', `no Berry slot ${slot}`);
  const loadout = state.loadouts[wildId] ?? emptyLoadout(tuning);
  if (berryId !== null) {
    const b = findBerry(state, berryId);
    if (!b) return fail('not_found', `no berry ${berryId}`);
    const worn = wearers(state).get(berryId);
    if (worn && !(worn === wildId && loadout.berries?.[slot] === berryId)) return fail('in_use', 'that berry is carried');
    const def = berryDef(config.equipment.berries, b.defId);
    const other = (loadout.berries ?? []).filter((id, i) => i !== slot && id).map((id) => findBerry(state, id!));
    if (other.some((o) => o && berryDef(config.equipment.berries, o.defId)?.typeId === def?.typeId)) {
      return fail('invalid_input', 'a Pokémon cannot carry two berries of one type');
    }
  }
  const next = equipBerry({ ...loadout, berries: loadout.berries ?? emptyLoadout(tuning).berries }, slot, berryId);
  return ok({ ...state, loadouts: { ...state.loadouts, [wildId]: next } });
}

export function cultivateBerryAction(
  config: GameConfig,
  state: AccountState,
  berryId: string,
  times: number,
  rng: Rng,
): Result<AccountState> {
  const t = config.equipment.berries;
  const b = findBerry(state, berryId);
  if (!b) return fail('not_found', `no berry ${berryId}`);
  const def = berryDef(t, b.defId);
  if (!def || !berryCultivatable(def)) return fail('invalid_input', 'this berry cannot be cultivated');
  if (!Number.isInteger(times) || times < 1 || times > t.fastCultivateTimes) return fail('invalid_input', 'bad count');
  if (cultivationFull(t, b)) return fail('at_level_cap', 'every line is at its cap; break through first');
  const paid = pay(state, { berryEssence: t.cultivateEssence * times });
  if (!paid) return fail('insufficient_items', 'not enough Berry Essence');
  return ok(withBerry(paid, addSpent(cultivateBerry(t, b, times, rng), { berryEssence: t.cultivateEssence * times })));
}

export function breakthroughBerryAction(config: GameConfig, state: AccountState, berryId: string, rng: Rng): Result<AccountState> {
  const t = config.equipment.berries;
  const b = findBerry(state, berryId);
  if (!b) return fail('not_found', `no berry ${berryId}`);
  const def = berryDef(t, b.defId);
  if (!def || !berryCultivatable(def)) return fail('invalid_input', 'this berry cannot break through');
  const next = t.breakthrough.find((s) => s.stage === b.stage + 1);
  if (!next) return fail('at_level_cap', 'highest breakthrough reached');
  if (state.profile.level < next.trainerLevel) return fail('resource_locked', `needs trainer Lv ${next.trainerLevel}`);
  const paid = pay(state, { [next.cost.currency]: next.cost.amount });
  if (!paid) return fail('insufficient_items', 'not enough Mulch');
  return ok(withBerry(paid, addSpent(breakthroughBerry(t, b, rng), { [next.cost.currency]: next.cost.amount })));
}

export function reforgeBerryAction(
  config: GameConfig,
  state: AccountState,
  berryId: string,
  line: number,
  rng: Rng,
): Result<AccountState> {
  const t = config.equipment.berries;
  const b = findBerry(state, berryId);
  if (!b) return fail('not_found', `no berry ${berryId}`);
  if (!Number.isInteger(line) || !b.lines[line]) return fail('invalid_input', `no line ${line}`);
  const cost = t.reforgePotions[line] ?? t.reforgePotions[t.reforgePotions.length - 1] ?? 0;
  const paid = pay(state, { reforgePotion: cost });
  if (!paid) return fail('insufficient_items', 'not enough Reforge Potions');
  return ok(withBerry(paid, addSpent(reforgeBerryLine(t, b, line, rng), { reforgePotion: cost })));
}

/** Elevation: the next star for `sameCopies` copies of this berry and `anyCopies` other berries (1★, uncultivated). */
export function elevateBerryAction(config: GameConfig, state: AccountState, berryId: string): Result<AccountState> {
  const t = config.equipment.berries;
  const b = findBerry(state, berryId);
  if (!b) return fail('not_found', `no berry ${berryId}`);
  const def = berryDef(t, b.defId);
  if (!def || !berryCultivatable(def)) return fail('invalid_input', 'this berry has no stars');
  const next = t.stars.find((s) => s.star === b.star)?.next;
  if (!next || b.star >= def.maxStar) return fail('at_level_cap', 'top star reached');
  const same = fodder(state, b, true).slice(0, next.sameCopies);
  if (same.length < next.sameCopies) return fail('insufficient_items', `needs ${next.sameCopies} spare ${def.name} at 1★`);
  const used = new Set(same.map((x) => x.id));
  const any = fodder(state, b, false).filter((x) => !used.has(x.id)).slice(0, next.anyCopies);
  if (any.length < next.anyCopies) return fail('insufficient_items', `needs ${next.anyCopies} more spare berries at 1★`);
  for (const x of any) used.add(x.id);
  const paid = pay(state, { gold: next.gold });
  if (!paid) return fail('insufficient_items', 'not enough Gold');
  const fed = [...same, ...any].map((x) => x.defId);
  const berries = paid.equipment.berries
    .filter((x) => !used.has(x.id))
    .map((x) => (x.id === b.id ? addSpent({ ...x, star: x.star + 1 }, { gold: next.gold }, fed) : x));
  return ok({ ...paid, equipment: { ...paid.equipment, berries } });
}

export function lockBerryAction(state: AccountState, berryId: string, locked: boolean): Result<AccountState> {
  const b = findBerry(state, berryId);
  if (!b) return fail('not_found', `no berry ${berryId}`);
  return ok(withBerry(state, { ...b, locked }));
}

/** Dismantle uncultivated, free berries for Berry Essence (50 green, 40 the rest). */
export function dismantleBerriesAction(config: GameConfig, state: AccountState, ids: string[]): Result<AccountState> {
  const t = config.equipment.berries;
  const worn = wearers(state);
  let essence = 0;
  const drop = new Set<string>();
  for (const id of ids) {
    const b = findBerry(state, id);
    if (!b) return fail('not_found', `no berry ${id}`);
    if (b.cultivated || b.locked || worn.has(id)) return fail('invalid_input', 'only free, uncultivated berries can be dismantled');
    essence += berryDef(t, b.defId)?.dismantleEssence ?? 0;
    drop.add(id);
  }
  return ok({
    ...state,
    currencies: { ...state.currencies, berryEssence: (state.currencies.berryEssence ?? 0) + essence },
    equipment: { ...state.equipment, berries: state.equipment.berries.filter((b) => !drop.has(b.id)) },
  });
}

/**
 * Rebirth (owner, 2026-11-01: "rebirth gives back every item that was used in that berry"): for 100 Diamonds the
 * berry returns to its start star, +0 and one fresh, empty line, and everything spent on it comes back — the
 * Berry Essence, Mulch, Reforge Potions and Gold, and the berries fed to its stars as new 1★ berries.
 */
export function rebirthBerryAction(config: GameConfig, state: AccountState, berryId: string, rng: Rng): Result<AccountState> {
  const t = config.equipment.berries;
  const b = findBerry(state, berryId);
  if (!b) return fail('not_found', `no berry ${berryId}`);
  const def = berryDef(t, b.defId);
  if (!def || !berryCultivatable(def)) return fail('invalid_input', 'this berry cannot be reborn');
  if (!b.spent && b.star === def.initStar && b.stage === 0 && !b.cultivated) return fail('invalid_input', 'nothing to give back');
  const paid = pay(state, { gems: t.rebirthGems });
  if (!paid) return fail('insufficient_items', `needs ${t.rebirthGems} Diamonds`);
  const currencies = { ...paid.currencies };
  for (const [k, v] of Object.entries(b.spent?.currencies ?? {})) {
    currencies[k as CurrencyId] = (currencies[k as CurrencyId] ?? 0) + v;
  }
  let seq = paid.equipment.nextSeq;
  const fresh = { ...rollBerry(t, def, b.id, rng), locked: b.locked };
  const returned: BerryInstance[] = [];
  for (const defId of b.spent?.fodder ?? []) {
    const d = berryDef(t, defId);
    if (d) returned.push(rollBerry(t, d, `be${seq++}`, rng));
  }
  const berries = [...paid.equipment.berries.map((x) => (x.id === b.id ? fresh : x)), ...returned];
  return ok({ ...paid, currencies, equipment: { ...paid.equipment, berries, nextSeq: seq } });
}

/** Grant a new berry (debug / rewards). */
export function grantBerry(config: GameConfig, state: AccountState, defId: string, rng: Rng): Result<AccountState> {
  const def = berryDef(config.equipment.berries, defId);
  if (!def) return fail('not_found', `no berry ${defId}`);
  const id = `be${state.equipment.nextSeq}`;
  const b = rollBerry(config.equipment.berries, def, id, rng);
  return ok({ ...state, equipment: { ...state.equipment, berries: [...state.equipment.berries, b], nextSeq: state.equipment.nextSeq + 1 } });
}
