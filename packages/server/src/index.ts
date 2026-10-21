import type {
  AccountState,
  DrawResult,
  MachineId,
  Rewards,
  Squad,
  SquadMode,
  StrategyId,
  SummonCost,
} from '@wildbound/engine';
import type { BattleView } from './battle';
import type { GachaView } from './gacha';
import type { ShopView } from './shops';
import type { EquipmentView } from './equipment-view';
import type { DungeonCardView, LinkCrystalView, TowerView, TrialCardView, WorldBossView } from './pve-view';
import type { ArenaRankingsView, ArenaView } from './pvp-view';
import type { RankedView } from './pvp-ranked-view';
import type { PvpHubView } from './pvp-hub-view';

/**
 * The server boundary (PROMPT.md §10).
 *
 * The React client calls only the `GameServer` interface — never the engine and
 * never a database directly. `LocalServer` implements it in-browser on top of
 * the engine + IndexedDB; a later `HttpServer` is a drop-in replacement.
 */
export const GAME = 'wildbound' as const;

export interface ServerInfo {
  game: typeof GAME;
  protocol: 1;
}

/** Typed error codes. Extend as actions are added. */
export type ServerError =
  | 'not_implemented'
  | 'insufficient_items'
  | 'at_level_cap'
  | 'resource_locked'
  | 'invalid_input'
  | 'corrupt_save'
  | 'not_found'
  | 'evolution_blocked'
  | 'invalid_squad'
  | 'stage_locked'
  | 'not_ready'
  | 'daily_limit'
  | 'in_use';

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: ServerError; message: string };

/** What every action returns: the authoritative state + display-ready derived values. */
export interface AccountSnapshot {
  state: AccountState;
  /** Per-instance Power, keyed by WildInstance id. */
  power: Record<string, number>;
  /** Summed Power per squad mode. */
  teamPower: Record<SquadMode, number>;
}

/** Campaign battle outcome (M5). Carries the reward granted and the new snapshot. */
export interface StageBattleResult {
  battle: BattleView;
  stageId: string;
  win: boolean;
  /** 0 on a loss, else 1–3. */
  stars: number;
  firstClear: boolean;
  rewards: Rewards;
  snapshot: AccountSnapshot;
}

/** Any claim that grants rewards and returns fresh state (M5). */
export interface ClaimResult {
  granted: Rewards;
  snapshot: AccountSnapshot;
}

/** The outcome of a summon batch (M6): what was spent and what was drawn. */
export interface SummonResult {
  machine: MachineId;
  count: number;
  draws: DrawResult[];
  cost: SummonCost;
  snapshot: AccountSnapshot;
}

/** A tower climb (M8). */
export interface TowerBattleResult {
  battle: BattleView;
  floor: number;
  win: boolean;
  rewards: Rewards;
  snapshot: AccountSnapshot;
}

/** A trial clear (M8). */
export interface TrialBattleResult {
  battle: BattleView;
  trialId: string;
  win: boolean;
  /** True when this clear paid out (the first clear of the UTC day). */
  firstToday: boolean;
  rewards: Rewards;
  snapshot: AccountSnapshot;
}

/** A daily-dungeon clear (M8). */
export interface DungeonBattleResult {
  battle: BattleView;
  dungeonId: string;
  win: boolean;
  firstToday: boolean;
  rewards: Rewards;
  snapshot: AccountSnapshot;
}

/** A world-boss fight (M8): damage scored, rank against the ghost ladder. */
export interface WorldBossBattleResult {
  battle: BattleView;
  speciesId: string;
  name: string;
  damage: number;
  bestDamage: number;
  rank: number;
  ghosts: number[];
  attemptsLeft: number;
  snapshot: AccountSnapshot;
}

/** An Arena fight (M10): credits move, the place updates, chests progress. */
export interface ArenaBattleResult {
  battle: BattleView;
  opponentIndex: number;
  win: boolean;
  creditsBefore: number;
  creditsAfter: number;
  place: number;
  attemptsLeft: number;
  snapshot: AccountSnapshot;
}

