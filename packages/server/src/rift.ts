import {
  buyMerchant,
  claimRiftChest,
  exploreAccess,
  isBossFloor,
  riftChallengeBlock,
  riftDifficulty,
  rollRift,
  settleRift,
  type AccountState,
  type RiftError,
  type RiftExtras,
  type RiftRules,
  type Rewards,
} from '@wildbound/engine';
import { modeBattle, type BattleView } from './battle';
import type { GameConfig } from './config';
import { applyGrant } from './economy';
import { fail, ok, type Result } from './index';
import { enemiesFor } from './pve/shared';
import { resonanceLevel } from './resonance';
import { grantRelic } from './equipment';
import { grantOrb } from './orbs';

/**
 * Rift Arena — Rift Barriers (M13.4). The engine owns the season, lives and floors; this module binds them to
 * the gate, battles and account rewards. Server-wide parts (the Advanced ranking, the Easy weakness) wait for
 * the backend (wiki/decisions/rift-server-parts-later.md). See docs/design/rift-arena.md.
 */

export function riftRules(config: GameConfig): RiftRules {
  return config.rift as unknown as RiftRules;
}

export function riftGate(config: GameConfig, state: AccountState, now: number): boolean {
  const mode = config.explore.modes.find((m) => m.id === 'rift-arena');
  if (!mode) return false;
  return exploreAccess(mode.gates, {
    campaign: state.campaign,
    level: state.profile.level,
    serverDay: Math.floor((now - state.serverEpoch) / 86_400_000) + 1,
  }).unlocked;
}

/**
 * Roll the Rift forward. A new season resets progress, locks a difficulty from the current resonance and turns
 * the last season's leftover Time Coins into Gold (source: coins come back as Gold by mail at a ratio); Time
 * Credits are taken back. A new day refills the lives.
 */
export function prepareRift(config: GameConfig, state: AccountState, now: number): { state: AccountState; changed: boolean; goldFromCoins: number } {
  const rules = riftRules(config);
  const rolled = rollRift(rules, state.rift, now, resonanceLevel(config, state));
  if (rolled.state === state.rift) return { state, changed: false, goldFromCoins: 0 };
  let currencies = state.currencies;
  let goldFromCoins = 0;
  if (rolled.newSeason) {
    goldFromCoins = Math.floor((currencies.timeCoin ?? 0) * rules.coinToGold);
    currencies = { ...currencies, gold: currencies.gold + goldFromCoins, timeCoin: 0, timeCredit: 0 };
  }
  return { state: { ...state, currencies, rift: rolled.state }, changed: true, goldFromCoins };
}

/** Grant milestone / Merchant extras: random-kind orbs and random Mythic held items (lines roll now). */
export function grantRiftExtras(config: GameConfig, state: AccountState, extras: RiftExtras): AccountState {
  let next = state;
  if (extras.orbs) {
    const kinds = config.equipment.orbs.kinds;
    for (let i = 0; i < extras.orbs.count; i += 1) {
      const kind = kinds[Math.floor(config.rng() * kinds.length)]!.id;
      const granted = grantOrb(config, next, kind, extras.orbs.colour, config.rng, extras.orbs.level);
      if (granted.ok) next = granted.value;
    }
  }
  const mythics = config.equipment.relics.filter((d) => d.tier === 'mythic');
  for (let i = 0; i < (extras.mythicHeld ?? 0) && mythics.length > 0; i += 1) {
    const def = mythics[Math.floor(config.rng() * mythics.length)]!;
    const granted = grantRelic(config, next, def.id, config.rng);
    if (granted.ok) next = granted.value;
  }
  return next;
}

const ERROR_TEXT: Record<RiftError, string> = {
  season_closed: 'the Rift season is closed (Tuesday 07:00 to Sunday 22:00 UTC)',
  floor_locked: 'every floor is cleared this season',
  no_lives: 'no lives left today',
  chest_locked: 'not enough challenges for that chest yet',
  chest_claimed: 'that chest was already claimed',
  offer_missing: 'that Merchant row does not exist',
  offer_locked: 'clear more floors this season to open that row',
  offer_sold_out: 'sold out for this season',
};

