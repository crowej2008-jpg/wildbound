import type { ServerError } from './index';

/**
 * A pure server-glue outcome (M6). Mirrors the `Result` shape the `GameServer`
 * boundary uses, but is produced without touching the store so the M6 rules stay
 * testable in isolation. `local-server.ts` turns these into committed `Result`s.
 */
export type Outcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: ServerError; message: string };
