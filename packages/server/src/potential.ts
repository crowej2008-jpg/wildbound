import {
  POTENTIAL_TIERS,
  canUnlockTier,
  emptyPotential,
  levelShards,
  planFodder,
  tierFodder,
  unlockShards,
  unlockStar,
  type AccountState,
  type FodderReq,
  type PotentialState,
  type WildInstance,
} from '@wildbound/engine';
import type { GameConfig } from './config';
import { consumeFodder, pay } from './equipment';
import { squadWildIds } from './growth';
import { fail, ok, type Result } from './index';

/**
 * R4 Potential (kb/potential.md, copied by scripts/import-potential.mjs). Per Pokémon, nine tiers;
 * tier N unlocks at 6 + N stars — pick one of its three options, pay its fodder and Potential Shards;
 * Level Up then takes the option to Lv 6 with shards only. Tiers may be unlocked in any order. A
 * reset (16 Diamonds) returns everything paid: shards, Potential Cores and the fodder Pokémon (as
 * fresh Lv 1 copies at the star they were taken at).
 */

export interface PotentialOptionView {
  id: number;
  name: string;
  /** The effect text with the value at the shown level filled in. */
  text: string;
  value: number;
  /** The value one level up, or null at Lv 6 / when not picked. */
  nextValue: number | null;
  points: boolean;
}

export interface PotentialFodderView {
  req: FodderReq;
  have: number;
}

export interface PotentialTierView {
  tier: number;
  unlockStar: number;
  /** The Pokémon has the stars for this tier. */
  open: boolean;
  pick: { option: number; lv: number } | null;
  options: PotentialOptionView[];
  unlockShards: number;
  /** Shards for the next level, or null when locked or maxed. */
  levelShards: number | null;
  fodder: PotentialFodderView[];
  /** Potential Cores needed to cover the fodder still missing (0 when none can stand in). */
  coresNeeded: number;
  /** Whether Unlock would succeed now with the selected-by-default fodder (stars, fodder, shards). */
  canUnlock: boolean;
}

export interface PotentialView {
  wildId: string;
  hasTree: boolean;
  stars: number;
  /** The panel opens with tier 1's star. */
  panelOpen: boolean;
  shards: number;
  cores: number;
  gems: number;
  resetGems: number;
  refund: PotentialState['spent'];
  tiers: PotentialTierView[];
}

function potentialOf(state: AccountState, wildId: string): PotentialState {
  return state.potential[wildId] ?? emptyPotential();
}

function withPotential(state: AccountState, wildId: string, next: PotentialState): AccountState {
  return { ...state, potential: { ...state.potential, [wildId]: next } };
}

/** Wilds whose Potential is developed are never taken as fodder (their tiers would be lost). */
function protectedIds(state: AccountState): Set<string> {
  const ids = squadWildIds(state);
  for (const [id, p] of Object.entries(state.potential)) if (p.picks.some((x) => x !== null)) ids.add(id);
  return ids;
}

interface TierPlan {
  consume: string[];
  missing: FodderReq[];
  coresNeeded: number;
  coresCover: boolean;
  fodder: PotentialFodderView[];
}

function planTier(config: GameConfig, state: AccountState, wild: WildInstance, tier: number): TierPlan {
  const species = config.potential.species[wild.speciesId];
  const reqs = species ? tierFodder(species, tier) : [];
  const candidates = state.roster.flatMap((instance) => {
    const meta = config.species.get(instance.speciesId);
    return meta ? [{ instance, faction: meta.faction }] : [];
  });
  const plan = planFodder(wild, { fodder: reqs } as Parameters<typeof planFodder>[1], candidates, protectedIds(state));
  const fodder = reqs.map((req) => {
    const short = plan.missing.find((m) => m.own === req.own && m.star === req.star && m.faction === req.faction);
    return { req, have: req.count - (short?.count ?? 0) };
  });
  const coresNeeded = plan.missing.reduce((n, m) => n + m.count, 0);
  // A Core stands in for a fodder Pokémon on the 21 listed species, tiers 5–9 (kb: own copies for
  // 15 Mythics, the Light / Dark five-stars for the six Origins).
  const coresCover = coresNeeded === 0 || (species?.core === true && tier >= 4);
  return { consume: plan.consume, missing: plan.missing, coresNeeded: coresCover ? coresNeeded : 0, coresCover, fodder };
}

function optionValue(values: number[], lv: number): number {
  return values[Math.max(1, Math.min(lv, values.length)) - 1] ?? 0;
}

function formatValue(v: number, points: boolean): string {
  if (points) return String(v);
  const pct = Math.round(v * 10000) / 100;
  return String(pct);
}

