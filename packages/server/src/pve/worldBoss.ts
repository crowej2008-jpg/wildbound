import {
  attackerDamage,
  canChallengeBoss,
  claimableMilestones,
  createMail,
  ghostRecords,
  rankRewardFor,
  rankDamage,
  recordBossDamage,
  rollWorldBossDay,
  weekdayUtc,
  worldBossForWeekday,
  worldBossWindow,
  type AccountState,
  type Rewards,
  type StageEnemy,
} from '@wildbound/engine';
import { modeBattle } from '../battle';
import { applyGrant } from '../economy';
import { fail, ok, type Result } from '../index';
import type { GameConfig } from '../config';
import { worldBossDefs, type BattleOutcome } from './shared';

/**
 * World boss (M8; R9 from the source): two windows a day with three fights each, the window's damage as its
 * score, the source milestones on that score and its rank reward mailed when the window closes. ASSUMPTIONS #80.
 */

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
  const window = worldBossWindow(now, tuning.windows);
  if (!window.open) return fail('not_ready', 'the World Boss is not up now (12:00–13:00 and 18:00–19:00 UTC)');
  const rolled = rollWorldBossDay(settleWorldBoss(config, state, now).pve.worldBoss, window.key);
  if (!canChallengeBoss(rolled, tuning.fightsPerWindow)) {
    return fail('daily_limit', 'no World Boss fights left in this window');
  }

  const spec = config.pve.worldBoss.enemy;
  // Owner (2026-11-01): a really strong boss that cannot die; the fight runs its rounds on damage.
  const top = config.species.get(boss.speciesId)?.stars.at(-1);
  const b = tuning.boss;
  const enemies: StageEnemy[] = [
    {
      speciesId: boss.speciesId,
      level: Math.max(spec.baseLevel, top?.maxLevel ?? spec.baseLevel),
      stars: 99,
      stage: spec.maxStage,
      mult: { hp: b.hpMult, atk: b.atkMult, def: b.defMult },
    },
  ];
  const battle = modeBattle(config, state, {
    squadMode: 'worldBoss',
    label: 'worldBossFight',
    enemies,
    battleId: `m8:worldboss:${boss.speciesId}`,
    seed,
    rules: { undyingDefenders: true },
  });
  if (!battle) return fail('not_found', 'no Wilds available to fight');

  const damage = attackerDamage(battle);
  const recorded = recordBossDamage(rolled, damage, tuning.historyCap);
  // Owner (2026-11-01): every fight drops 5-Star Pokémon Shards.
  const drop = tuning.dropPerFight as Rewards;
  const next = applyGrant(config, { ...state, pve: { ...state.pve, worldBoss: recorded } }, drop);
  const ghosts = ghostRecords(recorded.history, 0x5eed, tuning.ghostCount);
  const claimable = claimableMilestones(recorded, recorded.score, config.pve.worldBoss.milestones);
  return ok({
    state: next,
    battle,
    win: battle.winner === 'attackers',
    rewards: drop,
    extra: {
      speciesId: boss.speciesId,
      name: boss.name,
      damage,
      bestDamage: recorded.bestDamage,
      rank: rankDamage(recorded.score, ghosts),
      ghosts,
      attemptsLeft: tuning.fightsPerWindow - recorded.attempts,
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
  const reached = boss.score >= milestones[index]!.damage;
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

/**
 * Close a finished window: mail its rank reward (the window's score against the ghost ladder) and clear its
 * counters. Runs on every load, so the reward arrives even if the boss screen is never opened.
 */
export function settleWorldBoss(config: GameConfig, state: AccountState, now: number): AccountState {
  const boss = state.pve.worldBoss;
  const window = worldBossWindow(now, config.pve.worldBoss.windows);
  if (boss.day === window.key || (boss.attempts === 0 && boss.score === 0)) return state;
  const tuning = config.pve.worldBoss;
  const rank = rankDamage(boss.score, ghostRecords(boss.history, 0x5eed, tuning.ghostCount));
  const row = rankRewardFor(rank, tuning.rankRewards);
  const rolled = rollWorldBossDay(boss, window.key);
  const mail = row
    ? [
        ...state.mail,
        createMail({
          id: `worldboss-${boss.day}`,
          subjectKey: 'mail.worldBoss.subject',
          bodyKey: 'mail.worldBoss.body',
          grants: row.rewards as Rewards,
          createdAt: now,
          ttlMs: config.economy.mailTtlHours * 3_600_000,
        }),
      ]
    : state.mail;
  return { ...state, mail, pve: { ...state.pve, worldBoss: rolled } };
}