export interface RiftChallengeResult {
  state: AccountState;
  battle: BattleView;
  win: boolean;
  floor: number;
  rewards: Rewards;
  /** Milestone orbs / Mythic held items granted with this win. */
  extras: RiftExtras;
}

/** Challenge the next floor. Fielded Pokémon fight at the difficulty's synced level (at most). */
export function challengeRift(config: GameConfig, state: AccountState, now: number, seed?: number): Result<RiftChallengeResult> {
  if (!riftGate(config, state, now)) return fail('resource_locked', 'Rift Arena opens after story 10-10 and trainer level 10');
  const rules = riftRules(config);
  const prepared = prepareRift(config, state, now).state;
  const block = riftChallengeBlock(rules, prepared.rift, now);
  if (block) return fail(block === 'no_lives' ? 'daily_limit' : 'not_ready', ERROR_TEXT[block]);
  const floor = prepared.rift.highest + 1;
  const difficulty = riftDifficulty(rules, prepared.rift);
  const boss = isBossFloor(rules, floor) ? rules.bossMult : 1;
  const enemies = enemiesFor(config, rules.enemy, floor - 1).map((e) => ({
    ...e,
    level: Math.min(e.level, difficulty.syncLevel),
    mult: { hp: boss, atk: boss, def: boss },
  }));
  const battle = modeBattle(config, prepared, {
    squadMode: 'rift',
    label: 'rift',
    enemies,
    battleId: `m13:rift:${prepared.rift.season}:${floor}`,
    levelCap: difficulty.syncLevel,
    seed,
  });
  if (!battle) return fail('not_found', 'no Wilds available for the Rift');
  const win = battle.winner === 'attackers';
  const settled = settleRift(rules, prepared.rift, win);
  const paid = applyGrant(config, { ...prepared, rift: settled.state }, settled.rewards);
  const next = grantRiftExtras(config, paid, settled.extras);
  return ok({ state: next, battle, win, floor: settled.floor, rewards: settled.rewards, extras: settled.extras });
}

export function claimRiftChestAction(config: GameConfig, state: AccountState, now: number, challenges: number): Result<{ state: AccountState; reward: Rewards }> {
  if (!riftGate(config, state, now)) return fail('resource_locked', 'Rift Arena is not open yet');
  const prepared = prepareRift(config, state, now).state;
  const claimed = claimRiftChest(riftRules(config), prepared.rift, challenges);
  if (!claimed.ok) return fail('not_ready', ERROR_TEXT[claimed.error]);
  return ok({ state: applyGrant(config, { ...prepared, rift: claimed.state }, claimed.rewards), reward: claimed.rewards });
}

/** Buy one Mystic Merchant row: Time Coins (or Diamonds for the source's orb boxes), limited per season. */
export function buyRiftMerchant(config: GameConfig, state: AccountState, now: number, id: string): Result<{ state: AccountState; granted: Rewards }> {
  if (!riftGate(config, state, now)) return fail('resource_locked', 'Rift Arena is not open yet');
  const prepared = prepareRift(config, state, now).state;
  const bought = buyMerchant(riftRules(config), prepared.rift, id);
  if (!bought.ok) return fail(bought.error === 'offer_missing' ? 'not_found' : 'not_ready', ERROR_TEXT[bought.error]);
  const { offer } = bought;
  const have = prepared.currencies[offer.price.currency] ?? 0;
  if (have < offer.price.amount) {
    return fail('insufficient_items', `not enough ${offer.price.currency === 'gems' ? 'Diamonds' : 'Time Coins'}`);
  }
  const paid: AccountState = {
    ...prepared,
    rift: bought.state,
    currencies: { ...prepared.currencies, [offer.price.currency]: have - offer.price.amount },
  };
  const granted = applyGrant(config, paid, offer.grants);
  return ok({ state: grantRiftExtras(config, granted, offer), granted: offer.grants });
}
