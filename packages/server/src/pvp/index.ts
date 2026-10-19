/**
 * PvP mode actions (M10, PROMPT §7.7). Pure `AccountState` transitions that build
 * a battle, move credits/rank and claim rewards; the LocalServer wraps them with
 * `commit`. See docs/design/pvp.md.
 */
export * from './shared';
export * from './arena';
export * from './ranked';
