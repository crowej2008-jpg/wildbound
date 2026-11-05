import {
  bossFightsLeft,
  bossReward,
  groveBoss,
  guardianBlock,
  guardianReward,
  msUntilNextUtcMidnight,
  ripeAt,
  weekdayUtc,
  type AccountState,
  type CurrencyId,
  type Rewards,
  type SeedTier,
} from '@wildbound/engine';
import type { GameConfig } from './config';
import { groveBossEnemy, groveGate, groveRules, prepareBerryGrove } from './berry-grove';

/** Display-ready Berry Grove view (M13.8). */

export interface GrovePlotView {
  index: number;
  seed: SeedTier | null;
  /** ms until ripe (0 = ripe; null when empty). */
  ripeInMs: number | null;
}

export interface BerryGroveView {
  unlocked: boolean;
  resetsInMs: number;
  plots: GrovePlotView[];
  seeds: { tier: SeedTier; currency: string; have: number; growHours: number; essence: number }[];
  guardians: {
    stage: number;
    stages: number;
    winsToday: number;
    winsPerDay: number;
    block: 'top' | 'daily_limit' | null;
    nextReward: Rewards;
  };
  boss: {
    speciesId: string;
    name: string;
    level: number;
    fightsLeft: number;
    fightsPerDay: number;
    bestShare: number;
    fullPay: Rewards;
  };
  materials: Record<string, number>;
}

const MATERIALS: CurrencyId[] = ['berryEssence', 'berryMulchBlue', 'berryMulchPurple', 'berryMulchOrange', 'berryMulchRed', 'reforgePotion'];

export function buildBerryGroveView(config: GameConfig, state: AccountState, now: number): BerryGroveView {
  const rules = groveRules(config);
  const prepared = prepareBerryGrove(config, state, now).state;
  const grove = prepared.berryGrove!;
  const bossId = groveBoss(rules, weekdayUtc(now));
  const bossEnemy = groveBossEnemy(config, grove.stage, weekdayUtc(now));
  return {
    unlocked: groveGate(config, state, now),
    resetsInMs: msUntilNextUtcMidnight(now),
    plots: grove.plots.map((p, index) => {
      const at = ripeAt(rules, grove, index);
      return { index, seed: p.seed, ripeInMs: at === null ? null : Math.max(0, at - now) };
    }),
    seeds: rules.seeds.map((s) => ({
      tier: s.tier,
      currency: s.currency,
      have: prepared.currencies[s.currency as CurrencyId] ?? 0,
      growHours: s.growHours,
      essence: s.essence,
    })),
    guardians: {
      stage: grove.stage,
      stages: rules.guardians.stages,
      winsToday: grove.climbsToday,
      winsPerDay: rules.guardians.climbsPerDay,
      block: guardianBlock(rules, grove),
      nextReward: grove.stage < rules.guardians.stages ? guardianReward(rules, grove.stage + 1) : {},
    },
    boss: {
      speciesId: bossId,
      name: config.species.get(bossId)?.name ?? bossId,
      level: bossEnemy.level,
      fightsLeft: bossFightsLeft(rules, grove),
      fightsPerDay: rules.boss.fightsPerDay,
      bestShare: grove.bossBest,
      fullPay: bossReward(rules, grove.stage, 1),
    },
    materials: Object.fromEntries(MATERIALS.map((m) => [m, prepared.currencies[m] ?? 0])),
  };
}
