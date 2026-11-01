import type { AccountState, CurrencyId, Faction, WildInstance } from '@wildbound/engine';
import type { GameConfig } from './config';
import { pay } from './equipment';
import { fail, ok, type Result } from './index';

/**
 * R6a: the source's plates (kb/plate.md; scripts/import-plates.mjs). One plate per Pokémon, named by its
 * card's type (18 types × 3 grades), one stat table for all; stages 0–18. Opens at player Lv 34 on a
 * Pokémon of 6★+; stage 6+ needs the Pokémon at Lv 47 and 12+ at Lv 60. Steps cost Plate Bottles, with
 * Plate Fragments on 5 → 6, 11 → 12 and 17 → 18: 630 Bottles + 2,625 Fragments to 18.
 * The plate skills at tiers 6 / 12 / 18 arrive in R6a part 2.
 */

export type PlateCurrency = 'plateBottle' | 'plateFragment';

export interface PlateCost {
  currency: PlateCurrency;
  amount: number;
}

export interface PlateView {
  name: string;
  faction: Faction;
  stage: number;
  maxStage: number;
  /** The stage whose lines are shown (current, or the next one). */
  shownStage: number;
  linesText: string[];
  /** True when the lines describe the next stage instead of the current one. */
  linesAreNext: boolean;
  cost: PlateCost | null;
  /** Why the next step can't be taken (player level, stars, Pokémon level), or null. */
  locked: string | null;
  skillSwapStage: number;
  skillSwapReady: boolean;
}

export function plateStage(state: AccountState, wildId: string): number {
  return Math.max(0, Math.floor(state.plates[wildId] ?? 0));
}

/** The plate a species carries at a star (its card's type). */
export function plateOf(config: GameConfig, speciesId: string, stars: number): { id: number; name: string } | null {
  const t = config.equipment.plates;
  const runs = t.species[speciesId] ?? [];
  let id: number | null = null;
  for (const [from, plate] of runs) if (stars >= from) id = plate;
  if (id === null && runs[0]) id = runs[0][1];
  return id === null ? null : (t.plates.find((p) => p.id === id) ?? null);
}

/** Cost of the next stage (null at the top). */
export function plateCost(stage: number, config: GameConfig): PlateCost | null {
  const step = config.equipment.plates.steps[stage];
  return step ? { currency: step.currency, amount: step.amount } : null;
}

function plateLock(config: GameConfig, state: AccountState, wild: WildInstance, stage: number): string | null {
  const t = config.equipment.plates;
  if (state.profile.level < t.unlock.playerLevel) return `Plates open at player Lv ${t.unlock.playerLevel}`;
  if (wild.stars < t.unlock.stars) return `this Pokémon's plate opens at ${t.unlock.stars}★`;
  const need = t.steps[stage]?.level ?? 0;
  if (wild.level < need) return `the next stage needs the Pokémon at Lv ${need}`;
  return null;
}

function stageLines(config: GameConfig, stage: number): string[] {
  const row = config.equipment.plates.stages[stage];
  if (!row) return [];
  const out = [`HP +${row.hp.toLocaleString()}`, `P.ATK +${row.pAtk.toLocaleString()}`, `S.ATK +${row.sAtk.toLocaleString()}`];
  if (row.hpPct) out.push(`Total HP +${Math.round(row.hpPct * 100)}%`);
  return out;
}

export function buildPlateView(config: GameConfig, state: AccountState, wild: WildInstance): PlateView {
  const meta = config.species.get(wild.speciesId);
  const faction: Faction = meta?.faction ?? 'fire';
  const plate = plateOf(config, wild.speciesId, wild.stars);
  const stage = plateStage(state, wild.id);
  const maxStage = config.equipment.plates.steps.length;
  const atMax = stage >= maxStage;
  const shownStage = atMax ? maxStage : stage + 1;
  const swap = config.equipment.plates.skillSwapStage;
  return {
    name: plate?.name ?? 'Plate',
    faction,
    stage,
    maxStage,
    shownStage,
    linesText: stageLines(config, shownStage),
    linesAreNext: !atMax,
    cost: atMax ? null : plateCost(stage, config),
    locked: atMax ? null : plateLock(config, state, wild, stage),
    skillSwapStage: swap,
    skillSwapReady: stage >= swap,
  };
}

export function upgradePlateAction(config: GameConfig, state: AccountState, wildId: string): Result<AccountState> {
  const wild = state.roster.find((w) => w.id === wildId);
  if (!wild) return fail('not_found', `no Wild ${wildId}`);
  if (!plateOf(config, wild.speciesId, wild.stars)) return fail('not_found', `no plate for ${wild.speciesId}`);
  const stage = plateStage(state, wild.id);
  const cost = plateCost(stage, config);
  if (!cost) return fail('at_level_cap', 'max plate stage');
  const lock = plateLock(config, state, wild, stage);
  if (lock) return fail('resource_locked', lock);
  const paid = pay(state, { [cost.currency]: cost.amount } as Partial<Record<CurrencyId, number>>);
  if (!paid) return fail('insufficient_items', `not enough ${cost.currency === 'plateBottle' ? 'Plate Bottles' : 'Plate Fragments'}`);
  return ok({ ...paid, plates: { ...state.plates, [wild.id]: stage + 1 } });
}
