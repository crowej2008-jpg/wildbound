import {
  addRewards,
  attackerDamage,
  bossFightsLeft,
  bossReward,
  clearGuardian,
  curveLevel,
  dayKey,
  exploreAccess,
  generateEnemies,
  groveBoss,
  guardianBlock,
  guardianReward,
  harvestPlot,
  initialBerryGrove,
  mulberry32,
  plantSeed,
  recordBossFight,
  rollBerryGrove,
  seedRule,
  weekdayUtc,
  type AccountState,
  type BerryGroveRules,
  type BerryGroveState,
  type CurrencyId,
  type GroveError,
  type Rewards,
  type SeedTier,
  type StageEnemy,
} from '@wildbound/engine';
import { buildEnemyTeam, buildWildTeam, fielded, runTeams, type BattleView } from './battle';
import { grantBerry } from './berries';
import type { GameConfig } from './config';
import { applyGrant } from './economy';
import { fail, ok, type Result } from './index';
import { resolveCurve } from './pve/shared';

/**
 * Berry Grove (M13.8): the owner's replacement for the Island Challenge (2026-11-04: "garden + battles"). The
 * Grove Guardians (100 stages, 10 wins a day) and the daily Grove Boss (3 fights; a boss that cannot fall, paid by
 * the share of its HP taken) pay seeds and berry materials; seeds planted in the garden grow into berries of their
 * tier plus Berry Essence. Every number is a stand-in. See docs/design/berry-grove.md.
 */

export function groveRules(config: GameConfig): BerryGroveRules {
  return config.berryGrove as unknown as BerryGroveRules;
}

export function groveGate(config: GameConfig, state: AccountState, now: number): boolean {
  const mode = config.explore.modes.find((m) => m.id === 'berry-grove');
  if (!mode) return false;
  return exploreAccess(mode.gates, {
    campaign: state.campaign,
    level: state.profile.level,
    serverDay: Math.floor((now - state.serverEpoch) / 86_400_000) + 1,
  }).unlocked;
}

/** The grove, started on first use; daily counters rolled. */
export function prepareBerryGrove(config: GameConfig, state: AccountState, now: number): { state: AccountState; changed: boolean } {
  const day = dayKey(now);
  const current = state.berryGrove ?? initialBerryGrove(groveRules(config), day);
  const rolled = rollBerryGrove(current, day);
  if (rolled === state.berryGrove) return { state, changed: false };
  return { state: { ...state, berryGrove: rolled }, changed: true };
}

const ERROR_TEXT: Record<GroveError, string> = {
  no_plot: 'there is no such plot',
  plot_busy: 'that plot is already growing something',
  plot_empty: 'nothing is planted there',
  not_ripe: 'that berry is not ripe yet',
  no_seed: 'no seeds of that kind',
  bad_seed: 'unknown seed',
};

const LOCKED = 'the Berry Grove opens after story 3-10 and trainer level 10';

function withGrove(state: AccountState, grove: BerryGroveState): AccountState {
  return { ...state, berryGrove: grove };
}

export function isSeedTier(value: string): value is SeedTier {
  return value === 'common' || value === 'basic' || value === 'intermediate' || value === 'greater';
}

/** Plant one seed of `tier` in an empty plot. */
export function plantGrove(config: GameConfig, state: AccountState, now: number, plot: number, tier: SeedTier): Result<AccountState> {
  if (!groveGate(config, state, now)) return fail('resource_locked', LOCKED);
  const rules = groveRules(config);
  const prepared = prepareBerryGrove(config, state, now).state;
  const rule = seedRule(rules, tier);
  if (!rule) return fail('invalid_input', ERROR_TEXT.bad_seed);
  const currency = rule.currency as CurrencyId;
  const have = prepared.currencies[currency] ?? 0;
  if (have < 1) return fail('insufficient_items', ERROR_TEXT.no_seed);
  const planted = plantSeed(rules, prepared.berryGrove!, plot, tier, now);
  if (!planted.ok) return fail('invalid_input', ERROR_TEXT[planted.error]);
  return ok(withGrove({ ...prepared, currencies: { ...prepared.currencies, [currency]: have - 1 } }, planted.state));
}

export interface GroveHarvest {
  state: AccountState;
  /** Berry definition ids grown. */
  berries: string[];
  rewards: Rewards;
}

/** Harvest one ripe plot, or every ripe plot when `plot` is omitted. Each gives a random berry of its tier + Essence. */
export function harvestGrove(config: GameConfig, state: AccountState, now: number, plot?: number): Result<GroveHarvest> {
  if (!groveGate(config, state, now)) return fail('resource_locked', LOCKED);
  const rules = groveRules(config);
  let next = prepareBerryGrove(config, state, now).state;
  const plots = plot === undefined ? next.berryGrove!.plots.map((_, i) => i) : [plot];
  const rng = mulberry32((Math.floor(now / 1000) ^ 0xbe77) >>> 0);
  const berries: string[] = [];
  let rewards: Rewards = {};
  for (const i of plots) {
    const out = harvestPlot(rules, next.berryGrove!, i, now);
    if (!out.ok) {
      if (plot !== undefined) return fail(out.error === 'not_ripe' ? 'not_ready' : 'invalid_input', ERROR_TEXT[out.error]);
      continue;
    }
    next = withGrove(next, out.state);
    const pool = config.equipment.berries.berries.filter((b) => b.tier === out.tier);
    const def = pool[Math.floor(rng() * pool.length)]!;
    const granted = grantBerry(config, next, def.id, rng);
    if (granted.ok) {
      next = granted.value;
      berries.push(def.id);
    }
    rewards = addRewards(rewards, { berryEssence: seedRule(rules, out.tier)!.essence });
  }
  if (berries.length === 0 && plot === undefined) return fail('not_ready', 'nothing is ripe yet');
  return ok({ state: applyGrant(config, next, rewards), berries, rewards });
}

