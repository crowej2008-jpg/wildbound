import {
  arenaRank,
  arenaAttemptPrice,
  buyArenaAttempt,
  canChallengeArena,
  claimAchievement,
  claimArenaChest as markChestClaimed,
  claimableAchievements,
  claimableArenaChests,
  dayKey,
  recordArenaBattle,
  refreshArena as bumpArenaSeed,
  rollArenaDay,
  type AccountState,
  type Rewards,
} from '@wildbound/engine';
import { modeBattle } from '../battle';
import { applyGrant } from '../economy';
import { fail, ok, type Result } from '../index';
import { vipPerks } from '../vip';
import type { GameConfig } from '../config';
import type { BattleOutcome } from '../pve/shared';
import { arenaOpponentAt, arenaTuning, arenaUnlocked } from './shared';

/**
 * Arena actions (M10, PROMPT §7.7): credits and rank from a real 6v6 vs a ghost
 * squad, daily attempts (free + bought), participation chests and best-rank
 * achievements. Pure `AccountState` transitions; the LocalServer commits them.
 * See docs/design/pvp.md.
 */

export interface ArenaExtra {
  opponentIndex: number;
  win: boolean;
  creditsBefore: number;
  creditsAfter: number;
  place: number;
  attemptsLeft: number;
  claimableChests: number[];
  claimableAchievements: number[];
}

/** Fight one of the day's three matched Arena opponents with the attack squad. */
export function challengeArena(
  config: GameConfig,
  state: AccountState,
  now: number,
  opponentIndex: number,
  seed?: number,
): Result<BattleOutcome<ArenaExtra>> {
  if (!arenaUnlocked(config, state)) return fail('stage_locked', 'clear the Arena chapter to unlock the Arena');
  const tuning = arenaTuning(config);
  const arena = rollArenaDay(state.pvp.arena, dayKey(now));
  const enemies = arenaOpponentAt(config, arena, opponentIndex);
  if (!enemies) return fail('invalid_input', `no Arena opponent at index ${opponentIndex}`);
  if (!canChallengeArena(arena, tuning)) return fail('daily_limit', 'no Arena attempts left today');

  const battle = modeBattle(config, state, {
    squadMode: 'arenaAttack',
    label: 'arenaFight',
    enemies,
    battleId: `m10:arena:${arena.opponentSeed}:${opponentIndex}`,
    seed,
    pvp: true,
  });
  if (!battle) return fail('not_found', 'no Wilds available to challenge the Arena');

  const win = battle.winner === 'attackers';
  const recorded = recordArenaBattle(arena, win, tuning);
  const next: AccountState = { ...state, pvp: { ...state.pvp, arena: recorded } };
  return ok({
    state: next,
    battle,
    win,
    rewards: {},
    extra: {
      opponentIndex,
      win,
      creditsBefore: arena.credits,
      creditsAfter: recorded.credits,
      place: arenaRank(recorded.credits, tuning.bands),
      attemptsLeft: Math.max(0, tuning.freeAttemptsPerDay + recorded.bought - recorded.attempts),
      claimableChests: claimableArenaChests(recorded, tuning),
      claimableAchievements: claimableAchievements(recorded, tuning),
    },
  });
}

/** Spend gems for `count` extra Arena attempts at the day's prices. */
export function buyArenaAttempts(
  config: GameConfig,
  state: AccountState,
  now: number,
  count: number,
): Result<{ state: AccountState; bought: number; spent: number }> {
  const tuning = arenaTuning(config);
  if (!Number.isInteger(count) || count <= 0) return fail('invalid_input', 'count must be a positive integer');
  let arena = rollArenaDay(state.pvp.arena, dayKey(now));
  // R8: the VIP level caps the day's attempt buys (vip_priv arena_buy_num).
  const cap = vipPerks(config, state).arenaBuys;
  if (arena.bought + count > cap) return fail('daily_limit', `VIP ${vipPerks(config, state).level} buys ${cap} attempts a day`);
  let spent = 0;
  for (let i = 0; i < count; i += 1) {
    spent += arenaAttemptPrice(arena, tuning);
    arena = buyArenaAttempt(arena);
  }
  if (state.currencies.gems < spent) return fail('insufficient_items', 'not enough gems to buy attempts');
  const next: AccountState = {
    ...state,
    currencies: { ...state.currencies, gems: state.currencies.gems - spent },
    pvp: { ...state.pvp, arena },
  };
  return ok({ state: next, bought: arena.bought, spent });
}

/** Re-roll the day's three opponents (a free refresh, stable until the next one). */
export function refreshArena(config: GameConfig, state: AccountState, now: number): Result<AccountState> {
  if (!arenaUnlocked(config, state)) return fail('stage_locked', 'clear the Arena chapter to unlock the Arena');
  const arena = rollArenaDay(state.pvp.arena, dayKey(now));
  return ok({ ...state, pvp: { ...state.pvp, arena: bumpArenaSeed(arena) } });
}

/** Claim one reached participation chest (the first N battles of the day). */
export function claimArenaChest(
  config: GameConfig,
  state: AccountState,
  now: number,
  index: number,
): Result<{ state: AccountState; granted: Rewards }> {
  const tuning = arenaTuning(config);
  const arena = rollArenaDay(state.pvp.arena, dayKey(now));
  if (!Number.isInteger(index) || index < 0 || index >= tuning.chestTiers.length) {
    return fail('invalid_input', `no Arena chest at index ${index}`);
  }
  if (!claimableArenaChests(arena, tuning).includes(index)) {
    return fail('not_ready', 'chest not reached or already claimed');
  }
  const granted = tuning.chestTiers[index]!.reward;
  const next = applyGrant(
    config,
    { ...state, pvp: { ...state.pvp, arena: markChestClaimed(arena, index) } },
    granted,
  );
  return ok({ state: next, granted });
}

/** Claim one reached best-rank achievement (one-time, by best-ever place). */
export function claimArenaAchievement(
  config: GameConfig,
  state: AccountState,
  now: number,
  index: number,
): Result<{ state: AccountState; granted: Rewards }> {
  const tuning = arenaTuning(config);
  const arena = rollArenaDay(state.pvp.arena, dayKey(now));
  if (!Number.isInteger(index) || index < 0 || index >= tuning.bestRankTiers.length) {
    return fail('invalid_input', `no Arena achievement at index ${index}`);
  }
  if (!claimableAchievements(arena, tuning).includes(index)) {
    return fail('not_ready', 'achievement not reached or already claimed');
  }
  const granted = tuning.bestRankTiers[index]!.reward;
  const next = applyGrant(
    config,
    { ...state, pvp: { ...state.pvp, arena: claimAchievement(arena, index) } },
    granted,
  );
  return ok({ state: next, granted });
}