export function potentialView(config: GameConfig, state: AccountState, wildId: string): PotentialView | null {
  const wild = state.roster.find((w) => w.id === wildId);
  if (!wild) return null;
  const table = config.potential;
  const species = table.species[wild.speciesId];
  const current = potentialOf(state, wildId);
  const byId = new Map(table.options.map((o) => [o.id, o]));
  const shards = state.currencies.potentialShard ?? 0;
  const cores = state.currencies.potentialCore ?? 0;
  const tiers: PotentialTierView[] = species
    ? species.tiers.map((ids, tier) => {
        const pick = current.picks[tier] ?? null;
        const plan = pick ? null : planTier(config, state, wild, tier);
        const options = ids.map((id, slot) => {
          const o = byId.get(id)!;
          const points = o.effect.kind === 'alive' && o.effect.field === 'spd';
          const lv = pick && pick.option === slot ? pick.lv : 1;
          const value = optionValue(o.values, lv);
          const nextValue = pick && pick.option === slot && lv < table.maxLevel ? optionValue(o.values, lv + 1) : null;
          return { id, name: o.name, text: o.text.replace('{v}', formatValue(value, points)), value, nextValue, points };
        });
        const open = canUnlockTier(table, wild.stars, tier);
        const fodderOk = plan ? plan.missing.length === 0 || (plan.coresCover && cores >= plan.coresNeeded) : false;
        return {
          tier,
          unlockStar: unlockStar(table, tier),
          open,
          pick,
          options,
          unlockShards: unlockShards(table, tier),
          levelShards: pick && pick.lv < table.maxLevel ? levelShards(table, tier, pick.lv) : null,
          fodder: plan?.fodder ?? [],
          coresNeeded: plan?.coresNeeded ?? 0,
          canUnlock: !pick && open && fodderOk && shards >= unlockShards(table, tier),
        };
      })
    : [];
  return {
    wildId,
    hasTree: species !== undefined,
    stars: wild.stars,
    panelOpen: species !== undefined && wild.stars >= unlockStar(table, 0),
    shards,
    cores,
    gems: state.currencies.gems ?? 0,
    resetGems: table.resetGems,
    refund: current.spent,
    tiers,
  };
}

export function unlockPotentialAction(
  config: GameConfig,
  state: AccountState,
  wildId: string,
  tier: number,
  option: number,
): Result<AccountState> {
  const wild = state.roster.find((w) => w.id === wildId);
  if (!wild) return fail('not_found', `no Wild ${wildId}`);
  const table = config.potential;
  const species = table.species[wild.speciesId];
  if (!species) return fail('resource_locked', 'this Pokémon has no Potential');
  if (!Number.isInteger(tier) || tier < 0 || tier >= POTENTIAL_TIERS) return fail('invalid_input', `no tier ${tier + 1}`);
  if (!Number.isInteger(option) || option < 0 || option > 2) return fail('invalid_input', `no option ${option + 1}`);
  if (!canUnlockTier(table, wild.stars, tier)) return fail('resource_locked', `tier ${tier + 1} needs ${unlockStar(table, tier)}★`);
  const current = potentialOf(state, wildId);
  if (current.picks[tier]) return fail('invalid_input', `tier ${tier + 1} is already unlocked`);

  const plan = planTier(config, state, wild, tier);
  if (plan.missing.length > 0 && !plan.coresCover) return fail('insufficient_items', `tier ${tier + 1} needs more fodder Pokémon`);
  const cost = unlockShards(table, tier);
  const paid = pay(state, { potentialShard: cost, ...(plan.coresNeeded > 0 ? { potentialCore: plan.coresNeeded } : {}) });
  if (!paid) return fail('insufficient_items', plan.coresNeeded > 0 ? 'not enough Potential Shards or Cores' : 'not enough Potential Shards');

  const taken = plan.consume.map((id) => state.roster.find((w) => w.id === id)!).map((w) => ({ speciesId: w.speciesId, stars: w.stars }));
  const next = consumeFodder(paid, plan.consume);
  const picks = [...current.picks];
  picks[tier] = { option, lv: 1 };
  return ok(
    withPotential(next, wildId, {
      picks,
      spent: {
        shards: current.spent.shards + cost,
        cores: current.spent.cores + plan.coresNeeded,
        fodder: [...current.spent.fodder, ...taken],
      },
    }),
  );
}

export function levelPotentialAction(config: GameConfig, state: AccountState, wildId: string, tier: number): Result<AccountState> {
  const wild = state.roster.find((w) => w.id === wildId);
  if (!wild) return fail('not_found', `no Wild ${wildId}`);
  const current = potentialOf(state, wildId);
  const pick = current.picks[tier];
  if (!pick) return fail('resource_locked', `tier ${tier + 1} is still locked`);
  const cost = levelShards(config.potential, tier, pick.lv);
  if (!Number.isFinite(cost)) return fail('invalid_input', 'this option is maxed out');
  const paid = pay(state, { potentialShard: cost });
  if (!paid) return fail('insufficient_items', 'not enough Potential Shards');
  const picks = [...current.picks];
  picks[tier] = { ...pick, lv: pick.lv + 1 };
  return ok(withPotential(paid, wildId, { picks, spent: { ...current.spent, shards: current.spent.shards + cost } }));
}

export function resetPotentialAction(config: GameConfig, state: AccountState, wildId: string, now: number): Result<AccountState> {
  const wild = state.roster.find((w) => w.id === wildId);
  if (!wild) return fail('not_found', `no Wild ${wildId}`);
  const current = potentialOf(state, wildId);
  if (!current.picks.some((p) => p !== null)) return fail('invalid_input', 'no Potential to reset');
  const paid = pay(state, { gems: config.potential.resetGems });
  if (!paid) return fail('insufficient_items', 'not enough Diamonds');
  let seq = paid.nextInstanceSeq;
  const returned: WildInstance[] = current.spent.fodder.map((f) => ({
    id: `w${seq++}`,
    speciesId: f.speciesId,
    level: 1,
    stars: f.stars,
    locked: false,
    acquiredAt: now,
  }));
  const potential = { ...paid.potential };
  delete potential[wildId];
  return ok({
    ...paid,
    roster: [...paid.roster, ...returned],
    nextInstanceSeq: seq,
    potential,
    currencies: {
      ...paid.currencies,
      potentialShard: (paid.currencies.potentialShard ?? 0) + current.spent.shards,
      potentialCore: (paid.currencies.potentialCore ?? 0) + current.spent.cores,
    },
  });
}