/** Bought Arena attempts (M10): what the day's prices cost in gems. */
export interface ArenaBuyResult {
  bought: number;
  spent: number;
  attemptsLeft: number;
  snapshot: AccountSnapshot;
}

/** A Ranked series (M10.3): the games played, the ladder move and the promotion. */
export interface RankedMatchResult {
  /** The games of the series, in order; the client replays one at a time. */
  battles: BattleView[];
  win: boolean;
  wins: number;
  losses: number;
  scoreBefore: number;
  scoreAfter: number;
  tierBefore: number;
  tierAfter: number;
  promoted: boolean;
  attemptsLeft: number;
  matches: number;
  snapshot: AccountSnapshot;
}

/** Bought Ranked attempts (M10.3): what the day's prices cost in gems. */
export interface RankedBuyResult {
  bought: number;
  spent: number;
  attemptsLeft: number;
  snapshot: AccountSnapshot;
}

export interface GameServer {
  ping(): Promise<Result<ServerInfo>>;
  loadAccount(): Promise<Result<AccountSnapshot>>;
  grantWild(speciesId: string): Promise<Result<AccountSnapshot>>;
  grantRandomWild(): Promise<Result<AccountSnapshot>>;
  grantCurrency(currency: string, amount?: number): Promise<Result<AccountSnapshot>>;
  levelUp(instanceId: string, levels: number): Promise<Result<AccountSnapshot>>;
  starUp(instanceId: string, stars: number): Promise<Result<AccountSnapshot>>;
  evolve(instanceId: string): Promise<Result<AccountSnapshot>>;
  respawn(instanceId: string): Promise<Result<AccountSnapshot>>;
  toggleLock(instanceId: string): Promise<Result<AccountSnapshot>>;
  saveSquad(mode: SquadMode, slots: Squad, strategy: StrategyId): Promise<Result<AccountSnapshot>>;
  autoFormation(mode: SquadMode): Promise<Result<AccountSnapshot>>;
  setStrategy(mode: SquadMode, strategy: StrategyId): Promise<Result<AccountSnapshot>>;
  exportSave(): Promise<Result<string>>;
  importSave(json: string): Promise<Result<AccountSnapshot>>;
  resetAccount(): Promise<Result<AccountSnapshot>>;
  /** Simulate a battle for a squad mode and return an immutable replay log (M4). */
  startBattle(mode: SquadMode, seed?: number): Promise<Result<BattleView>>;
  /** Fight a campaign stage with the campaign squad (M5). */
  challengeStage(stageId: string, seed?: number): Promise<Result<StageBattleResult>>;
  /** Re-grant a cleared stage's repeat reward without a battle (M5). */
  sweepStage(stageId: string): Promise<Result<ClaimResult>>;
  /** Collect accrued idle income; `quick` pays gems for a fixed slice (M5). */
  claimIdle(quick?: boolean): Promise<Result<ClaimResult>>;
  /** Claim a completed daily quest (M5). */
  claimQuest(questId: string): Promise<Result<ClaimResult>>;
  /** Claim an activity chest by its index in the economy table (M5). */
  claimActivityChest(index: number): Promise<Result<ClaimResult>>;
  /** Claim one mail letter's attachments (M5). */
  claimMail(id: string): Promise<Result<ClaimResult>>;
  /** Claim every unclaimed letter at once (M5). */
  claimAllMail(): Promise<Result<ClaimResult>>;
  /** Advance the first-session tutorial by one step (M5). */
  advanceTutorial(): Promise<Result<AccountSnapshot>>;
  /** Skip the tutorial entirely (M5). */
  skipTutorial(): Promise<Result<AccountSnapshot>>;
  /** Debug: fast-forward the game clock by minutes (M5). */
  debugAdvanceClock(minutes: number): Promise<Result<AccountSnapshot>>;
  /** Draw `count` (1 or 10) from a machine; `seed` pins the outcome (M6). */
  summon(machine: MachineId, count: number, seed?: number): Promise<Result<SummonResult>>;
  /** Spend a machine's box credits and grant its box reward (M6). */
  claimGachaBox(machine: MachineId): Promise<Result<ClaimResult>>;
  /** Set or clear the Premium machine's featured target (M6). */
  setWish(speciesId: string | null): Promise<Result<AccountSnapshot>>;
  /** Display-ready summoning state: free draws, credits, pity, rates (M6). */
  getGacha(): Promise<Result<GachaView>>;
  /** Buy one item from a shop, restocking first if the window has rolled (M6). */
  buyShopItem(shopId: string, itemId: string): Promise<Result<ClaimResult>>;
  /** Pay a manual shop's refresh cost to reset its stock (M6). */
  refreshShop(shopId: string): Promise<Result<ClaimResult>>;
  /** Display-ready shop state: stock left, affordability, next restock (M6). */
  getShops(): Promise<Result<ShopView[]>>;
  /** Display-ready equipment view for one Wild: owned items, gates, deltas (M7). */
  getEquipment(wildId: string): Promise<Result<EquipmentView>>;
  /** Equip (or clear, with `null`) a relic; `force` moves one worn elsewhere (M7). */
  equipRelic(wildId: string, instanceId: string | null, force?: boolean): Promise<Result<AccountSnapshot>>;
  equipRune(wildId: string, socket: number, instanceId: string | null, force?: boolean): Promise<Result<AccountSnapshot>>;
  equipCore(wildId: string, socket: number, instanceId: string | null, force?: boolean): Promise<Result<AccountSnapshot>>;
  starUpCore(instanceId: string): Promise<Result<AccountSnapshot>>;
  equipCharm(wildId: string, slot: number, charmId: string | null): Promise<Result<AccountSnapshot>>;
  /** Spend duplicate copies + Berry Essence to raise a Berry's star level (M11.5). */
  upgradeCharm(charmId: string): Promise<Result<AccountSnapshot>>;
  /** Break one spare Berry copy into Berry Essence (M11.5). */
  dismantleCharm(charmId: string): Promise<Result<AccountSnapshot>>;
  /** Level or refine a relic (M7). */
  levelRelic(instanceId: string): Promise<Result<AccountSnapshot>>;
  refineRelic(instanceId: string): Promise<Result<AccountSnapshot>>;
  /** Raise a Wild's element-keyed plate by one stage (M11.7). */
  upgradePlate(wildId: string): Promise<Result<AccountSnapshot>>;
  /** Raise the Wild's species-signature trinket by one level (M11.8). */
  upgradeTrinket(wildId: string): Promise<Result<AccountSnapshot>>;
  /** Level a rune (M7). */
  levelRune(instanceId: string, useEssence?: boolean): Promise<Result<AccountSnapshot>>;
  /** Pick (or clear, with `null`) a talent path (M7). */
  chooseTalentTree(wildId: string, treeId: string | null): Promise<Result<AccountSnapshot>>;
  /** Allocate one talent option on a tier (M7). */
  allocateTalent(wildId: string, tier: number, option: number): Promise<Result<AccountSnapshot>>;
  /** Reset a Wild's talents for gems (gold is refunded) (M7). */
  resetTalents(wildId: string): Promise<Result<AccountSnapshot>>;
  /** Display-ready tower state: floor, weekly climbs, daily sweeps, milestones (M8). */
  getTower(): Promise<Result<TowerView>>;
  /** Climb the next tower floor with the tower squad (M8). */
  challengeTower(seed?: number): Promise<Result<TowerBattleResult>>;
  /** Re-play the highest cleared tower floor for its reward, up to the daily cap (M8). */
  sweepTower(): Promise<Result<ClaimResult>>;
  /** Display-ready trial cards: open/closed, cleared today, preview (M8). */
  getTrials(): Promise<Result<TrialCardView[]>>;
  /** Fight a trial with the campaign squad under its rule (M8). */
  challengeTrial(trialId: string, seed?: number): Promise<Result<TrialBattleResult>>;
  /** Display-ready world-boss state: today's boss, attempts, milestones, rank (M8). */
  getWorldBoss(): Promise<Result<WorldBossView>>;
  /** Fight today's world boss and score damage against the ghost ladder (M8). */
  challengeWorldBoss(seed?: number): Promise<Result<WorldBossBattleResult>>;
  /** Claim a reached, unclaimed world-boss damage milestone (M8). */
  claimWorldBossMilestone(index: number): Promise<Result<ClaimResult>>;
  /** Display-ready daily-dungeon cards, with today's open one (M8). */
  getDungeons(): Promise<Result<DungeonCardView[]>>;
  /** Fight today's daily dungeon with the campaign squad (M8). */
  challengeDungeon(dungeonId: string, seed?: number): Promise<Result<DungeonBattleResult>>;
  /** Display-ready Link Crystal state: level, cap, cost, eligibility (M8). */
  getLinkCrystal(): Promise<Result<LinkCrystalView>>;
  /** Spend candy/gold/stones to raise the Link Crystal one level (M8). */
  upgradeLinkCrystal(): Promise<Result<AccountSnapshot>>;
  /** Display-ready Arena state: credits, rank, attempts, chests, opponents (M10). */
  getArena(): Promise<Result<ArenaView>>;
  /** Display-ready PvP hub: one card per entry point with its live status (M10.5). */
  getPvpHub(): Promise<Result<PvpHubView>>;
  /** Re-roll the day's three matched Arena opponents (M10). */
  refreshArena(): Promise<Result<AccountSnapshot>>;
  /** Fight one of the day's three matched Arena opponents (M10). */
  challengeArena(opponentIndex: number, seed?: number): Promise<Result<ArenaBattleResult>>;
  /** Spend gems for extra Arena attempts at the day's prices (M10). */
  buyArenaAttempts(count: number): Promise<Result<ArenaBuyResult>>;
  /** Claim a reached, unclaimed Arena participation chest (M10). */
  claimArenaChest(index: number): Promise<Result<ClaimResult>>;
  /** Claim a reached, unclaimed Arena best-rank achievement (M10). */
  claimArenaAchievement(index: number): Promise<Result<ClaimResult>>;
  /** Save the Arena defence lineup + strategy (M10). */
  setArenaDefence(slots: Squad, strategy: StrategyId): Promise<Result<AccountSnapshot>>;
  /** Display-ready Arena ranking board: the player's place vs ghost places (M10). */
  getArenaRankings(): Promise<Result<ArenaRankingsView>>;
  /** Display-ready Ranked ladder: region, tier, weather, attempts, gifts (M10.3). */
  getRanked(): Promise<Result<RankedView>>;
  /** Play a Ranked series against the region's rivals (M10.3). */
  startRankedMatch(seed?: number): Promise<Result<RankedMatchResult>>;
  /** Spend gems for extra Ranked attempts at the day's prices (M10.3). */
  buyRankedAttempts(count: number): Promise<Result<RankedBuyResult>>;
  /** Claim a reached, unclaimed Ranked tier's region coins (M10.3). */
  claimRankedTier(index: number): Promise<Result<ClaimResult>>;
  /** Claim a reached, unclaimed Ranked challenge-gift step (M10.3). */
  claimRankedGift(index: number): Promise<Result<ClaimResult>>;
}

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T>(error: ServerError, message: string): Result<T> {
  return { ok: false, error, message };
}

export * from './config';
export * from './save';
export * from './storage';
export * from './battle';
export * from './economy';
export * from './outcome';
export * from './gacha';
export * from './shops';
export * from './equipment';
export * from './equipment-view';
export * from './pve';
export * from './pve-view';
export * from './pvp';
export * from './pvp-view';
export * from './pvp-ranked-view';
export * from './pvp-hub-view';
export * from './plates';
export * from './trinkets';
export * from './local-server';
