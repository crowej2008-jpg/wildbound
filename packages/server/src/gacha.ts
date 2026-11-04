import {
  activeWish,
  boxProgress,
  boxReady,
  dayKey,
  drawBatch,
  emptyMachineState,
  GACHA_HISTORY_LIMIT,
  giftReady,
  groupTable,
  openGift,
  probabilityTable,
  resolveSummonCost,
  summonCounts,
  wellUnlocked,
  type AccountState,
  type CurrencyId,
  type DrawResult,
  type Faction,
  type GachaGroup,
  type GachaHistoryEntry,
  type GachaMachineDef,
  type GachaMachineState,
  type GachaState,
  type MachineId,
  type Rewards,
  type Rng,
  type RowProbability,
  type SummonCost,
  type WildInstance,
} from '@wildbound/engine';
import { applyGrant } from './economy';
import { firstStar, type GameConfig } from './config';
import type { Outcome } from './outcome';
import { vipPerks } from './vip';

/**
 * Server-side summoning glue — R9, copied from the source (docs/design/gacha.md, ASSUMPTIONS #83).
 * The engine owns the rules; these functions read the injected config and return new state.
 */

export function machineById(config: GameConfig, machine: MachineId): GachaMachineDef | undefined {
  return config.gacha.machines.find((m) => m.id === machine);
}

/**
 * The daily reset refills every machine's free draws but keeps its running timer (kb/gacha.md:
 * a free Premium draw taken late in one day blocks the next day's until 24 hours have passed).
 */
export function refillGacha(machines: readonly GachaMachineDef[], gacha: GachaState, day: string): GachaState {
  if (gacha.day === day) return gacha;
  const next = { ...gacha.machines };
  for (const def of machines) {
    const current = next[def.id] ?? emptyMachineState();
    next[def.id] = { ...current, freeRemaining: def.freePerDay };
  }
  return { ...gacha, day, machines: next };
}

/** Add drawn Pokémon to the roster at their drawn star; the first sighting of a species is "new". */
function grantDraws(
  state: AccountState,
  draws: readonly Omit<DrawResult, 'isNew'>[],
  now: number,
): { state: AccountState; draws: DrawResult[] } {
  const known = new Set(state.roster.map((w) => w.speciesId));
  let seq = state.nextInstanceSeq;
  const roster = [...state.roster];
  const out = draws.map((d): DrawResult => {
    const isNew = !known.has(d.speciesId);
    known.add(d.speciesId);
    const instance: WildInstance = { id: `w${seq++}`, speciesId: d.speciesId, level: 1, stars: d.star, locked: false, acquiredAt: now };
    roster.push(instance);
    return { ...d, isNew };
  });
  return { state: { ...state, roster, nextInstanceSeq: seq }, draws: out };
}

function historyOf(gacha: GachaState, machine: GachaHistoryEntry['machine'], draws: readonly DrawResult[], now: number): GachaHistoryEntry[] {
  return [
    ...gacha.history,
    ...draws.map((d) => ({ machine, speciesId: d.speciesId, star: d.star, tier: d.tier, isNew: d.isNew, at: now })),
  ].slice(-GACHA_HISTORY_LIMIT);
}

export interface SummonValue {
  state: AccountState;
  draws: DrawResult[];
  cost: SummonCost;
}

/**
 * Resolve the price, spend it, roll `count` draws from the machine's pool, grant each Pokémon at
 * its drawn star, and add the box and VIP credits.
 */
