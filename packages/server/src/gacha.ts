import {
  boxProgress,
  boxReady,
  dayKey,
  drawBatch,
  emptyMachineState,
  GACHA_HISTORY_LIMIT,
  orderPool,
  pityProgress,
  probabilityTable,
  resolveSummonCost,
  wishUnlocked,
  type AccountState,
  type CurrencyId,
  type DrawResult,
  type GachaHistoryEntry,
  type GachaMachineDef,
  type GachaMachineState,
  type GachaPoolEntry,
  type GachaState,
  type MachineId,
  type Rewards,
  type Rng,
  type SpeciesProbability,
  type SummonCost,
  type Tier,
  type WildInstance,
} from '@wildbound/engine';
import { applyGrant } from './economy';
import type { GameConfig } from './config';
import type { Outcome } from './outcome';

/**
 * Server-side summoning glue (M6, PROMPT §7.5). The engine owns every rule; these
 * functions read the injected config's machines/species so the LocalServer methods
 * stay thin. Pure: they take state, an epoch and an `Rng` and return new state.
 */

/** The summon pool: every species tagged with its tier, cheapest first. */
export function poolFromSpecies(config: GameConfig): GachaPoolEntry[] {
  return orderPool([...config.species.values()].map((s) => ({ speciesId: s.id, tier: s.tier })));
}

export function machineById(config: GameConfig, machine: MachineId): GachaMachineDef | undefined {
  return config.gacha.machines.find((m) => m.id === machine);
}

/** Reset every machine's daily free draws when the UTC day rolls over. */
export function refillGacha(machines: readonly GachaMachineDef[], gacha: GachaState, day: string): GachaState {
  if (gacha.day === day) return gacha;
  const next = { ...gacha.machines };
  for (const def of machines) {
    const current = next[def.id] ?? emptyMachineState();
    next[def.id] = { ...current, freeRemaining: def.freePerDay, nextFreeAt: 0 };
  }
  return { ...gacha, day, machines: next };
}

export interface SummonValue {
  state: AccountState;
  draws: DrawResult[];
  cost: SummonCost;
}

/**
 * Resolve the price, spend it, roll `count` draws, grant one fresh instance each
 * and update the machine's credits, free draws and history.
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
  if (count !== 1 && count !== 10) {
    return { ok: false, error: 'invalid_input', message: 'a summon is 1 or 10 draws' };
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

  const pool = poolFromSpecies(config);
  const wish = machine.wish && wishUnlocked(ms, machine) ? gacha.wishedSpeciesId : null;
  const rolled = drawBatch(rng, pool, machine, wish, { box: ms.boxCredits, pity: ms.pityCredits }, count);

  // One fresh WildInstance per draw; the first sighting of a species is "new".
  const known = new Set(state.roster.map((w) => w.speciesId));
  let seq = state.nextInstanceSeq;
  const roster = [...state.roster];
  const draws: DrawResult[] = rolled.results.map((r) => {
    const isNew = !known.has(r.speciesId);
    known.add(r.speciesId);
    const instance: WildInstance = {
      id: `w${seq++}`,
      speciesId: r.speciesId,
      level: 1,
      stars: 1,
      evolutionStage: 0,
      locked: false,
      acquiredAt: now,
    };
    roster.push(instance);
    return { ...r, isNew };
  });

  const history: GachaHistoryEntry[] = [
    ...gacha.history,
    ...draws.map((d) => ({ machine: machineId, speciesId: d.speciesId, tier: d.tier, isNew: d.isNew, at: now })),
  ].slice(-GACHA_HISTORY_LIMIT);

  const machineState: GachaMachineState = {
    ...ms,
    freeRemaining: Math.max(0, ms.freeRemaining - cost.free),
    nextFreeAt: cost.free > 0 ? now + machine.freeCooldownMinutes * 60_000 : ms.nextFreeAt,
    boxCredits: rolled.credits.box,
    pityCredits: rolled.credits.pity,
    lifetimeDraws: ms.lifetimeDraws + count,
  };

  return {
    ok: true,
    value: {
      state: {
        ...state,
        roster,
        nextInstanceSeq: seq,
        currencies,
        gacha: { ...gacha, machines: { ...gacha.machines, [machineId]: machineState }, history },
      },
      draws,
      cost,
    },
  };
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

/** Set or clear the Premium machine's featured target. */
export function applySetWish(
  config: GameConfig,
  state: AccountState,
  speciesId: string | null,
  now: number,
): Outcome<{ state: AccountState }> {
  if (speciesId !== null && !config.species.has(speciesId)) {
    return { ok: false, error: 'not_found', message: `unknown species "${speciesId}"` };
  }
  const gacha = refillGacha(config.gacha.machines, state.gacha, dayKey(now));
  return { ok: true, value: { state: { ...state, gacha: { ...gacha, wishedSpeciesId: speciesId } } } };
}

