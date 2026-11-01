import type {
  AccountState,
  DrawResult,
  MachineId,
  Rewards,
  Squad,
  SquadMode,
  StrategyId,
  SummonCost,
  SkillRow,
  TitleSlot, OrbColour } from '@wildbound/engine';
import type { BattleView } from './battle';
import type { GachaView } from './gacha';
import type { ShopView } from './shops';
import type { OriginSkillsView } from './shards';
import type { PotentialView } from './potential';
import type { OrbsPanelView } from './orbs';
import type { BerriesPanelView } from './berries';
import type { EquipmentView } from './equipment-view';
import type { DungeonCardView, TowerView, TrialCardView, WorldBossView } from './pve-view';
import type { ExploreView } from './explore-view';
import type { PetHomeView } from './pet-home-view';
import type { SkyPillarView } from './sky-pillar-view';
import type { ArenaRankingsView, ArenaView } from './pvp-view';
import type { RankedView } from './pvp-ranked-view';
import type { PvpHubView } from './pvp-hub-view';
import type { ResonanceView } from './resonance';
import type { VipView } from './vip';
import type { TokenView } from './tokens';
import type { SignInView } from './signin';
import type { TitlesView } from './titles';

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
  | 'outdated_save'
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
  /** Display-ready Resonance (R7: top six, crystal, slots). */
  resonance: ResonanceView;
  /** Display-ready VIP tier, perks and daily claim state (M11.10). */
  vip: VipView;
  /** R8 Trainer Tokens. */
  tokens: TokenView[];
  /** Display-ready title slots, catalogue and ticket balance (M11.11). */
  titles: TitlesView;
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

