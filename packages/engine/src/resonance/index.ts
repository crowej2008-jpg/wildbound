/**
 * R7: Resonance from the source (packages/content/tuning/resonance.json; kb/resonance.md).
 *
 * The six highest-level Pokémon (not slotted, not Origins) form the "top six"; before the crystal evolves its
 * level is the lowest of theirs, and every Pokémon in a resonance slot takes that level — past its own cap.
 * When the top six all reach the evolution level (340) the crystal can evolve (free): six more slots open and
 * from then on the crystal is levelled directly (XP Candy, Gold, Ascension Stones) up to 340 + 8 per Pokémon
 * at 12★, and the top six share its level too. Slots: 2 open, the rest bought with Resonation Shards or
 * Diamonds; taking a Pokémon out puts the slot on a 24-hour cooldown (4 Diamonds an hour to clear). A shared
 * Pokémon keeps its own level in `ownLevel` and drops back to it when it leaves. Pure.
 */

export interface ResonanceTables {
  defaultSlots: number;
  evolutionSlots: number;
  evolutionLevel: number;
  cooldownHours: number;
  clearGemsPerHour: number;
  maxSlots: number;
  maxSlotsEvolved: number;
  capBase: number;
  capPerPokemon: number;
  capStars: number;
  slotPrices: { openNum: number; shards: number; gems: number }[];
  /** The cost of the next level at the levels the source's server was read (interpolated between). */
  upgradePoints: { level: number; candy: number; stones: number }[];
  goldPerCandy: number;
}

export interface ResonanceState {
  /** Pokémon ids in the open slots (null = empty). Its length is the number of open slots. */
  slots: (string | null)[];
  /** Per slot: when its cooldown ends (epoch ms), or null. */
  cooldowns: (number | null)[];
  evolved: boolean;
  /** The evolved crystal's own level (0 before evolution). */
  level: number;
}

/** What Resonance needs to know about each Pokémon. */
export interface ResonanceWild {
  id: string;
  /** The Pokémon's own level (its `ownLevel` while shared). */
  level: number;
  stars: number;
  origin: boolean;
}

export function initialResonance(tables: ResonanceTables): ResonanceState {
  return {
    slots: Array.from({ length: tables.defaultSlots }, () => null),
    cooldowns: Array.from({ length: tables.defaultSlots }, () => null),
    evolved: false,
    level: 0,
  };
}

/** The six highest own levels among Pokémon that are not slotted and not Origins (ties: roster order). */
export function topSix(state: ResonanceState, wilds: readonly ResonanceWild[]): ResonanceWild[] {
  const slotted = new Set(state.slots.filter((s): s is string => !!s));
  return wilds
    .filter((w) => !w.origin && !slotted.has(w.id))
    .map((w, i) => ({ w, i }))
    .sort((a, b) => b.w.level - a.w.level || a.i - b.i)
    .slice(0, 6)
    .map(({ w }) => w);
}

/** The crystal level: the evolved crystal's own level, else the lowest of the top six (0 with fewer than six). */
export function crystalLevel(state: ResonanceState, wilds: readonly ResonanceWild[]): number {
  if (state.evolved) return state.level;
  const six = topSix(state, wilds);
  return six.length < 6 ? 0 : Math.min(...six.map((w) => w.level));
}

export function canEvolve(state: ResonanceState, wilds: readonly ResonanceWild[], tables: ResonanceTables): boolean {
  return !state.evolved && crystalLevel(state, wilds) >= tables.evolutionLevel;
}

/** Evolve the crystal: six free slots, and the crystal keeps the level the top six had. */
export function evolveResonance(state: ResonanceState, wilds: readonly ResonanceWild[], tables: ResonanceTables): ResonanceState {
  const level = crystalLevel(state, wilds);
  return {
    slots: [...state.slots, ...Array.from({ length: tables.evolutionSlots }, () => null)],
    cooldowns: [...state.cooldowns, ...Array.from({ length: tables.evolutionSlots }, () => null)],
    evolved: true,
    level,
  };
}

/** Pokémon at `capStars`★ or more needed to raise the evolved crystal from `level` (source need_pet_num). */
export function pokemonNeededFor(level: number, tables: ResonanceTables): number {
  return Math.floor((level - tables.capBase) / tables.capPerPokemon) + 1;
}

/** The evolved crystal's cap: 340 + 8 per Pokémon at 12★ or more. */
export function crystalCap(wilds: readonly ResonanceWild[], tables: ResonanceTables): number {
  return tables.capBase + tables.capPerPokemon * wilds.filter((w) => w.stars >= tables.capStars).length;
}

/**
 * The price of `level` → `level + 1`: the server's numbers at the levels read, linear between them (and along
 * the nearest two outside them); Candy to 2,500, Stones to 50, Gold = 3 × Candy.
 */
export function upgradeCost(level: number, tables: ResonanceTables): { candy: number; gold: number; stones: number } {
  const pts = tables.upgradePoints;
  const exact = pts.find((p) => p.level === level);
  let candy: number;
  let stones: number;
  if (exact) {
    ({ candy, stones } = exact);
  } else {
    let i = pts.findIndex((p) => p.level > level);
    if (i <= 0) i = i === 0 ? 1 : pts.length - 1;
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const f = (level - a.level) / (b.level - a.level);
    candy = Math.max(2500, Math.round((a.candy + f * (b.candy - a.candy)) / 2500) * 2500);
    stones = Math.max(50, Math.round((a.stones + f * (b.stones - a.stones)) / 50) * 50);
  }
  return { candy, gold: candy * tables.goldPerCandy, stones };
}

/** The price of opening one more slot (Resonation Shards, or Diamonds when short); null at the limit. */
export function slotPrice(state: ResonanceState, tables: ResonanceTables): { shards: number; gems: number } | null {
  const open = state.slots.length;
  const max = state.evolved ? tables.maxSlotsEvolved : tables.maxSlots;
  if (open >= max) return null;
  const row = state.evolved ? open - tables.evolutionSlots + 1 : open + 1;
  const p = tables.slotPrices.find((r) => r.openNum === row) ?? tables.slotPrices[tables.slotPrices.length - 1];
  return p ? { shards: p.shards, gems: p.gems } : null;
}

/** Diamonds to clear a slot's cooldown now: ceil(hours left) × 4. */
export function cooldownClearGems(endsAt: number | null, now: number, tables: ResonanceTables): number {
  if (!endsAt || endsAt <= now) return 0;
  return Math.ceil((endsAt - now) / 3_600_000) * tables.clearGemsPerHour;
}

/** The level each shared Pokémon should show: slotted ones always, the top six once evolved. */
export function sharedLevels(state: ResonanceState, wilds: readonly ResonanceWild[]): Map<string, number> {
  const level = crystalLevel(state, wilds);
  const out = new Map<string, number>();
  if (level <= 0) return out;
  for (const id of state.slots) if (id) out.set(id, level);
  if (state.evolved) for (const w of topSix(state, wilds)) out.set(w.id, level);
  return out;
}
