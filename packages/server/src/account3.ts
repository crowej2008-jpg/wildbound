import { dayKey, isGymCleared, mulberry32, type AccountState, type Faction, type Rewards, type StatLine } from '@wildbound/engine';
import type { GameConfig } from './config';
import { counter } from './counters';
import { applyGrant } from './economy';
import { fail, ok, type Result } from './index';

/**
 * M15 Account systems III (source copies): trainer treasures, the Z Ring and its Pure Crystals, Different Dimension
 * fusion skins, the Golden Egg and the Awakening. Their stats join the account-wide fold (faction-specific ones apply
 * to that faction's Pokémon). Battle skills of treasures, crystals and skins are not built (engine work). See
 * docs/design/account-systems-3.md.
 */

export type Account3State = NonNullable<AccountState['account3']>;

export function initialAccount3(): Account3State {
  return { treasures: {}, wristband: 0, crystals: {}, fusion: {}, fusionShards: {}, egg: { day: '', free: 0, points: 0, smashes: 0, bought: {} }, awaken: { wildId: null, progress: {}, base: {} } };
}

function a3(state: AccountState): Account3State {
  return state.account3 ?? initialAccount3();
}

function withA3(state: AccountState, next: Account3State): AccountState {
  return { ...state, account3: next };
}

function spend(state: AccountState, currency: string, n: number): AccountState | null {
  const have = (state.currencies as Record<string, number>)[currency] ?? 0;
  if (have < n) return null;
  return { ...state, currencies: { ...state.currencies, [currency]: have - n } };
}

// ---------------------------------------------------------------- Trainer treasures

export function treasureUnlocked(config: GameConfig, state: AccountState, type: number): boolean {
  const t = config.account3.treasures.list.find((x) => x.type === type);
  return !!t && isGymCleared(state.campaign, `gym-${t.gym}`);
}

export function treasureSkillLevel(config: GameConfig, state: AccountState, type: number): number {
  const t = config.account3.treasures.list.find((x) => x.type === type);
  const s = a3(state).treasures[String(type)];
  if (!t || !s) return 0;
  let lv = 0;
  for (const k of t.skills) if (s.level >= k.treasureLevel && s.accessory >= k.accessory && s.refine >= k.refine) lv = k.level;
  return lv;
}

function treasureOf(config: GameConfig, state: AccountState, type: number) {
  if (!treasureUnlocked(config, state, type)) return null;
  return a3(state).treasures[String(type)] ?? { level: 1, accessory: 0, refine: 0, star: 0, faction: null as Faction | null };
}

export type TreasureAction = 'level' | 'accessory' | 'refine' | 'star';

const TREASURE_CURRENCY: Record<TreasureAction, string> = { level: 'treasureLiquid', accessory: 'treasureAccessory', refine: 'treasureRefine', star: 'treasureAwakenStone' };

export function treasureCost(config: GameConfig, state: AccountState, type: number, action: TreasureAction): number | null {
  const t = config.account3.treasures.list.find((x) => x.type === type)!;
  const s = treasureOf(config, state, type);
  if (!s) return null;
  const lc = config.account3.treasures.levelCost;
  if (action === 'level') return s.level >= config.account3.treasures.maxLevel ? null : lc.base + lc.perLevel * s.level;
  if (action === 'accessory') return t.accessory.find((a) => a.level === s.accessory + 1)?.cost ?? null;
  if (action === 'refine') {
    const r = t.refine.find((x) => x.level === s.refine + 1);
    return r && s.level >= (r.treasureLevel ?? 0) ? (r.cost ?? 0) : null;
  }
  return t.stars.find((x) => x.star === s.star + 1)?.cost ?? null;
}

