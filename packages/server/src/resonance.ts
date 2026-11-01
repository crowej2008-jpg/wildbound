import {
  canEvolve,
  cooldownClearGems,
  crystalCap,
  crystalLevel,
  evolveResonance,
  pokemonNeededFor,
  sharedLevels,
  slotPrice,
  topSix,
  upgradeCost,
  type AccountState,
  type ResonanceTables,
  type ResonanceWild,
} from '@wildbound/engine';
import type { GameConfig } from './config';
import { pay } from './equipment';
import { fail, ok, type Result } from './index';

/**
 * R7: Resonance from the source (engine `resonance`, content tuning/resonance.json). Pokémon in slots — and,
 * once the crystal has evolved, the top six too — take the crystal level; their own level is kept in
 * `ownLevel` and comes back when they leave. `syncResonance` writes the shared levels after every change.
 */

export interface ResonanceSlotView {
  slot: number;
  wildId: string | null;
  wildName: string | null;
  ownLevel: number | null;
  /** Cooldown end (epoch ms) and the Diamonds to clear it now; null when the slot is free to fill. */
  cooldownEndsAt: number | null;
  clearGems: number;
}

export interface ResonanceView {
  crystalLevel: number;
  evolved: boolean;
  canEvolve: boolean;
  evolutionLevel: number;
  /** The six that set the level (before evolution) or share it (after). */
  topSix: { wildId: string; name: string; level: number }[];
  slots: ResonanceSlotView[];
  maxSlots: number;
  /** Price of the next slot (Resonation Shards, or Diamonds when short); null at the limit. */
  nextSlot: { shards: number; gems: number } | null;
  /** Evolved only: the crystal's cap, the next level's price and the 12★ count it needs. */
  cap: number | null;
  upgrade: { candy: number; gold: number; stones: number } | null;
  pokemonNeeded: { stars: number; have: number; need: number } | null;
  /** Pokémon that can go in a slot (not resonating, not Origins). */
  candidates: { wildId: string; name: string; level: number }[];
  balances: { resonationShard: number; gems: number; candy: number; gold: number; stone: number };
}

export function resonanceTables(config: GameConfig): ResonanceTables {
  return config.resonance;
}

/** What the Resonance helpers need from the config (held-item actions pass a narrower one). */
interface SpeciesTiers {
  species: Map<string, { tier: string }>;
}

function isOrigin(config: SpeciesTiers, speciesId: string): boolean {
  return config.species.get(speciesId)?.tier === 'origin';
}

export function resonanceWilds(config: SpeciesTiers, state: AccountState): ResonanceWild[] {
  return state.roster.map((w) => ({
    id: w.id,
    level: w.ownLevel ?? w.level,
    stars: w.stars,
    origin: isOrigin(config, w.speciesId),
  }));
}

/** The crystal level right now (0 before six Pokémon exist). Held-item level gates read this. */
export function resonanceLevel(config: SpeciesTiers, state: AccountState): number {
  return crystalLevel(state.resonance, resonanceWilds(config, state));
}

/** Write the shared levels onto the roster (and give back own levels to Pokémon that stopped sharing). */
export function syncResonance(config: GameConfig, state: AccountState): AccountState {
  const shared = sharedLevels(state.resonance, resonanceWilds(config, state));
  let changed = false;
  const roster = state.roster.map((w) => {
    const target = shared.get(w.id);
    if (target !== undefined) {
      const own = w.ownLevel ?? w.level;
      if (w.level === target && w.ownLevel === own) return w;
      changed = true;
      return { ...w, level: target, ownLevel: own };
    }
    if (w.ownLevel === undefined) return w;
    changed = true;
    const { ownLevel, ...rest } = w;
    return { ...rest, level: ownLevel };
  });
  return changed ? { ...state, roster } : state;
}

/** True when the Pokémon's level is the crystal's (it cannot be levelled by hand). */
export function isResonating(state: AccountState, wildId: string): boolean {
  return state.roster.find((w) => w.id === wildId)?.ownLevel !== undefined;
}

export function buildResonanceView(config: GameConfig, state: AccountState, now: number): ResonanceView {
  const t = resonanceTables(config);
  const r = state.resonance;
  const wilds = resonanceWilds(config, state);
  const name = (id: string) => {
    const w = state.roster.find((x) => x.id === id);
    return (w && config.species.get(w.speciesId)?.name) ?? id;
  };
  const level = crystalLevel(r, wilds);
  const slotted = new Set(r.slots.filter((s): s is string => !!s));
  const six = topSix(r, wilds);
  const sixIds = new Set(six.map((w) => w.id));
  const twelves = wilds.filter((w) => w.stars >= t.capStars).length;
  const cap = r.evolved ? crystalCap(wilds, t) : null;
  return {
    crystalLevel: level,
    evolved: r.evolved,
    canEvolve: canEvolve(r, wilds, t),
    evolutionLevel: t.evolutionLevel,
    topSix: six.map((w) => ({ wildId: w.id, name: name(w.id), level: r.evolved ? level : w.level })),
    slots: r.slots.map((wildId, slot) => {
      const ends = r.cooldowns[slot] ?? null;
      const live = ends && ends > now ? ends : null;
      const w = wildId ? state.roster.find((x) => x.id === wildId) : undefined;
      return {
        slot,
        wildId,
        wildName: wildId ? name(wildId) : null,
        ownLevel: w ? (w.ownLevel ?? w.level) : null,
        cooldownEndsAt: live,
        clearGems: cooldownClearGems(live, now, t),
      };
    }),
    maxSlots: r.evolved ? t.maxSlotsEvolved : t.maxSlots,
    nextSlot: slotPrice(r, t),
    cap,
    upgrade: r.evolved && cap !== null && level < cap ? upgradeCost(level, t) : null,
    pokemonNeeded: r.evolved ? { stars: t.capStars, have: twelves, need: pokemonNeededFor(level, t) } : null,
    candidates: wilds
      .filter((w) => !w.origin && !slotted.has(w.id) && !(r.evolved && sixIds.has(w.id)))
      .map((w) => ({ wildId: w.id, name: name(w.id), level: w.level })),
    balances: {
      resonationShard: state.currencies.resonationShard ?? 0,
      gems: state.currencies.gems ?? 0,
      candy: state.currencies.candy ?? 0,
      gold: state.currencies.gold ?? 0,
      stone: state.currencies.stone ?? 0,
    },
  };
}

