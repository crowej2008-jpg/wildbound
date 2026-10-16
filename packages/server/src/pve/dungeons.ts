import {
  dayKey,
  dungeonsForWeekday,
  markDungeonCleared,
  rollDungeonDay,
  weekdayUtc,
  type AccountState,
  type Rewards,
} from '@wildbound/engine';
import { modeBattle } from '../battle';
import { applyGrant } from '../economy';
import { fail, ok, type Result } from '../index';
import type { GameConfig } from '../config';
import { dungeonDefs, enemiesFor, type BattleOutcome } from './shared';

/** Daily dungeons (M8, PROMPT §7.6): one per weekday, first clear of the day pays. */

export type DungeonExtra = { dungeonId: string; firstToday: boolean };

export function challengeDungeon(
  config: GameConfig,
  state: AccountState,
  dungeonId: string,
  now: number,
  seed?: number,
): Result<BattleOutcome<DungeonExtra>> {
  const def = dungeonDefs(config).find((d) => d.id === dungeonId);
  if (!def) return fail('not_found', `unknown dungeon "${dungeonId}"`);
  const weekday = weekdayUtc(now);
  if (!dungeonsForWeekday(dungeonDefs(config), weekday).some((d) => d.id === dungeonId)) {
    return fail('stage_locked', 'this dungeon is not open today');
  }
  const enemies = enemiesFor(config, def.enemy, 0);
  const battle = modeBattle(config, state, {
    squadMode: 'campaign',
    label: 'dungeon',
    enemies,
    battleId: `m8:dungeon:${dungeonId}`,
    seed,
  });
  if (!battle) return fail('not_found', 'no Wilds available');
  const win = battle.winner === 'attackers';

  const rolled = rollDungeonDay(state.pve.dungeons, dayKey(now));
  const firstToday = !rolled.cleared.includes(dungeonId);
  let next: AccountState = { ...state, pve: { ...state.pve, dungeons: rolled } };
  let rewards: Rewards = {};
  if (win) {
    rewards = firstToday ? (def.rewards as Rewards) : {};
    next = applyGrant(config, { ...next, pve: { ...next.pve, dungeons: markDungeonCleared(rolled, dungeonId) } }, rewards);
  }
  return ok({ state: next, battle, win, rewards, extra: { dungeonId, firstToday } });
}