export function upgradeTreasure(config: GameConfig, state: AccountState, type: number, action: TreasureAction): Result<AccountState> {
  const s = treasureOf(config, state, type);
  if (!s) return fail('resource_locked', 'beat its Victory Road gym to unlock this treasure');
  const cost = treasureCost(config, state, type, action);
  if (cost === null) return fail('at_level_cap', 'nothing more to raise here');
  const paid = spend(state, TREASURE_CURRENCY[action], cost);
  if (!paid) return fail('insufficient_items', `needs ${cost}`);
  const field = action === 'star' ? 'star' : action;
  const next = { ...s, [field]: (s as Record<string, number | null>)[field] as number + 1 };
  const cur = a3(paid);
  return ok(withA3(paid, { ...cur, treasures: { ...cur.treasures, [String(type)]: next } }));
}

/** Pick the faction a treasure's awakening boosts (one treasure per faction; two once five are unlocked). */
export function setTreasureFaction(config: GameConfig, state: AccountState, type: number, faction: Faction): Result<AccountState> {
  const s = treasureOf(config, state, type);
  if (!s) return fail('resource_locked', 'treasure locked');
  const cur = a3(state);
  const unlocked = config.account3.treasures.list.filter((x) => treasureUnlocked(config, state, x.type)).length;
  const per = unlocked >= 5 ? 2 : 1;
  const using = Object.entries(cur.treasures).filter(([k, v]) => k !== String(type) && v.faction === faction).length;
  if (using >= per) return fail('invalid_input', `at most ${per} treasure(s) per faction`);
  return ok(withA3(state, { ...cur, treasures: { ...cur.treasures, [String(type)]: { ...s, faction } } }));
}

export function resonanceLevel3(config: GameConfig, state: AccountState): number {
  const levels = config.account3.treasures.list.map((t) => treasureSkillLevel(config, state, t.type)).sort((a, b) => b - a);
  if (levels.length < 5) return 0;
  return levels[4]!;
}

// ---------------------------------------------------------------- Z Ring and Pure Crystals

export function crystalCap(config: GameConfig, wristband: number): number {
  let cap = 0;
  for (const c of config.account3.wristband.crystalCaps) if (wristband >= c.wristband) cap = Math.max(cap, c.maxLevel);
  return cap;
}

export function levelWristband(config: GameConfig, state: AccountState): Result<AccountState> {
  const cur = a3(state);
  const row = config.account3.wristband.levels.find((l) => l.level === cur.wristband + 1);
  if (!row) return fail('at_level_cap', 'the Z Ring is at its top level');
  const paid = spend(state, 'wristbandEssence', row.cost);
  if (!paid) return fail('insufficient_items', `needs ${row.cost} Wristband Essence`);
  return ok(withA3(paid, { ...cur, wristband: cur.wristband + 1 }));
}

export function levelCrystal(config: GameConfig, state: AccountState, faction: Faction): Result<AccountState> {
  const cur = a3(state);
  const c = config.account3.wristband.crystals.find((x) => x.faction === faction);
  if (!c) return fail('not_found', 'no such crystal');
  const lv = cur.crystals[faction] ?? 0;
  if (lv + 1 > crystalCap(config, cur.wristband)) return fail('resource_locked', 'raise the Z Ring to raise this crystal further');
  const row = c.levels.find((l) => l.level === lv + 1);
  if (!row) return fail('at_level_cap', 'crystal at its top level');
  const paid = spend(state, 'crystalEssence', row.cost);
  if (!paid) return fail('insufficient_items', `needs ${row.cost} Crystal Essence`);
  return ok(withA3(paid, { ...cur, crystals: { ...cur.crystals, [faction]: lv + 1 } }));
}

// ---------------------------------------------------------------- Fusion skins

export function levelFusion(config: GameConfig, state: AccountState, id: number): Result<AccountState> {
  const cur = a3(state);
  const f = config.account3.fusion.find((x) => x.id === id);
  if (!f) return fail('not_found', 'no such skin');
  const lv = cur.fusion[String(id)] ?? 0;
  const row = f.levels.find((l) => l.level === lv + 1);
  if (!row) return fail('at_level_cap', 'skin at its top level');
  const have = cur.fusionShards[String(id)] ?? 0;
  if (have < row.cost) return fail('insufficient_items', `needs ${row.cost} of this skin's shards`);
  return ok(withA3(state, { ...cur, fusion: { ...cur.fusion, [String(id)]: lv + 1 }, fusionShards: { ...cur.fusionShards, [String(id)]: have - row.cost } }));
}

