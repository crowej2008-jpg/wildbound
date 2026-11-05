import {
  addRewards,
  clearFactionFloor,
  climbBlock,
  dayKey,
  exploreAccess,
  factionFloorBonus,
  factionFloorPay,
  generateEnemies,
  lineupBlock,
  mulberry32,
  nextFactionFloor,
  rollFactionTower,
  spendFactionSweep,
  sweepPrice,
  teamsFor,
  weekdayUtc,
  type AccountState,
  type Faction,
  type FactionTowerMilestone,
  type FactionTowerRules,
  type FactionTowerState,
  type Rewards,
  type TowerFaction,
  type WildInstance,
} from '@wildbound/engine';
import { buildEnemyTeam, buildWildTeam, powerOf, runTeams, type BattleView } from './battle';
import type { GameConfig } from './config';
import { applyGrant } from './economy';
import { grantDraws } from './gacha';
import { fail, ok, type Result } from './index';
import { resolveCurve } from './pve/shared';
import { withBadgeBonus } from './victory-road';

/**
 * Faction Tower (M13.7). Three type-locked towers (Water, Fire, Grass), 1,000 floors each, open on their weekdays
 * (all on Sunday); 20 floors a day each; one team of six until floor 700, two teams from 701. A team admits its
 * tower's faction plus Light and Dark, at least 4 of the tower's own. Each clear pays the floor's Gold / Star
 * Shards / Faction Coins, every 5th floor a one-time bonus, and the source milestones (5-Star Pokémon Shards and
 * the tower's Powerful Evolve box, opened at once). Sweeps pay the highest floor. See docs/design/faction-tower.md.
 */

export function factionTowerRules(config: GameConfig): FactionTowerRules {
  return config.factionTower as unknown as FactionTowerRules;
}

export function factionTowerGate(config: GameConfig, state: AccountState, now: number): boolean {
  const mode = config.explore.modes.find((m) => m.id === 'faction-tower');
  if (!mode) return false;
  return exploreAccess(mode.gates, {
    campaign: state.campaign,
    level: state.profile.level,
    serverDay: Math.floor((now - state.serverEpoch) / 86_400_000) + 1,
  }).unlocked;
}

/** Today's counters (rolled at the UTC day). */
export function prepareFactionTower(state: AccountState, now: number): { state: AccountState; changed: boolean } {
  const rolled = rollFactionTower(state.factionTower, dayKey(now));
  if (rolled === state.factionTower) return { state, changed: false };
  return { state: { ...state, factionTower: rolled }, changed: true };
}

const TOWER_NAME: Record<TowerFaction, string> = { water: 'Water', fire: 'Fire', grass: 'Grass' };

export function isTowerFaction(value: string): value is TowerFaction {
  return value === 'water' || value === 'fire' || value === 'grass';
}

/**
 * A team for a tower: the squad's eligible picks (its own faction or an ally, not used by the other team), then
 * the strongest eligible roster Pokémon — the tower's own first until `minOfType` is met — up to six.
 */
export function factionTeam(
  config: GameConfig,
  state: AccountState,
  faction: TowerFaction,
  squad: 'factionTower' | 'factionTower2',
  exclude: ReadonlySet<string> = new Set(),
): WildInstance[] {
  const rules = factionTowerRules(config);
  const factionOf = (w: WildInstance): Faction | undefined => config.species.get(w.speciesId)?.faction;
  const allowed = (w: WildInstance) => {
    const f = factionOf(w);
    return f === faction || (f !== undefined && rules.allies.includes(f));
  };
  const byId = new Map(state.roster.map((w) => [w.id, w]));
  const out: WildInstance[] = [];
  const species = new Set<string>();
  const take = (w: WildInstance) => {
    if (out.length >= 6 || exclude.has(w.id) || species.has(w.speciesId) || !allowed(w)) return;
    out.push(w);
    species.add(w.speciesId);
  };
  for (const id of state.squads[squad]) {
    const w = id ? byId.get(id) : undefined;
    if (w) take(w);
  }
  const ranked = [...state.roster].sort((a, b) => powerOf(b, config, state) - powerOf(a, config, state));
  const own = () => out.filter((w) => factionOf(w) === faction).length;
  for (const w of ranked) {
    if (own() >= rules.minOfType || out.length >= 6) break;
    if (factionOf(w) === faction) take(w);
  }
  for (const w of ranked) take(w);
  return out;
}

export interface FactionTowerFight {
  team: 1 | 2;
  battle: BattleView;
  win: boolean;
}

export interface FactionTowerClimb {
  state: AccountState;
  faction: TowerFaction;
  floor: number;
  fights: FactionTowerFight[];
  win: boolean;
  rewards: Rewards;
  /** Pokémon from the tower's Powerful Evolve box (a milestone floor). */
  pokemon: string[];
}

function milestoneOf(config: GameConfig, faction: TowerFaction, floor: number): FactionTowerMilestone | undefined {
  return (config.factionTower.milestones as FactionTowerMilestone[]).find((m) => m.faction === faction && m.floor === floor);
}

/** The floor's six (or, from floor 701, twelve) enemies: one curve step per floor, a second six seeded apart. */
export function factionEnemies(config: GameConfig, faction: TowerFaction, floor: number, team: 1 | 2) {
  const curve = resolveCurve(config, config.factionTower.enemy);
  const salt = { water: 1, fire: 2, grass: 3 }[faction] * 7919 + (team - 1) * 104_729;
  return generateEnemies(curve, floor - 1, salt);
}