function withResonance(config: GameConfig, state: AccountState, resonance: AccountState['resonance']): AccountState {
  return syncResonance(config, { ...state, resonance });
}

/** Open the next slot with Resonation Shards, or Diamonds when the shards are short. */
export function buyResonanceSlotAction(config: GameConfig, state: AccountState): Result<AccountState> {
  const r = state.resonance;
  const price = slotPrice(r, resonanceTables(config));
  if (!price) return fail('at_level_cap', 'every slot is open');
  const paid =
    (state.currencies.resonationShard ?? 0) >= price.shards
      ? pay(state, { resonationShard: price.shards })
      : pay(state, { gems: price.gems });
  if (!paid) return fail('insufficient_items', 'not enough Resonation Shards or Diamonds');
  return ok(withResonance(config, paid, { ...r, slots: [...r.slots, null], cooldowns: [...r.cooldowns, null] }));
}

/**
 * Put a Pokémon in a slot (null takes it out). Taking one out starts the slot's 24-hour cooldown; a slot on
 * cooldown cannot be filled until it ends or is cleared. Origins never resonate.
 */
export function setResonanceSlotAction(
  config: GameConfig,
  state: AccountState,
  slot: number,
  wildId: string | null,
  now: number,
): Result<AccountState> {
  const t = resonanceTables(config);
  const r = state.resonance;
  if (!Number.isInteger(slot) || slot < 0 || slot >= r.slots.length) return fail('invalid_input', `no open slot ${slot}`);
  const current = r.slots[slot] ?? null;
  const slots = [...r.slots];
  const cooldowns = [...r.cooldowns];
  if (wildId === null) {
    if (!current) return ok(state);
    slots[slot] = null;
    cooldowns[slot] = now + t.cooldownHours * 3_600_000;
    return ok(withResonance(config, state, { ...r, slots, cooldowns }));
  }
  const wild = state.roster.find((w) => w.id === wildId);
  if (!wild) return fail('not_found', `no Wild ${wildId}`);
  if (isOrigin(config, wild.speciesId)) return fail('invalid_input', 'Origins cannot resonate');
  if (current) return fail('in_use', 'take the Pokémon in this slot out first');
  if ((cooldowns[slot] ?? 0) > now) return fail('not_ready', 'this slot is cooling down');
  if (r.slots.includes(wildId)) return fail('in_use', 'that Pokémon is already in a slot');
  if (r.evolved && topSix(r, resonanceWilds(config, state)).some((w) => w.id === wildId)) {
    return fail('in_use', 'that Pokémon already shares the crystal level');
  }
  slots[slot] = wildId;
  cooldowns[slot] = null;
  return ok(withResonance(config, state, { ...r, slots, cooldowns }));
}

/** Clear a slot's cooldown for ceil(hours left) × 4 Diamonds. */
export function clearResonanceCooldownAction(config: GameConfig, state: AccountState, slot: number, now: number): Result<AccountState> {
  const r = state.resonance;
  const gems = cooldownClearGems(r.cooldowns[slot] ?? null, now, resonanceTables(config));
  if (gems <= 0) return fail('invalid_input', 'no cooldown on that slot');
  const paid = pay(state, { gems });
  if (!paid) return fail('insufficient_items', 'not enough Diamonds');
  const cooldowns = [...r.cooldowns];
  cooldowns[slot] = null;
  return ok({ ...paid, resonance: { ...r, cooldowns } });
}

/** Evolve the crystal (free) once the top six reach the evolution level: six free slots. */
export function evolveResonanceAction(config: GameConfig, state: AccountState): Result<AccountState> {
  const t = resonanceTables(config);
  const wilds = resonanceWilds(config, state);
  if (!canEvolve(state.resonance, wilds, t)) return fail('not_ready', `the top six must all reach Lv ${t.evolutionLevel}`);
  return ok(withResonance(config, state, evolveResonance(state.resonance, wilds, t)));
}

/** Raise the evolved crystal one level (XP Candy, Gold, Ascension Stones), up to 340 + 8 per 12★ Pokémon. */
export function upgradeResonanceAction(config: GameConfig, state: AccountState): Result<AccountState> {
  const t = resonanceTables(config);
  const r = state.resonance;
  if (!r.evolved) return fail('not_ready', 'evolve the crystal first');
  const wilds = resonanceWilds(config, state);
  const have = wilds.filter((w) => w.stars >= t.capStars).length;
  const need = pokemonNeededFor(r.level, t);
  if (have < need || r.level >= crystalCap(wilds, t)) {
    return fail('at_level_cap', `needs ${need} Pokémon at ${t.capStars}★ (have ${have})`);
  }
  const cost = upgradeCost(r.level, t);
  const paid = pay(state, { candy: cost.candy, gold: cost.gold, stone: cost.stones });
  if (!paid) return fail('insufficient_items', 'not enough XP Candy, Gold or Ascension Stones');
  return ok(withResonance(config, paid, { ...r, level: r.level + 1 }));
}