/** A fusion perk's value (percent) by its perk text keyword, best skin owned (e.g. 'Faction Tower', 'Misty'). */
export function fusionPerk(config: GameConfig, state: AccountState, keyword: string): number {
  const cur = a3(state);
  let best = 0;
  for (const f of config.account3.fusion) {
    if (!f.perk.toLowerCase().includes(keyword.toLowerCase())) continue;
    const lv = cur.fusion[String(f.id)] ?? 0;
    best = Math.max(best, f.levels.find((l) => l.level === lv)?.perkValue ?? 0);
  }
  return best;
}

// ---------------------------------------------------------------- Golden Egg

function rollEgg(config: GameConfig, rng: () => number) {
  const rows = config.account3.egg.jackpot;
  const total = rows.reduce((s, r) => s + r.weight, 0);
  let x = rng() * total;
  return rows.find((r) => (x -= r.weight) < 0) ?? rows[rows.length - 1]!;
}

/** Smash 1, 10 or 30 eggs with Golden Egg Vouchers (one free smash a day). Each pays shards or items and 1 Egg Point. */
export function smashEggs(config: GameConfig, state: AccountState, now: number, times: 1 | 10 | 30): Result<{ state: AccountState; rewards: Rewards; shards: Record<string, number> }> {
  let cur = a3(state);
  const day = dayKey(now);
  if (cur.egg.day !== day) cur = { ...cur, egg: { ...cur.egg, day, free: 0 } };
  const free = times === 1 && cur.egg.free < config.account3.egg.freePerDay;
  let next = state;
  if (!free) {
    const paid = spend(state, 'goldenEggVoucher', times);
    if (!paid) return fail('insufficient_items', `needs ${times} Golden Egg Voucher(s)`);
    next = paid;
  }
  const rng = mulberry32(((now & 0xffffffff) ^ (cur.egg.smashes * 2654435761)) >>> 0);
  let rewards: Rewards = {};
  const shards: Record<string, number> = {};
  for (let i = 0; i < times; i += 1) {
    const r = rollEgg(config, rng);
    if ('species' in r && r.species) shards[r.species] = (shards[r.species] ?? 0) + (r.shards ?? 0);
    else if ('rewards' in r && r.rewards) for (const [k, v] of Object.entries(r.rewards)) rewards = { ...rewards, [k]: ((rewards as Record<string, number>)[k] ?? 0) + (v as number) };
  }
  const speciesShards = { ...next.speciesShards };
  for (const [id, n] of Object.entries(shards)) speciesShards[id] = (speciesShards[id] ?? 0) + n;
  cur = { ...cur, egg: { ...cur.egg, free: cur.egg.free + (free ? 1 : 0), points: cur.egg.points + times * config.account3.egg.pointsPerSmash, smashes: cur.egg.smashes + times } };
  return ok({ state: applyGrant(config, withA3({ ...next, speciesShards }, cur), rewards), rewards, shards });
}

export function buyEggShop(config: GameConfig, state: AccountState, id: number): Result<AccountState> {
  const cur = a3(state);
  const row = config.account3.egg.shop.find((r) => r.id === id);
  if (!row) return fail('not_found', 'no such offer');
  const bought = cur.egg.bought[String(id)] ?? 0;
  if (bought >= row.limit) return fail('daily_limit', 'sold out');
  if (cur.egg.points < row.price) return fail('insufficient_items', `needs ${row.price} Egg Points`);
  const species = row.species!;
  return ok(
    withA3(
      { ...state, speciesShards: { ...state.speciesShards, [species]: (state.speciesShards[species] ?? 0) + row.shards } },
      { ...cur, egg: { ...cur.egg, points: cur.egg.points - row.price, bought: { ...cur.egg.bought, [String(id)]: bought + 1 } } },
    ),
  );
}