/** Victory Road gym gate outcome (M13.0a). */
export interface GymBattleResult {
  battle: BattleView;
  gymId: string;
  win: boolean;
  /** True the first time the gym falls (the only time `rewards` is paid). */
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

/** A Sky Pillar stage (M13.2): graded stars and the first-clear payout. */
export interface SkyPillarBattleResult {
  battle: BattleView;
  floor: number;
  stage: number;
  win: boolean;
  stars: number;
  bestStars: number;
  firstClear: boolean;
  rewards: Rewards;
  snapshot: AccountSnapshot;
}

/** A Sky Pillar sweep (M13.2): the highest 3-star record's half payout. */
export interface SkyPillarSweepResult {
  floor: number;
  stage: number;
  granted: Rewards;
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
  /** Debug (R6b): grant a trinket holder's own levelling item. */
  grantTrinketItem(speciesId: string, amount: number): Promise<Result<AccountSnapshot>>;
  /** Debug (R8): grant a title's own activation cards. */
  grantTitleCards(titleId: string, amount: number): Promise<Result<AccountSnapshot>>;
  levelUp(instanceId: string, levels: number): Promise<Result<AccountSnapshot>>;
  /** R1: the source's Evolve — one star up, consuming the star card's fodder (auto-picked). */
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
  /** Fight a Victory Road gym gate with the campaign squad (M13.0a). */
  challengeGym(gymId: string, seed?: number): Promise<Result<GymBattleResult>>;
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
  /** R3: a Pokémon's orb sockets, active sets and the orb bag. */
  getOrbs(wildId: string): Promise<Result<OrbsPanelView>>;
  /** R3: socket (or clear, with `null`) an orb; `force` moves one socketed elsewhere. */
  equipOrb(wildId: string, socket: number, orbId: string | null, force?: boolean): Promise<Result<AccountSnapshot>>;
  /** R3: raise an orb one level (two free copies + Gold); `quick` fuses lower copies first. */
  levelOrb(orbId: string, quick?: boolean): Promise<Result<AccountSnapshot>>;
  /** R3: lock / unlock an orb (locked orbs are never fed or dismantled). */
  lockOrb(orbId: string): Promise<Result<AccountSnapshot>>;
  /** R3: dismantle orbs for Orb Essence (red cannot be dismantled). */
  dismantleOrbs(orbIds: string[]): Promise<Result<AccountSnapshot>>;
  /** R3 debug: add a rolled orb. */
  grantOrb(kind: string, colour: OrbColour, level?: number): Promise<Result<AccountSnapshot>>;
  equipCore(wildId: string, socket: number, instanceId: string | null, force?: boolean): Promise<Result<AccountSnapshot>>;
  starUpCore(instanceId: string): Promise<Result<AccountSnapshot>>;
  /** R6d: a Pokémon's berry panel (two slots, the account's berries, prices). */
  getBerries(wildId: string): Promise<Result<BerriesPanelView>>;
  equipBerry(wildId: string, slot: number, berryId: string | null): Promise<Result<AccountSnapshot>>;
  /** 100 Berry Essence a time; `times` up to 10 (Fast Cultivation). */
  cultivateBerry(berryId: string, times?: number): Promise<Result<AccountSnapshot>>;
  breakthroughBerry(berryId: string): Promise<Result<AccountSnapshot>>;
  /** Re-roll one line's kind for Reforge Potions (10 / 20 / 35 / 35 / 35 by position). */
  reforgeBerry(berryId: string, line: number): Promise<Result<AccountSnapshot>>;
  /** Elevation: the next star, paid with spare 1★ uncultivated berries and Gold. */
  elevateBerry(berryId: string): Promise<Result<AccountSnapshot>>;
  /** 100 Diamonds: the berry back to its start, everything spent on it returned (owner). */
  rebirthBerry(berryId: string): Promise<Result<AccountSnapshot>>;
  lockBerry(berryId: string, locked: boolean): Promise<Result<AccountSnapshot>>;
  dismantleBerries(berryIds: string[]): Promise<Result<AccountSnapshot>>;
  /** Debug: add a new berry. */
  grantBerry(defId: string): Promise<Result<AccountSnapshot>>;
  /** E4: spend a species' own shards on a new copy of it. */
  composeWild(speciesId: string): Promise<Result<AccountSnapshot>>;
  /** R4: a Pokémon's Potential panel (nine tiers, costs, fodder). */
  getPotential(wildId: string): Promise<Result<PotentialView>>;
  /** R4: unlock a Potential tier with one of its three options (pays fodder + Potential Shards). */
  unlockPotential(wildId: string, tier: number, option: number): Promise<Result<AccountSnapshot>>;
  /** R4: raise an unlocked Potential option one level (Potential Shards). */
  levelPotential(wildId: string, tier: number): Promise<Result<AccountSnapshot>>;
  /** R4: reset all of a Pokémon's Potential for Diamonds; everything paid comes back. */
  resetPotential(wildId: string): Promise<Result<AccountSnapshot>>;
  /** E4: raise one of an Origin's skill rows (ult / basic / passive / talent4) with its own shards. */
  upgradeOriginSkill(wildId: string, row: SkillRow): Promise<Result<AccountSnapshot>>;
  /** E4: an Origin's skill levels, texts and prices (null for ordinary Pokémon). */
  getOriginSkills(wildId: string): Promise<Result<OriginSkillsView | null>>;
  /** Raise a held item one level (R5: source shard table, resonance gates, cap 200). */
  levelRelic(instanceId: string): Promise<Result<AccountSnapshot>>;
  /** Roll a new line into one slot of a worn held item; keep or drop it with `settleRefine` (R5). */
  refineRelic(instanceId: string, slot: number, seed?: number): Promise<Result<AccountSnapshot>>;
  settleRefine(instanceId: string, keep: boolean): Promise<Result<AccountSnapshot>>;
  /** Toggle a held item's lock (a locked item can't be dismantled) (R5). */
  lockRelic(instanceId: string): Promise<Result<AccountSnapshot>>;
  /** Break unworn, unlocked held items into Held Item Shards (R5). */
  dismantleRelics(instanceIds: string[]): Promise<Result<AccountSnapshot>>;
  /** Turn Resetter Shards into Held Item Resetters, 20 → 1 (R5). */
  compoundResetters(count: number): Promise<Result<AccountSnapshot>>;
  /** Raise a Wild's element-keyed plate by one stage (M11.7). */
  upgradePlate(wildId: string): Promise<Result<AccountSnapshot>>;
  /** Raise the Wild's species-signature trinket by one level (M11.8). */
  upgradeTrinket(wildId: string): Promise<Result<AccountSnapshot>>;
  /** R7: open the next resonance slot (Resonation Shards, or Diamonds when short). */
  buyResonanceSlot(): Promise<Result<AccountSnapshot>>;
  /** R7: put a Pokémon in an open slot, or take it out with `null` (the slot then cools down 24 hours). */
  setResonanceSlot(slot: number, wildId: string | null): Promise<Result<AccountSnapshot>>;
  /** R7: clear a slot's cooldown (4 Diamonds per hour left). */
  clearResonanceCooldown(slot: number): Promise<Result<AccountSnapshot>>;
  /** R7: evolve the crystal once the top six reach Lv 340 (free; six more slots). */
  evolveResonance(): Promise<Result<AccountSnapshot>>;
  /** R7: raise the evolved crystal one level. */
  upgradeResonance(): Promise<Result<AccountSnapshot>>;
  /** R9: the Sign In calendar. */
  getSignIn(): Promise<Result<SignInView>>;
  /** R9: sign today's day. */
  signIn(): Promise<Result<ClaimResult>>;
  /** R9: sign a missed day for Diamonds. */
  patchSignIn(day: number): Promise<Result<ClaimResult>>;
  /** R9: take a signed day's VIP double after the VIP level rises. */
  doubleSignIn(day: number): Promise<Result<ClaimResult>>;
  /** R9: claim a signed-day bonus. */
  claimSignInMilestone(index: number): Promise<Result<ClaimResult>>;
  /** R8: raise a Trainer Token one level (its season's Suppression Treasure total and its own fragments). */
  levelToken(tokenId: number): Promise<Result<AccountSnapshot>>;
  /** Debug (R8): grant a Trainer Token's own fragments. */
  grantTokenFragments(tokenId: number, amount: number): Promise<Result<AccountSnapshot>>;
  /** Activate, upgrade or continue a title with its own activation cards (R8). */
  activateTitle(titleId: string): Promise<Result<AccountSnapshot>>;
  /** Equip an owned title in its slot, or clear it with `null` (M11.11). */
  setTitleSlot(slot: TitleSlot, titleId: string | null): Promise<Result<AccountSnapshot>>;
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
  /** Display-ready Arena state: credits, rank, attempts, chests, opponents (M10). */
  getArena(): Promise<Result<ArenaView>>;
  /** Display-ready PvP hub: one card per entry point with its live status (M10.5). */
  getPvpHub(): Promise<Result<PvpHubView>>;
  /** Display-ready Explore hub: eight mode shells, gates and resets (M13.0b). */
  getExplore(): Promise<Result<ExploreView>>;
  /** Display-ready Pet Home board, levels, album and shops (M13.1). */
  getPetHome(): Promise<Result<PetHomeView>>;
  /** Summon an unopened ball onto an active tile. */
  summonPet(tileId?: number, seed?: number): Promise<Result<AccountSnapshot>>;
  /** Open one unopened ball, revealing its Wild and granting Home XP. */
  openPet(petId: string): Promise<Result<AccountSnapshot>>;
  /** Merge two opened Wilds of the same level into one level-up. */
  mergePets(sourceId: string, targetId: string): Promise<Result<AccountSnapshot>>;
  /** Release a ball or opened Wild from the board. */
  releasePet(petId: string): Promise<Result<AccountSnapshot>>;
  /** Spend gems to open a revealed, padlocked tile. */
  unlockPetTile(tileId: number): Promise<Result<AccountSnapshot>>;
  /** Claim a reached Home level's one-time reward. */
  claimPetHomeLevel(level: number): Promise<Result<ClaimResult>>;
  /** Buy one offer from the Home Exchange or Orb Atelier. */
  buyPetHomeShopOffer(shopId: 'home' | 'deluxe', offerId: string): Promise<Result<ClaimResult>>;
  /** Spend gems for a fresh nine-offer shop page. */
  refreshPetHomeShop(shopId: 'home' | 'deluxe'): Promise<Result<AccountSnapshot>>;
  /** Display-ready Sky Pillar: proofs, all floors and the selected floor (M13.2). */
  getSkyPillar(floor?: number): Promise<Result<SkyPillarView>>;
  /** Challenge a Sky Pillar stage; a first clear spends one Proof of Sky. */
  challengeSkyPillar(floor: number, stage: number, seed?: number): Promise<Result<SkyPillarBattleResult>>;
  /** Sweep the highest 3-star stage for its half payout (one proof). */
  sweepSkyPillar(): Promise<Result<SkyPillarSweepResult>>;
  /** Claim a reached 10/20/30-star floor chest once. */
  claimSkyPillarChest(floor: number, stars: number): Promise<Result<ClaimResult>>;
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
export * from './growth';
export * from './shards';
export * from './potential';
export * from './orbs';
export * from './pve';
export * from './pve-view';
export * from './pvp';
export * from './pvp-view';
export * from './pvp-ranked-view';
export * from './pvp-hub-view';
export * from './explore-view';
export * from './pet-home';
export * from './pet-home-view';
export * from './sky-pillar';
export * from './sky-pillar-view';
export * from './plates';
export * from './trinkets';
export * from './berries';
export * from './vip';
export * from './titles';
export * from './tokens';
export * from './signin';
export * from './local-server';
