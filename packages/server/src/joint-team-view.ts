import { type AccountState, type Rewards } from '@wildbound/engine';
import type { GameConfig } from './config';
import { battleDayOpen, jointOpen, jointShopTier, prepareJointTeam, prepareWild, skillCost, squadRank, unlockedRates, wildOpenNow } from './joint-team';

/** Display-ready Joint Team view (M14.4): battles, milestones, shop, squad skills, and the Wild Area. */

export interface JointTeamView {
  unlocked: boolean;
  battleDay: boolean;
  battles: {
    points: number;
    squadPoints: number;
    rank: number;
    battles: number;
    battlesLeft: number;
    tickets: number;
    refreshesLeft: number;
    opponents: { index: number; strength: number }[];
    personal: { at: number; rewards: Rewards; claimed: boolean; ready: boolean }[];
    squad: { at: number; rewards: Rewards; claimed: boolean; ready: boolean }[];
    lastRank: number | null;
  };
  shop: { id: number; tier: number; price: number; left: number; rewards: Rewards; locked: boolean; notCopied: string[] }[];
  coins: number;
  skills: { field: string; level: number; maxLevel: number; cost: number }[];
  stones: number;
  wild: {
    open: boolean;
    energy: number;
    energyMax: number;
    zone: number;
    zoneName: string;
    bossWins: number;
    points: number;
    badges: number;
    rates: number[];
    fragments: { name: string; count: number }[];
    guess: string | null;
    teleporters: number;
    cans: number;
    lastRank: number | null;
  };
}

export function buildJointTeamView(config: GameConfig, state: AccountState, now: number): JointTeamView {
  const s = prepareWild(config, prepareJointTeam(config, state, now).state, now).state;
  const jt = s.jointTeam!;
  const wa = s.wildArea!;
  const t = config.jointTeam.battles;
  const w = config.jointTeam.wild;
  const squadPoints = jt.points + jt.battles * 150;
  const tier = jointShopTier(s);
  return {
    unlocked: jointOpen(state, now),
    battleDay: battleDayOpen(now),
    battles: {
      points: jt.points,
      squadPoints,
      rank: squadRank(squadPoints, jt.week),
      battles: jt.battles,
      battlesLeft: Math.max(0, t.freePerDay - jt.battlesToday),
      tickets: s.currencies.jointTicket ?? 0,
      refreshesLeft: Math.max(0, t.freeRefreshes - jt.refreshesToday),
      opponents: jt.opponents.map((f, index) => ({ index, strength: f })),
      personal: t.personal.map((r) => ({ at: r.battles, rewards: r.rewards as Rewards, claimed: jt.claimed.includes(`p:${r.battles}`), ready: jt.battles >= r.battles })),
      squad: t.squad.map((r) => ({ at: r.points, rewards: r.rewards as Rewards, claimed: jt.claimed.includes(`s:${r.points}`), ready: squadPoints >= r.points })),
      lastRank: jt.lastRank,
    },
    shop: t.shop.map((r) => ({ id: r.id, tier: r.tier, price: r.price, left: r.limit - (jt.bought[String(r.id)] ?? 0), rewards: r.rewards as Rewards, locked: r.tier > tier, notCopied: r.notCopied ?? [] })),
    coins: s.currencies.squadCoin ?? 0,
    skills: t.skills.map((k) => ({ field: k.field, level: jt.skills[k.field] ?? 0, maxLevel: k.maxLevel, cost: skillCost(config, jt.skills[k.field] ?? 0) })),
    stones: s.currencies.coreSkillStone ?? 0,
    wild: {
      open: wildOpenNow(config, now),
      energy: wa.energy,
      energyMax: w.energyMax,
      zone: wa.zone,
      zoneName: w.zones.find((z) => z.zone === wa.zone)!.name,
      bossWins: wa.bossWins[String(wa.zone)] ?? 0,
      points: wa.points,
      badges: wa.badges,
      rates: unlockedRates(config, wa),
      fragments: Object.entries(wa.fragments).map(([id, count]) => ({ name: w.fragments.find((f) => String(f.id) === id)?.name ?? id, count })),
      guess: wa.guess?.ball ?? null,
      teleporters: s.currencies.teleporter ?? 0,
      cans: s.currencies.wildEnergyCan ?? 0,
      lastRank: wa.lastRank,
    },
  };
}