export function applySummon(
  config: GameConfig,
  state: AccountState,
  machineId: MachineId,
  count: number,
  now: number,
  rng: Rng,
): Outcome<SummonValue> {
  const machine = machineById(config, machineId);
  if (!machine) return { ok: false, error: 'not_found', message: `unknown machine "${machineId}"` };
  if (!summonCounts(machine).includes(count)) {
    return { ok: false, error: 'invalid_input', message: `this machine draws ${summonCounts(machine).join(', ')}` };
  }

  const gacha = refillGacha(config.gacha.machines, state.gacha, dayKey(now));
  const ms = gacha.machines[machineId] ?? emptyMachineState();
  const freeAvailable = ms.nextFreeAt <= now ? ms.freeRemaining : 0;
  const resolution = resolveSummonCost(machine, count, state.currencies, freeAvailable);
  if (!resolution.ok) {
    return { ok: false, error: resolution.reason, message: 'not enough tickets or gems for that draw' };
  }
  const cost = resolution.cost;

  const currencies: Record<CurrencyId, number> = { ...state.currencies };
  if (cost.tickets > 0) {
    const ticket = machine.ticket as CurrencyId;
    currencies[ticket] = Math.max(0, (currencies[ticket] ?? 0) - cost.tickets);
  }
  if (cost.gems > 0) currencies.gems = Math.max(0, currencies.gems - cost.gems);

  const wish = activeWish(config.gacha.wishingWell, machine, ms, gacha.wishFaction);
  const rolled = drawBatch(rng, config.gacha.pools[machineId], wish, count);
  const granted = grantDraws({ ...state, currencies }, rolled, now);

  const machineState: GachaMachineState = {
    ...ms,
    freeRemaining: Math.max(0, ms.freeRemaining - cost.free),
    nextFreeAt: cost.free > 0 ? now + machine.freeCooldownMinutes * 60_000 : ms.nextFreeAt,
    boxCredits: ms.boxCredits + machine.creditPerDraw * count,
    lifetimeDraws: ms.lifetimeDraws + count,
  };
  const nextGacha: GachaState = {
    ...gacha,
    machines: { ...gacha.machines, [machineId]: machineState },
    vipCredits: gacha.vipCredits + machine.vipCreditPerDraw * count,
    history: historyOf(gacha, machineId, granted.draws, now),
  };
  return { ok: true, value: { state: { ...granted.state, gacha: nextGacha }, draws: granted.draws, cost } };
}

/** Spend a machine's box credits and grant its box reward (repeatable). */
export function applyClaimBox(
  config: GameConfig,
  state: AccountState,
  machineId: MachineId,
  now: number,
): Outcome<{ state: AccountState; granted: Rewards }> {
  const machine = machineById(config, machineId);
  if (!machine) return { ok: false, error: 'not_found', message: `unknown machine "${machineId}"` };
  const gacha = refillGacha(config.gacha.machines, state.gacha, dayKey(now));
  const ms = gacha.machines[machineId] ?? emptyMachineState();
  if (!boxReady(ms, machine)) return { ok: false, error: 'not_ready', message: 'no summon box is ready yet' };

  const machineState: GachaMachineState = { ...ms, boxCredits: ms.boxCredits - machine.boxCreditsNeeded };
  const next = applyGrant(
    config,
    { ...state, gacha: { ...gacha, machines: { ...gacha.machines, [machineId]: machineState } } },
    machine.boxRewards,
  );
  return { ok: true, value: { state: next, granted: machine.boxRewards } };
}

/** Choose (or clear) the Wishing Well's faction; it must be unlocked and one of the Well's factions. */
export function applySetWishFaction(
  config: GameConfig,
  state: AccountState,
  faction: Faction | null,
  now: number,
): Outcome<{ state: AccountState }> {
  const well = config.gacha.wishingWell;
  const gacha = refillGacha(config.gacha.machines, state.gacha, dayKey(now));
  if (faction !== null) {
    if (!well.factions.includes(faction)) return { ok: false, error: 'invalid_input', message: `the Wishing Well has no ${faction} wish` };
    const ms = gacha.machines[well.machine] ?? emptyMachineState();
    if (!wellUnlocked(well, ms)) {
      return { ok: false, error: 'resource_locked', message: `draw ${well.unlockDraws} times in total to unlock the Wishing Well` };
    }
  }
  return { ok: true, value: { state: { ...state, gacha: { ...gacha, wishFaction: faction } } } };
}

