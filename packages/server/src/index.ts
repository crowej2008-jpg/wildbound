/**
 * The server boundary (PROMPT.md §10).
 *
 * The React client calls only the `GameServer` interface — never the engine and
 * never a database directly. `LocalServer` implements it in-browser on top of
 * the engine + IndexedDB; a later `HttpServer` is a drop-in replacement.
 *
 * Method signatures are added one per action as their milestones (M3+) land:
 * claimIdle, levelUp, summon, startBattle, saveSquad, arenaRefresh,
 * buyShopItem, and so on. `ping` gives the seam a minimal contract today.
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
  | 'corrupt_save';

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: ServerError; message: string };

export interface GameServer {
  ping(): Promise<Result<ServerInfo>>;
}

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T>(error: ServerError, message: string): Result<T> {
  return { ok: false, error, message };
}