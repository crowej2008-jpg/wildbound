import type { AccountState, Squad, SquadMode, StrategyId } from '@wildbound/engine';

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
  | 'invalid_squad';

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
export * from './local-server';