/** Spend 1,000 VIP credits on a Supreme Gift: one Legendary or Supreme Pokémon (VIP 14+). */
export function applyOpenSupremeGift(
  config: GameConfig,
  state: AccountState,
  now: number,
  rng: Rng,
): Outcome<{ state: AccountState; draw: DrawResult }> {
  const gift = config.gacha.supremeGift;
  const vip = vipPerks(config, state).level;
  if (vip < gift.vipLevel) return { ok: false, error: 'resource_locked', message: `the Supreme Gift opens from VIP ${gift.vipLevel}` };
  if (!giftReady(gift, state.gacha.vipCredits, vip)) {
    return { ok: false, error: 'not_ready', message: `needs ${gift.credits} VIP credits` };
  }
  const speciesId = openGift(rng, gift);
  const meta = config.species.get(speciesId);
  if (!meta) return { ok: false, error: 'not_found', message: `unknown species "${speciesId}"` };
  const granted = grantDraws(state, [{ speciesId, star: firstStar(meta), tier: meta.tier, group: meta.tier === 'legendary' ? 'legendary' : 'supreme' }], now);
  const draw = granted.draws[0]!;
  const gacha: GachaState = {
    ...state.gacha,
    vipCredits: state.gacha.vipCredits - gift.credits,
    history: historyOf(state.gacha, 'supremeGift', granted.draws, now),
  };
  return { ok: true, value: { state: { ...granted.state, gacha }, draw } };
}

export interface GachaGroupRate {
  group: GachaGroup;
  probability: number;
}

export interface GachaMachineView {
  id: MachineId;
  ticket: string;
  gemPerDraw: number | null;
  gemPerTen: number | null;
  /** Draw sizes this machine sells (1, 10 and, Premium, the 20–50 ticket multi-draws). */
  counts: number[];
  freePerDay: number;
  freeRemaining: number;
  nextFreeAt: number;
  freeCooldownMinutes: number;
  boxCredits: number;
  boxCreditsNeeded: number;
  boxReady: boolean;
  boxProgress: number;
  boxRewards: Rewards;
  lifetimeDraws: number;
  vipCreditPerDraw: number;
  /** The rates sheet: every row's chance (Wishing Well applied), and the groups' totals. */
  groupRates: GachaGroupRate[];
  probabilities: RowProbability[];
}

export interface GachaView {
  day: string;
  machines: GachaMachineView[];
  wishingWell: {
    machine: MachineId;
    unlockDraws: number;
    draws: number;
    unlocked: boolean;
    factions: Faction[];
    boost: number;
    faction: Faction | null;
  };
  supremeGift: { credits: number; needed: number; vipLevel: number; playerVip: number; ready: boolean; species: string[] };
  history: GachaHistoryEntry[];
}

/** Display-ready summoning state: free draws, credits, the Wishing Well, the Supreme Gift, rates. */
export function gachaView(config: GameConfig, state: AccountState, now: number): GachaView {
  const gacha = refillGacha(config.gacha.machines, state.gacha, dayKey(now));
  const well = config.gacha.wishingWell;
  const gift = config.gacha.supremeGift;
  const machines = config.gacha.machines.map((def): GachaMachineView => {
    const ms = gacha.machines[def.id] ?? emptyMachineState();
    const table = probabilityTable(config.gacha.pools[def.id], activeWish(well, def, ms, gacha.wishFaction));
    return {
      id: def.id,
      ticket: def.ticket,
      gemPerDraw: def.gemPerDraw,
      gemPerTen: def.gemPerTen,
      counts: summonCounts(def),
      freePerDay: def.freePerDay,
      freeRemaining: ms.freeRemaining,
      nextFreeAt: ms.nextFreeAt,
      freeCooldownMinutes: def.freeCooldownMinutes,
      boxCredits: ms.boxCredits,
      boxCreditsNeeded: def.boxCreditsNeeded,
      boxReady: boxReady(ms, def),
      boxProgress: boxProgress(ms, def),
      boxRewards: def.boxRewards,
      lifetimeDraws: ms.lifetimeDraws,
      vipCreditPerDraw: def.vipCreditPerDraw,
      groupRates: groupTable(table),
      probabilities: table,
    };
  });
  const wellState = gacha.machines[well.machine] ?? emptyMachineState();
  const vip = vipPerks(config, state).level;
  return {
    day: gacha.day,
    machines,
    wishingWell: {
      machine: well.machine,
      unlockDraws: well.unlockDraws,
      draws: wellState.lifetimeDraws,
      unlocked: wellUnlocked(well, wellState),
      factions: [...well.factions],
      boost: well.boost,
      faction: gacha.wishFaction,
    },
    supremeGift: {
      credits: gacha.vipCredits,
      needed: gift.credits,
      vipLevel: gift.vipLevel,
      playerVip: vip,
      ready: giftReady(gift, gacha.vipCredits, vip),
      species: [...gift.species],
    },
    history: gacha.history,
  };
}