function guardianCurve(config: GameConfig) {
  return resolveCurve(config, config.berryGrove.guardians.enemy);
}

export function guardianEnemies(config: GameConfig, stage: number): StageEnemy[] {
  return generateEnemies(guardianCurve(config), stage - 1, 0x62e7);
}

export interface GroveFight {
  state: AccountState;
  battle: BattleView;
  win: boolean;
  rewards: Rewards;
  stage: number;
  /** Grove Boss only: the share of the boss's HP taken (0–1). */
  share?: number;
}

/** Fight the next Grove Guardian stage. Only wins count toward the day's 10. */
export function challengeGuardian(config: GameConfig, state: AccountState, now: number, seed?: number): Result<GroveFight> {
  if (!groveGate(config, state, now)) return fail('resource_locked', LOCKED);
  const rules = groveRules(config);
  const prepared = prepareBerryGrove(config, state, now).state;
  const grove = prepared.berryGrove!;
  const block = guardianBlock(rules, grove);
  if (block === 'top') return fail('invalid_input', 'every Grove Guardian is beaten');
  if (block === 'daily_limit') return fail('daily_limit', 'no Guardian wins left today');
  const stage = grove.stage + 1;
  const team = fielded(prepared, 'berryGrove');
  const battle = runTeams(buildWildTeam(team, 'attackers', config, prepared), buildEnemyTeam(guardianEnemies(config, stage), config), {
    seed: seed ?? Math.floor(config.rng() * 0xffffffff),
    mode: 'berryGrove',
    battleId: `m13:grove:guardian:${stage}`,
    strategies: { attackers: prepared.strategies.berryGrove },
  });
  if (!battle) return fail('not_found', 'no Pokémon available for the Berry Grove');
  const win = battle.winner === 'attackers';
  if (!win) return ok({ state: prepared, battle, win, rewards: {}, stage });
  const rewards = guardianReward(rules, stage);
  return ok({ state: applyGrant(config, withGrove(prepared, clearGuardian(grove)), rewards), battle, win, rewards, stage });
}

/** Today's Grove Boss: the weekday's species at the next Guardian stage's level, with boss multipliers. */
export function groveBossEnemy(config: GameConfig, stage: number, weekday: number): StageEnemy {
  const rules = groveRules(config);
  const curve = guardianCurve(config);
  const index = Math.max(0, stage);
  return {
    speciesId: groveBoss(rules, weekday),
    level: curveLevel(curve, index) + 2,
    stars: Math.min(curve.maxStars, 1 + Math.floor(index / Math.max(1, curve.starsEvery))),
    stage: Math.min(curve.maxStage, Math.floor(index / Math.max(1, curve.stageEvery))),
    mult: { hp: rules.boss.hpMult, atk: rules.boss.atkMult, def: rules.boss.defMult },
  };
}

/** Fight today's Grove Boss: it cannot fall; the share of its HP taken scales the band's pay. */
export function fightGroveBoss(config: GameConfig, state: AccountState, now: number, seed?: number): Result<GroveFight> {
  if (!groveGate(config, state, now)) return fail('resource_locked', LOCKED);
  const rules = groveRules(config);
  const prepared = prepareBerryGrove(config, state, now).state;
  const grove = prepared.berryGrove!;
  if (bossFightsLeft(rules, grove) <= 0) return fail('daily_limit', 'no Grove Boss fights left today');
  const team = fielded(prepared, 'berryGrove');
  const battle = runTeams(
    buildWildTeam(team, 'attackers', config, prepared),
    buildEnemyTeam([groveBossEnemy(config, grove.stage, weekdayUtc(now))], config),
    {
      seed: seed ?? Math.floor(config.rng() * 0xffffffff),
      mode: 'berryGrove',
      battleId: `m13:grove:boss:${dayKey(now)}`,
      rules: { undyingDefenders: true },
      strategies: { attackers: prepared.strategies.berryGrove },
    },
  );
  if (!battle) return fail('not_found', 'no Pokémon available for the Berry Grove');
  const bossHp = battle.units.filter((u) => u.side === 'defenders').reduce((s, u) => s + u.maxHp, 0);
  const share = bossHp > 0 ? Math.min(1, attackerDamage(battle) / bossHp) : 0;
  const rewards = bossReward(rules, grove.stage, share);
  return ok({
    state: applyGrant(config, withGrove(prepared, recordBossFight(grove, share)), rewards),
    battle,
    win: battle.winner === 'attackers',
    rewards,
    stage: grove.stage,
    share,
  });
}
