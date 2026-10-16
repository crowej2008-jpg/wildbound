import {
  attackerDamage,
  canChallengeBoss,
  claimableMilestones,
  dayKey,
  ghostRecords,
  rankDamage,
  recordBossDamage,
  rollWorldBossDay,
  weekdayUtc,
  worldBossForWeekday,
  type AccountState,
  type Rewards,
  type StageEnemy,
} from '@wildbound/engine';
import { modeBattle } from '../battle';
import { applyGrant } from '../economy';
import { fail, ok, type Result } from '../index';
import type { GameConfig } from '../config';
import { worldBossDefs, type BattleOutcome } from './shared';

/** World boss (M8, PROMPT §7.6): damage scoring, milestones, ghost-ladder rank. */

export interface WorldBossExtra {
  speciesId: string;
  name: string;
  damage: number;
  bestDamage: number;
  rank: number;
  ghosts: number[];
  attemptsLeft: number;
  claimable: number[];
}

export function challengeWorldBoss(
  config: GameConfig,
  state: AccountState,
  now: number,
  seed?: number,
): Result<BattleOutcome<WorldBossExtra>> {
  const defs = worldBossDefs(config);
  const boss = worldBossForWeekday(defs, weekdayUtc(now));
  if (!boss) return fail('not_found', 'no world boss today');
  const tuning = config.pve.worldBoss;
  const rolled = rollWorldBossDay(state.pve.worldBoss, dayKey(now));
  if (!canChallengeBoss(rolled, tuning.attemptsPerDay)) {
    return fail('daily_limit', 'no world-boss fights left today');
  }

  const spec = config.pve.worldBoss.enemy;
  const enemies: StageEnemy[] = [
    { speciesId: boss.speciesId, level: spec.baseLevel, stars: spec.maxStars, stage: spec.maxStage },
  ];
  const battle = modeBattle(config, state, {
    squadMode: 'worldBoss',
    label: 'worldBossFight',
    enemies,
    battleId: `m8:worldboss:${boss.speciesId}`,
    seed,
  });
  if (!battle) return fail('not_found', 'no Wilds available to fight');

  const damage = attackerDamage(battle);
  const recorded = recordBossDamage(rolled, damage, tuning.historyCap);
  const next = applyGrant(config, { ...state, pve: { ...state.pve, worldBoss: recorded } }, {});
  const ghosts = ghostRecords(recorded.history, 0x5eed, tuning.ghostCount);
  const claimable = claimableMilestones(recorded, damage, config.pve.worldBoss.milestones);
  return ok({
    state: next,
    battle,
    win: battle.winner === 'attackers',
    rewards: {},
    extra: {
      speciesId: boss.speciesId,
      name: boss.name,
      damage,
      bestDamage: recorded.bestDamage,
      rank: rankDamage(damage, ghosts),
      ghosts,
      attemptsLeft: tuning.attemptsPerDay - recorded.attempts,
      claimable,
    },
  });
}

export function claimWorldBossMilestone(
  config: GameConfig,
  state: AccountState,
  index: number,
): Result<{ state: AccountState; granted: Rewards }> {
  const milestones = config.pve.worldBoss.milestones;
  if (!Number.isInteger(index) || index < 0 || index >= milestones.length) {
    return fail('invalid_input', `no world-boss milestone at index ${index}`);
  }
  const boss = state.pve.worldBoss;
  const reached = boss.lastDamage >= milestones[index]!.damage;
  if (!reached || boss.claimedMilestones.includes(index)) {
    return fail('not_ready', 'milestone not reached or already claimed');
  }
  const granted = milestones[index]!.rewards as Rewards;
  const next = applyGrant(
    config,
    { ...state, pve: { ...state.pve, worldBoss: { ...boss, claimedMilestones: [...boss.claimedMilestones, index] } } },
    granted,
  );
  return ok({ state: next, granted });
}