export interface GachaTierRate {
  tier: Tier;
  weight: number;
  probability: number;
}

export interface GachaMachineView {
  id: MachineId;
  ticket: string;
  gemPerDraw: number | null;
  gemPerTen: number | null;
  freePerDay: number;
  freeRemaining: number;
  nextFreeAt: number;
  freeCooldownMinutes: number;
  boxCredits: number;
  boxCreditsNeeded: number;
  boxReady: boolean;
  boxProgress: number;
  boxRewards: Rewards;
  pityThreshold: number;
  pityProgress: number;
  lifetimeDraws: number;
  wish: boolean;
  wishUnlocked: boolean;
  wishBoost: number;
  tenDrawGuarantee: Tier;
  tierRates: GachaTierRate[];
  probabilities: SpeciesProbability[];
}

export interface GachaView {
  day: string;
  wishedSpeciesId: string | null;
  machines: GachaMachineView[];
  history: GachaHistoryEntry[];
}

/** Display-ready summoning state: credits, pity, rates and history. */
export function gachaView(config: GameConfig, state: AccountState, now: number): GachaView {
  const gacha = refillGacha(config.gacha.machines, state.gacha, dayKey(now));
  const pool = poolFromSpecies(config);
  const machines = config.gacha.machines.map((def): GachaMachineView => {
    const ms = gacha.machines[def.id] ?? emptyMachineState();
    const wish = def.wish && wishUnlocked(ms, def) ? gacha.wishedSpeciesId : null;
    const total = def.rates.reduce((sum, r) => sum + Math.max(0, r.weight), 0);
    return {
      id: def.id,
      ticket: def.ticket,
      gemPerDraw: def.gemPerDraw,
      gemPerTen: def.gemPerTen,
      freePerDay: def.freePerDay,
      freeRemaining: ms.freeRemaining,
      nextFreeAt: ms.nextFreeAt,
      freeCooldownMinutes: def.freeCooldownMinutes,
      boxCredits: ms.boxCredits,
      boxCreditsNeeded: def.boxCreditsNeeded,
      boxReady: boxReady(ms, def),
      boxProgress: boxProgress(ms, def),
      boxRewards: def.boxRewards,
      pityThreshold: def.pityThreshold,
      pityProgress: pityProgress(ms, def),
      lifetimeDraws: ms.lifetimeDraws,
      wish: def.wish,
      wishUnlocked: wishUnlocked(ms, def),
      wishBoost: def.wishBoost,
      tenDrawGuarantee: def.tenDrawGuarantee,
      tierRates: def.rates.map((r) => ({
        tier: r.tier,
        weight: r.weight,
        probability: total > 0 ? Math.max(0, r.weight) / total : 0,
      })),
      probabilities: probabilityTable(def, pool, wish),
    };
  });
  return { day: gacha.day, wishedSpeciesId: gacha.wishedSpeciesId, machines, history: gacha.history };
}
