import type { AccountState, ResonanceFold } from '@wildbound/engine';
import type { GameConfig } from './config';
import { pay } from './equipment';
import { statLineText } from './gear-text';
import { fail, ok, type Result } from './index';

/**
 * M11.9 resonance. Six account-wide slots; two open, the rest bought with
 * Resonation Shards. A slotted Wild gains a tunable share of the Link Crystal
 * level as flat stats. See docs/design/collection.md.
 */

export interface ResonanceSlotView {
  slot: number;
  unlocked: boolean;
  wildId: string | null;
  wildName: string | null;
  speciesId: string | null;
  bonusText: string[];
}

export interface ResonanceView {
  slots: number;
  openSlots: number;
  unlocked: number;
  crystalLevel: number;
  crystalUnlocked: boolean;
  balance: number;
  nextUnlockCost: number | null;
  entries: ResonanceSlotView[];
}

export function resonanceUnlockCost(
  unlocked: number,
  collection: GameConfig['collection'],
): number {
  const { openSlots, unlockBase, unlockPerSlot } = collection.resonance;
  return unlockBase + Math.max(0, unlocked - openSlots) * unlockPerSlot;
}

/** The fold context for a slotted Wild; undefined for unslotted ones. */
export function resonanceFoldFor(
  config: GameConfig,
  state: AccountState,
  wildId: string,
): ResonanceFold | undefined {
  if (!state.resonance.slots.includes(wildId)) return undefined;
  return {
    level: state.pve.linkCrystal.level,
    perLevel: config.collection.resonance.perLevel,
  };
}

export function buildResonanceView(config: GameConfig, state: AccountState): ResonanceView {
  const tuning = config.collection.resonance;
  const level = state.pve.linkCrystal.level;
  const entries: ResonanceSlotView[] = state.resonance.slots.map((wildId, slot) => {
    const wild = wildId ? state.roster.find((w) => w.id === wildId) : undefined;
    const species = wild ? config.species.get(wild.speciesId) : undefined;
    const bonusText =
      wild && level > 0
        ? (Object.entries(tuning.perLevel) as [keyof typeof tuning.perLevel, number][]).map(
            ([field, perLevel]) =>
              statLineText({ kind: 'core', field, base: perLevel * level, perLevel: 0 }, 1),
          )
        : [];
    return {
      slot,
      unlocked: slot < state.resonance.unlocked,
      wildId: wild?.id ?? null,
      wildName: wild ? (species?.name ?? wild.speciesId) : null,
      speciesId: wild?.speciesId ?? null,
      bonusText,
    };
  });
  return {
    slots: tuning.slots,
    openSlots: tuning.openSlots,
    unlocked: state.resonance.unlocked,
    crystalLevel: level,
    crystalUnlocked: state.pve.linkCrystal.unlocked,
    balance: state.currencies.resonationShard ?? 0,
    nextUnlockCost:
      state.resonance.unlocked < tuning.slots
        ? resonanceUnlockCost(state.resonance.unlocked, config.collection)
        : null,
    entries,
  };
}

export function unlockResonanceSlotAction(
  config: GameConfig,
  state: AccountState,
): Result<AccountState> {
  const tuning = config.collection.resonance;
  if (state.resonance.unlocked >= tuning.slots) return fail('at_level_cap', 'all slots are open');
  const paid = pay(state, {
    resonationShard: resonanceUnlockCost(state.resonance.unlocked, config.collection),
  });
  if (!paid) return fail('insufficient_items', 'not enough Resonation Shards');
  return ok({
    ...paid,
    resonance: { ...state.resonance, unlocked: state.resonance.unlocked + 1 },
  });
}

export function setResonanceSlotAction(
  config: GameConfig,
  state: AccountState,
  slot: number,
  wildId: string | null,
): Result<AccountState> {
  const tuning = config.collection.resonance;
  if (!Number.isInteger(slot) || slot < 0 || slot >= tuning.slots) {
    return fail('not_found', `no resonance slot ${slot}`);
  }
  if (slot >= state.resonance.unlocked) return fail('resource_locked', 'slot is not open');
  if (wildId !== null && !state.roster.some((w) => w.id === wildId)) {
    return fail('not_found', `no Wild ${wildId}`);
  }
  const slots = state.resonance.slots.map((id) => (id === wildId ? null : id));
  slots[slot] = wildId;
  return ok({ ...state, resonance: { ...state.resonance, slots } });
}
