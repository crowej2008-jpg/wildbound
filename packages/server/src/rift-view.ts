import {
  isBossFloor,
  merchantOpen,
  nextRiftFloor,
  riftDifficulty,
  riftDrops,
  riftSeasonCountdown,
  riftSeasonOpen,
  type AccountState,
  type Rewards,
} from '@wildbound/engine';
import type { GameConfig } from './config';
import { prepareRift, riftGate, riftRules } from './rift';

/** Display-ready Rift Barriers view (M13.4). Pure reads of a rolled-forward state. */

export interface RiftChestView {
  challenges: number;
  rewards: Rewards;
  claimable: boolean;
  claimed: boolean;
}

export interface RiftMerchantView {
  id: string;
  name: string;
  unlockFloor: number;
  open: boolean;
  currency: 'timeCoin' | 'gems';
  price: number;
  grants: Rewards;
  /** Orbs / Mythic held items in the row, described. */
  extra: string | null;
  left: number;
  limit: number;
  affordable: boolean;
}

export interface RiftMilestoneView {
  floor: number;
  rewards: Rewards;
  extra: string | null;
  reached: boolean;
}

function extraText(x: { orbs?: { colour: string; level: number; count: number }; mythicHeld?: number }): string | null {
  const parts: string[] = [];
  if (x.orbs) parts.push(`${x.orbs.count} × ${x.orbs.colour} Orb +${x.orbs.level}`);
  if (x.mythicHeld) parts.push(`${x.mythicHeld} × random Mythic held item`);
  return parts.length > 0 ? parts.join(', ') : null;
}

export interface RiftView {
  unlocked: boolean;
  seasonOpen: boolean;
  /** Ms until the season ends (open) or opens (closed). */
  countdownMs: number;
  difficulty: number;
  syncLevel: number;
  highest: number;
  floors: number;
  easyFloors: number;
  /** The next floor to fight, or null when all are cleared. */
  nextFloor: number | null;
  nextIsBoss: boolean;
  /** 'easy' | 'advanced' for the next floor. */
  track: 'easy' | 'advanced';
  nextDrops: Rewards;
  /** The next Easy floor reward still ahead (floor and rewards), if any. */
  nextFloorReward: { floor: number; rewards: Rewards } | null;
  lives: number;
  livesPerDay: number;
  challenges: number;
  timeCoins: number;
  coinToGold: number;
  chests: RiftChestView[];
  merchant: RiftMerchantView[];
  milestones: RiftMilestoneView[];
}

export function buildRiftView(config: GameConfig, state: AccountState, now: number): RiftView {
  const rules = riftRules(config);
  const rolled = prepareRift(config, state, now).state;
  const rift = rolled.rift;
  const next = nextRiftFloor(rules, rift);
  const difficulty = riftDifficulty(rules, rift);
  return {
    unlocked: riftGate(config, state, now),
    seasonOpen: riftSeasonOpen(rules, now),
    countdownMs: riftSeasonCountdown(rules, now),
    difficulty: difficulty.difficulty,
    syncLevel: difficulty.syncLevel,
    highest: rift.highest,
    floors: rules.floors,
    easyFloors: rules.easyFloors,
    nextFloor: next,
    nextIsBoss: next !== null && isBossFloor(rules, next),
    track: next !== null && next > rules.easyFloors ? 'advanced' : 'easy',
    nextDrops: next !== null ? riftDrops(rules, next) : {},
    nextFloorReward: difficulty.floorRewards.find((r) => r.floor > rift.highest) ?? null,
    lives: rift.lives,
    livesPerDay: rules.livesPerDay,
    challenges: rift.challenges,
    timeCoins: rolled.currencies.timeCoin ?? 0,
    coinToGold: rules.coinToGold,
    merchant: rules.merchant.map((o) => {
      const used = rift.bought[o.id] ?? 0;
      return {
        id: o.id,
        name: o.name,
        unlockFloor: o.unlockFloor,
        open: merchantOpen(rules, rift, o),
        currency: o.price.currency,
        price: o.price.amount,
        grants: o.grants,
        extra: extraText(o),
        left: Math.max(0, o.limit - used),
        limit: o.limit,
        affordable: (rolled.currencies[o.price.currency] ?? 0) >= o.price.amount,
      };
    }),
    milestones: rules.milestones.map((m) => ({ floor: m.floor, rewards: m.rewards, extra: extraText(m), reached: rift.highest >= m.floor })),
    chests: rules.chests.map((c) => ({
      challenges: c.challenges,
      rewards: c.rewards,
      claimed: rift.claimedChests.includes(c.challenges),
      claimable: rift.challenges >= c.challenges && !rift.claimedChests.includes(c.challenges),
    })),
  };
}
