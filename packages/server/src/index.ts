import type { AccountState, Rewards, Squad, SquadMode, StrategyId } from '@wildbound/engine';
import type { BattleView } from './battle';

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
  | 'daily_limit';

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
export * from './local-server';