// ---------------------------------------------------------------- Awakening

const AWAKEN_COUNTER: Record<string, (s: AccountState) => number> = {
  '{chest,2}': (s) => counter(s, 'premiumDraws'),
  egg_times: (s) => a3(s).egg.smashes,
};

export function awakeningOpen(config: GameConfig, state: AccountState, now: number): boolean {
  const day = Math.floor((now - state.serverEpoch) / 86_400_000) + 1;
  return day >= config.account3.awaken.serverDay && state.roster.filter((w) => w.stars >= 18).length >= config.account3.awaken.at18;
}

/** Choose the Pokémon that trains (one at a time; progress is kept per Pokémon). */
export function chooseAwakening(config: GameConfig, state: AccountState, now: number, wildId: string): Result<AccountState> {
  if (!awakeningOpen(config, state, now)) return fail('resource_locked', 'the Awakening opens on server day 60 with twelve Pokémon at 18★');
  const w = state.roster.find((x) => x.id === wildId);
  if (!w || w.stars !== 18) return fail('invalid_input', 'pick a Pokémon at 18★');
  const cur = a3(state);
  const base: Record<string, number> = {};
  for (const [ev, f] of Object.entries(AWAKEN_COUNTER)) base[ev] = f(state);
  return ok(withA3(state, { ...cur, awaken: { ...cur.awaken, wildId, base } }));
}

/** Progress for the trainee: each finished task (repeatable) adds its progress. */
export function awakeningProgress(config: GameConfig, state: AccountState): number {
  const cur = a3(state);
  const id = cur.awaken.wildId;
  if (!id) return 0;
  let p = cur.awaken.progress[id] ?? 0;
  for (const t of config.account3.awaken.tasks) {
    const f = AWAKEN_COUNTER[t.event];
    if (!f) continue;
    const done = Math.floor((f(state) - (cur.awaken.base[t.event] ?? 0)) / t.value);
    p += done * t.progress;
  }
  return Math.min(config.account3.awaken.need, p);
}

/** Whether this Pokémon may take its 18★ → 19★ step. */
export function awakened(config: GameConfig, state: AccountState, wildId: string): boolean {
  const cur = a3(state);
  return cur.awaken.wildId === wildId ? awakeningProgress(config, state) >= config.account3.awaken.need : (cur.awaken.progress[wildId] ?? 0) >= config.account3.awaken.need;
}

// ---------------------------------------------------------------- Stats

function toLines(rows: { kind: string; field: string; value: number }[]): StatLine[] {
  return rows.map((l) => ({ kind: l.kind as StatLine['kind'], field: l.field, base: l.value, perLevel: 0 }));
}

/** Account-wide lines (Z Ring, fusion skins, treasure resonance) plus the faction's (treasure awakening, crystal). */
export function account3Lines(config: GameConfig, state: AccountState, faction: Faction | undefined): StatLine[] {
  if (!state.account3) return [];
  const t = config.account3;
  const cur = state.account3;
  const out: StatLine[] = [];
  const wb = t.wristband.levels.find((l) => l.level === cur.wristband);
  if (wb) out.push(...toLines(wb.lines));
  for (const f of t.fusion) {
    const row = f.levels.find((l) => l.level === (cur.fusion[String(f.id)] ?? 0));
    if (row) out.push(...toLines(row.lines));
  }
  const res = t.treasures.resonance.find((r) => r.level === resonanceLevel3(config, state));
  if (res) out.push(...toLines(res.lines));
  if (faction) {
    for (const tr of t.treasures.list) {
      const s = cur.treasures[String(tr.type)];
      if (!s || s.faction !== faction) continue;
      const star = tr.stars.find((x) => x.star === s.star);
      if (star) out.push(...toLines(star.lines));
    }
    const c = t.wristband.crystals.find((x) => x.faction === faction);
    const row = c?.levels.find((l) => l.level === (cur.crystals[faction] ?? 0));
    if (row) out.push(...toLines(row.lines));
  }
  return out;
}
