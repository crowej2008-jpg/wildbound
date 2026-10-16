import {
  canUpgradeCrystal,
  crystalUpgradeCost,
  maybeUnlockCrystal,
  type AccountState,
} from '@wildbound/engine';
import { fail, ok, type Result } from '../index';
import type { GameConfig } from '../config';
import { crystalTuning, crystalWilds } from './shared';

/** Link Crystal (M8, PROMPT §7.1): spend candy/gold/stones to raise the cap. */

export function upgradeLinkCrystal(
  config: GameConfig,
  state: AccountState,
): Result<{ state: AccountState; level: number }> {
  const tuning = crystalTuning(config);
  const wilds = crystalWilds(config, state);
  const unlocked = maybeUnlockCrystal(state.pve.linkCrystal, wilds, tuning);
  if (!canUpgradeCrystal(unlocked, wilds, tuning)) return fail('at_level_cap', 'the crystal is at its cap');
  const cost = crystalUpgradeCost(unlocked.level, tuning);
  if (
    state.currencies.candy < cost.candy ||
    state.currencies.gold < cost.gold ||
    state.currencies.stone < cost.stones
  ) {
    return fail('insufficient_items', 'not enough candy, gold or stones');
  }
  const next: AccountState = {
    ...state,
    currencies: {
      ...state.currencies,
      candy: state.currencies.candy - cost.candy,
      gold: state.currencies.gold - cost.gold,
      stone: state.currencies.stone - cost.stones,
    },
    pve: { ...state.pve, linkCrystal: { unlocked: true, level: unlocked.level + 1 } },
  };
  return ok({ state: next, level: unlocked.level + 1 });
}