/** Climb the next floor of an open tower. A loss costs nothing. */
export function climbFactionTower(
  config: GameConfig,
  state: AccountState,
  now: number,
  faction: TowerFaction,
  seed?: number,
): Result<FactionTowerClimb> {
  if (!factionTowerGate(config, state, now)) return fail('resource_locked', 'the Faction Tower opens after story 28-10');
  const rules = factionTowerRules(config);
  const prepared = prepareFactionTower(state, now).state;
  const tower = prepared.factionTower;
  const block = climbBlock(rules, tower, faction, weekdayUtc(now));
  if (block === 'top') return fail('invalid_input', `the ${TOWER_NAME[faction]} Tower is cleared`);
  if (block === 'closed') return fail('resource_locked', `the ${TOWER_NAME[faction]} Tower is closed today`);
  if (block === 'daily_limit') return fail('daily_limit', `no ${TOWER_NAME[faction]} Tower floors left today`);
  const floor = nextFactionFloor(tower, faction);
  const teams = teamsFor(rules, floor);

  const first = factionTeam(config, prepared, faction, 'factionTower');
  const lineups = [first];
  if (teams === 2) lineups.push(factionTeam(config, prepared, faction, 'factionTower2', new Set(first.map((w) => w.id))));
  for (const [i, lineup] of lineups.entries()) {
    const why = lineupBlock(rules, faction, lineup.map((w) => config.species.get(w.speciesId)!.faction));
    if (why) {
      return fail('not_ready', `team ${i + 1} needs at least ${rules.minOfType} ${TOWER_NAME[faction]} Pokémon (Light and Dark may fill the rest)`);
    }
  }

  const base = seed ?? Math.floor(config.rng() * 0xffffffff);
  const fights: FactionTowerFight[] = [];
  for (const [i, lineup] of lineups.entries()) {
    const team = (i + 1) as 1 | 2;
    const battle = runTeams(
      buildWildTeam(lineup, 'attackers', config, prepared),
      buildEnemyTeam(factionEnemies(config, faction, floor, team), config),
      {
        seed: (base + i * 977) >>> 0,
        mode: 'factionTower',
        battleId: `m13:faction:${faction}:${floor}:${team}`,
        strategies: { attackers: prepared.strategies[team === 1 ? 'factionTower' : 'factionTower2'] },
      },
    );
    if (!battle) return fail('not_found', 'no Pokémon available for the Faction Tower');
    const win = battle.winner === 'attackers';
    fights.push({ team, battle, win });
    if (!win) break;
  }
  const win = fights.length === lineups.length && fights.every((f) => f.win);
  if (!win) return ok({ state: prepared, faction, floor, fights, win, rewards: {}, pokemon: [] });

  const milestone = milestoneOf(config, faction, floor);
  const rewards = withBadgeBonus(config, prepared, addRewards(addRewards(factionFloorPay(rules, floor), factionFloorBonus(rules, floor)), milestone?.rewards ?? {}), 'factionCoins', 'factionCoin');
  let next: AccountState = applyGrant(config, { ...prepared, factionTower: clearFactionFloor(tower, faction) }, rewards);
  const pokemon: string[] = [];
  if (milestone && milestone.evolveBox > 0) {
    const rows = config.factionTower.evolveBoxes[faction];
    const total = rows.reduce((s, r) => s + r.weight, 0);
    const rng = mulberry32((base ^ (floor * 2654435761)) >>> 0);
    const draws = [];
    for (let i = 0; i < milestone.evolveBox; i += 1) {
      let x = rng() * total;
      const row = rows.find((r) => (x -= r.weight) < 0) ?? rows[rows.length - 1]!;
      const meta = config.species.get(row.species)!;
      draws.push({ speciesId: row.species, star: row.star, tier: meta.tier, group: 'other' as const });
      pokemon.push(row.species);
    }
    next = grantDraws(next, draws, now).state;
  }
  return ok({ state: next, faction, floor, fights, win, rewards, pokemon });
}

/** Sweep an open tower: its highest floor's pay, no fight. Two free a day (shared), then Diamond buys. */
export function sweepFactionTower(
  config: GameConfig,
  state: AccountState,
  now: number,
  faction: TowerFaction,
): Result<{ state: AccountState; rewards: Rewards; price: number }> {
  if (!factionTowerGate(config, state, now)) return fail('resource_locked', 'the Faction Tower opens after story 28-10');
  const rules = factionTowerRules(config);
  const prepared = prepareFactionTower(state, now).state;
  const tower: FactionTowerState = prepared.factionTower;
  if (!rules.openDays[faction].includes(weekdayUtc(now))) return fail('resource_locked', `the ${TOWER_NAME[faction]} Tower is closed today`);
  if (tower.floors[faction] === 0) return fail('not_ready', `clear a ${TOWER_NAME[faction]} Tower floor first`);
  const price = sweepPrice(rules, tower);
  if (price === null) return fail('daily_limit', 'no sweeps left today');
  if (prepared.currencies.gems < price) return fail('insufficient_items', `a sweep costs ${price} Diamonds`);
  const rewards = withBadgeBonus(config, prepared, factionFloorPay(rules, tower.floors[faction]), 'factionCoins', 'factionCoin');
  const paid = { ...prepared, currencies: { ...prepared.currencies, gems: prepared.currencies.gems - price }, factionTower: spendFactionSweep(rules, tower) };
  return ok({ state: applyGrant(config, paid, rewards), rewards, price });
}
