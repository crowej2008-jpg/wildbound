import type { DailyDungeonJson } from '@wildbound/content';
import {
  attackerDamage,
  betterGrade,
  dayKey,
  dungeonGrade,
  rollDungeonDay,
  type AccountState,
  type DungeonGrade,
  type DungeonState,
  type Rewards,
} from '@wildbound/engine';
import { modeBattle } from '../battle';
import { applyGrant } from '../economy';
import { fail, ok, type Result } from '../index';
import type { GameConfig } from '../config';
import { enemiesFor, type BattleOutcome } from './shared';

/**
 * R9 daily dungeons, from the source (packages/content/tuning/daily-dungeons.json): Gold, Vanity, XP & ASC and
 * Shard, open every day, ten difficulties each opened by trainer level. Two runs a day per dungeon, each a fight
 * or a sweep. A fight (10 rounds) is graded by kills — damage for Vanity — and pays by grade (a win without a grade
 * pays the base); a sweep pays the S amount and needs a grade on that difficulty; each difficulty's grade chests
 * are paid once ever. Enemies are Wildbound's stand-in curve at the difficulty's level. ASSUMPTIONS #78.
 */

export type DungeonExtra = { dungeonId: string; difficulty: number; grade: DungeonGrade | null; kills: number; damage: number };

export function dungeonDef(config: GameConfig, id: string): DailyDungeonJson | undefined {
  return config.dailyDungeons.dungeons.find((d) => d.id === id);
}

type Picked = { def: DailyDungeonJson; diff: DailyDungeonJson['difficulties'][number]; rolled: DungeonState };

function pick(config: GameConfig, state: AccountState, dungeonId: string, difficulty: number, now: number): Result<Picked> {
  const def = dungeonDef(config, dungeonId);
  if (!def) return fail('not_found', `unknown dungeon "${dungeonId}"`);
  const diff = def.difficulties[difficulty];
  if (!diff) return fail('invalid_input', `no difficulty ${difficulty}`);
  if (state.profile.level < diff.level) return fail('stage_locked', `${def.name} ${diff.name} opens at trainer level ${diff.level}`);
  const rolled = rollDungeonDay(state.pve.dungeons, dayKey(now));
  if ((rolled.runs[def.id] ?? 0) >= def.runs) return fail('daily_limit', `no ${def.name} runs left today`);
  return ok({ def, diff, rolled });
}

export function challengeDungeon(
  config: GameConfig,
  state: AccountState,
  dungeonId: string,
  difficulty: number,
  now: number,
  seed?: number,
): Result<BattleOutcome<DungeonExtra>> {
  const picked = pick(config, state, dungeonId, difficulty, now);
  if (!picked.ok) return picked;
  const { def, diff, rolled } = picked.value;
  const pool = config.pve.dungeonEnemies[def.id];
  const enemies = enemiesFor(config, { ...pool, baseLevel: diff.level, levelSlope: 1 }, 0);
  const battle = modeBattle(config, state, {
    squadMode: 'campaign',
    label: 'dungeon',
    enemies,
    battleId: `r9:dungeon:${diff.id}`,
    seed,
    rules: { roundLimit: def.rounds },
  });
  if (!battle) return fail('not_found', 'no Pokémon available');
  const win = battle.winner === 'attackers';
  const kills = battle.events.filter((e) => e.type === 'death' && e.unit.startsWith('defenders')).length;
  const damage = attackerDamage(battle);
  const grade = dungeonGrade(diff.grades, { kills, damage, rounds: battle.rounds });
  const rewards: Rewards = grade ? diff.grades.find((g) => g.grade === grade)!.pay : win ? diff.winPay : {};
  const dungeons = {
    ...rolled,
    runs: { ...rolled.runs, [def.id]: (rolled.runs[def.id] ?? 0) + 1 },
    best: { ...rolled.best, ...(grade ? { [diff.id]: betterGrade(rolled.best[diff.id], grade)! } : {}) },
  };
  const next = applyGrant(config, { ...state, pve: { ...state.pve, dungeons } }, rewards);
  return ok({ state: next, battle, win, rewards, extra: { dungeonId: def.id, difficulty, grade, kills, damage } });
}

/** Sweep a graded difficulty: one run, the S pay (source sweep_reward). */
export function sweepDungeon(config: GameConfig, state: AccountState, dungeonId: string, difficulty: number, now: number): Result<{ state: AccountState; granted: Rewards }> {
  const picked = pick(config, state, dungeonId, difficulty, now);
  if (!picked.ok) return picked;
  const { def, diff, rolled } = picked.value;
  if (!rolled.best[diff.id]) return fail('not_ready', `clear ${def.name} ${diff.name} with a grade first`);
  const dungeons = { ...rolled, runs: { ...rolled.runs, [def.id]: (rolled.runs[def.id] ?? 0) + 1 } };
  return ok({ state: applyGrant(config, { ...state, pve: { ...state.pve, dungeons } }, diff.sweep), granted: diff.sweep });
}

/** Draw a difficulty's grade chest once the grade is reached (paid once ever). */
export function claimDungeonChest(config: GameConfig, state: AccountState, difficultyId: string, grade: DungeonGrade): Result<{ state: AccountState; granted: Rewards }> {
  const diff = config.dailyDungeons.dungeons.flatMap((d) => d.difficulties).find((x) => x.id === difficultyId);
  if (!diff) return fail('not_found', `no dungeon difficulty ${difficultyId}`);
  const order = ['C', 'B', 'A', 'S'];
  const best = state.pve.dungeons.best[difficultyId];
  if (!best || order.indexOf(grade) > order.indexOf(best)) return fail('not_ready', `reach grade ${grade} first`);
  const key = `${difficultyId}:${grade}`;
  if (state.pve.dungeons.chests.includes(key)) return fail('not_ready', 'chest already drawn');
  const chest = diff.grades.find((g) => g.grade === grade)!.chest;
  const dungeons = { ...state.pve.dungeons, chests: [...state.pve.dungeons.chests, key] };
  return ok({ state: applyGrant(config, { ...state, pve: { ...state.pve, dungeons } }, chest), granted: chest });
}
