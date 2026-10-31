import type { AccountState, CurrencyId, Faction } from '@wildbound/engine';
import type { GameConfig } from './config';
import { pay } from './equipment';
import { statLineText } from './gear-text';
import { fail, ok, type Result } from './index';

/**
 * M11.7 element-keyed plates. One plate per Wild, stages 0–20. Stages 0–5 and
 * 7–20 pay Plate Bottles; the 5 → 6 step pays Plate Fragments. See
 * docs/design/collection.md.
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
  skillSwapStage: number;
  skillSwapReady: boolean;
}

export function plateStage(state: AccountState, wildId: string): number {
  return Math.max(0, Math.floor(state.plates[wildId] ?? 0));
}

/** Cost of the next stage; the 5 → 6 step switches to Fragments. */
export function plateCost(stage: number, collection: GameConfig['collection']): PlateCost {
  const { fragmentCost, bottleBase, bottlePerStage } = collection.plates;
  if (stage === 5) return { currency: 'plateFragment', amount: fragmentCost };
  return { currency: 'plateBottle', amount: bottleBase + Math.max(0, stage) * bottlePerStage };
}

export function buildPlateView(config: GameConfig, state: AccountState, wild: { id: string; speciesId: string }): PlateView {
  const meta = config.species.get(wild.speciesId);
  const faction: Faction = meta?.faction ?? 'fire';
  const def = config.equipment.plates.find((p) => p.faction === faction);
  const stage = plateStage(state, wild.id);
  const maxStage = config.collection.plates.maxStage;
  const atMax = stage >= maxStage;
  const shownStage = atMax ? maxStage : stage + 1;
  return {
    name: def?.name ?? `${faction} Plate`,
    faction,
    stage,
    maxStage,
    shownStage,
    linesText: (def?.lines ?? []).map((line) => statLineText(line, shownStage)),
    linesAreNext: !atMax,
    cost: atMax ? null : plateCost(stage, config.collection),
    skillSwapStage: config.collection.plates.skillSwapStage,
    skillSwapReady: stage >= config.collection.plates.skillSwapStage,
  };
}

export function upgradePlateAction(
  config: GameConfig,
  state: AccountState,
  wildId: string,
): Result<AccountState> {
  const wild = state.roster.find((w) => w.id === wildId);
  if (!wild) return fail('not_found', `no Wild ${wildId}`);
  const meta = config.species.get(wild.speciesId);
  if (!meta) return fail('not_found', `unknown species ${wild.speciesId}`);
  if (!config.equipment.plates.some((p) => p.faction === meta.faction)) {
    return fail('not_found', `no plate for faction ${meta.faction}`);
  }
  const stage = plateStage(state, wild.id);
  if (stage >= config.collection.plates.maxStage) return fail('at_level_cap', 'max plate stage');
  const cost = plateCost(stage, config.collection);
  const paid = pay(state, { [cost.currency]: cost.amount } as Partial<Record<CurrencyId, number>>);
  if (!paid) return fail('insufficient_items', `not enough ${cost.currency === 'plateBottle' ? 'Plate Bottles' : 'Plate Fragments'}`);
  return ok({ ...paid, plates: { ...state.plates, [wild.id]: stage + 1 } });
}
