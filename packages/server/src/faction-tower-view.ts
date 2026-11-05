import {
  climbBlock,
  factionFloorBonus,
  factionFloorPay,
  lineupBlock,
  msUntilNextUtcMidnight,
  nextFactionFloor,
  sweepPrice,
  teamsFor,
  TOWER_FACTIONS,
  weekdayUtc,
  type AccountState,
  type FactionTowerBlock,
  type FactionTowerMilestone,
  type Rewards,
  type TowerFaction,
} from '@wildbound/engine';
import type { GameConfig } from './config';
import { factionTeam, factionTowerGate, factionTowerRules, prepareFactionTower } from './faction-tower';

/** Display-ready Faction Tower view (M13.7). */

export interface FactionTeamView {
  names: string[];
  /** How many of the tower's own faction. */
  ofType: number;
  valid: boolean;
}

export interface FactionTowerTowerView {
  faction: TowerFaction;
  open: boolean;
  /** UTC weekdays it opens (0 = Sunday). */
  openDays: number[];
  floor: number;
  climbedToday: number;
  block: FactionTowerBlock | null;
  nextFloor: number;
  teams: 1 | 2;
  nextPay: Rewards;
  nextBonus: Rewards;
  nextMilestone: { floor: number; rewards: Rewards; evolveBox: number } | null;
  sweepPay: Rewards;
  team1: FactionTeamView;
  team2: FactionTeamView | null;
}

export interface FactionTowerView {
  unlocked: boolean;
  weekday: number;
  resetsInMs: number;
  floorsPerDay: number;
  floors: number;
  twoTeamFrom: number;
  minOfType: number;
  towers: FactionTowerTowerView[];
  /** The next sweep's price (0 = free), or null when none are left today. */
  sweepPrice: number | null;
  freeSweepsLeft: number;
  gems: number;
  factionCoin: number;
  starShard: number;
}

export function buildFactionTowerView(config: GameConfig, state: AccountState, now: number): FactionTowerView {
  const rules = factionTowerRules(config);
  const prepared = prepareFactionTower(state, now).state;
  const tower = prepared.factionTower;
  const weekday = weekdayUtc(now);
  const nameOf = (id: string) => config.species.get(id)?.name ?? id;
  const teamView = (faction: TowerFaction, wilds: ReturnType<typeof factionTeam>): FactionTeamView => {
    const factions = wilds.map((w) => config.species.get(w.speciesId)!.faction);
    return { names: wilds.map((w) => nameOf(w.speciesId)), ofType: factions.filter((f) => f === faction).length, valid: lineupBlock(rules, faction, factions) === null };
  };
  const milestones = config.factionTower.milestones as FactionTowerMilestone[];
  const towers = TOWER_FACTIONS.map((faction): FactionTowerTowerView => {
    const next = nextFactionFloor(tower, faction);
    const teams = teamsFor(rules, next);
    const first = factionTeam(config, prepared, faction, 'factionTower');
    const second = teams === 2 ? factionTeam(config, prepared, faction, 'factionTower2', new Set(first.map((w) => w.id))) : null;
    const milestone = milestones.find((m) => m.faction === faction && m.floor >= next);
    return {
      faction,
      open: rules.openDays[faction].includes(weekday),
      openDays: rules.openDays[faction],
      floor: tower.floors[faction],
      climbedToday: tower.climbed[faction],
      block: climbBlock(rules, tower, faction, weekday),
      nextFloor: next,
      teams,
      nextPay: factionFloorPay(rules, next),
      nextBonus: factionFloorBonus(rules, next),
      nextMilestone: milestone ? { floor: milestone.floor, rewards: milestone.rewards, evolveBox: milestone.evolveBox } : null,
      sweepPay: tower.floors[faction] > 0 ? factionFloorPay(rules, tower.floors[faction]) : {},
      team1: teamView(faction, first),
      team2: second ? teamView(faction, second) : null,
    };
  });
  return {
    unlocked: factionTowerGate(config, state, now),
    weekday,
    resetsInMs: msUntilNextUtcMidnight(now),
    floorsPerDay: rules.floorsPerDay,
    floors: rules.floors,
    twoTeamFrom: rules.twoTeamFrom,
    minOfType: rules.minOfType,
    towers,
    sweepPrice: sweepPrice(rules, tower),
    freeSweepsLeft: Math.max(0, rules.freeSweeps - tower.sweeps),
    gems: prepared.currencies.gems,
    factionCoin: prepared.currencies.factionCoin ?? 0,
    starShard: prepared.currencies.starShard ?? 0,
  };
}
