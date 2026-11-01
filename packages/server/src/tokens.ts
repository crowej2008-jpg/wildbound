import type { TokenJson } from '@wildbound/content';
import type { AccountState } from '@wildbound/engine';
import type { GameConfig } from './config';
import { fail, ok, type Result } from './index';

/**
 * R8 Trainer Tokens, copied from the source (packages/content/tuning/tokens.json, scripts/import-tokens.mjs). Six
 * tokens, one per Gods Trials season; five levels each. A level needs that season's Suppression Treasure total
 * (0–60) and spends the token's own fragments (1 / 2 / 2 / 3 / 3). Every effect applies in PvP battles only
 * (Arena and Ranked), each level's lines replacing the last. See ASSUMPTIONS #74.
 */

const LABELS: Record<string, string> = {
  pvpBoost: 'PvP DMG',
  pvpRdct: 'PvP DMG Reduction',
  block: 'Block',
  blockPower: 'Block Strength',
  guardBreak: 'Break Defense',
  sBoost: 'S.ATK DMG BST',
  sRdct: 'S.ATK DMG RDCT',
  crit: 'Crit',
  critPower: 'Crit INT',
  critRes: 'Crit Res',
  pBoost: 'P.ATK DMG BST',
  pRdct: 'P.ATK DMG RDCT',
  controlBoost: 'Control Boost',
  controlRes: 'Control Res',
};

type TokenLevel = TokenJson['levels'][number];

export interface TokenLevelView {
  level: number;
  treasureTotal: number;
  cost: number;
  text: string;
}

export interface TokenView {
  id: number;
  name: string;
  season: number;
  level: number;
  maxLevel: number;
  fragmentName: string;
  fragments: number;
  treasureTotal: number;
  current: string | null;
  next: TokenLevelView | null;
  levels: TokenLevelView[];
  /** Why the next level cannot be taken now. */
  blocked: 'treasure' | 'fragments' | null;
}

function lineText(level: TokenLevel): string {
  return level.lines.map((l) => `${LABELS[l.field] ?? l.field} +${Math.round(l.value * 100)}%`).join(' · ');
}

function levelView(level: TokenLevel): TokenLevelView {
  return { level: level.level, treasureTotal: level.treasureTotal, cost: level.cost, text: lineText(level) };
}

function tokenLevel(state: AccountState, token: TokenJson): number {
  return state.trainerTokens.levels[String(token.id)] ?? 0;
}

function treasureTotal(state: AccountState, token: TokenJson): number {
  return state.trainerTokens.treasureTotals[String(token.season)] ?? 0;
}

export function buildTokensView(config: GameConfig, state: AccountState): TokenView[] {
  return config.tokens.tokens.map((token) => {
    const level = tokenLevel(state, token);
    const next = token.levels.find((l) => l.level === level + 1);
    const fragments = state.trainerTokens.fragments[String(token.id)] ?? 0;
    const total = treasureTotal(state, token);
    const current = token.levels.find((l) => l.level === level);
    return {
      id: token.id,
      name: token.name,
      season: token.season,
      level,
      maxLevel: token.levels.length,
      fragmentName: token.fragmentName,
      fragments,
      treasureTotal: total,
      current: current ? lineText(current) : null,
      next: next ? levelView(next) : null,
      levels: token.levels.map(levelView),
      blocked: !next ? null : total < next.treasureTotal ? 'treasure' : fragments < next.cost ? 'fragments' : null,
    };
  });
}

export function levelTokenAction(config: GameConfig, state: AccountState, tokenId: number): Result<AccountState> {
  const token = config.tokens.tokens.find((t) => t.id === tokenId);
  if (!token) return fail('not_found', `no token ${tokenId}`);
  const level = tokenLevel(state, token);
  const next = token.levels.find((l) => l.level === level + 1);
  if (!next) return fail('at_level_cap', `${token.name} is at its top level`);
  if (treasureTotal(state, token) < next.treasureTotal) {
    return fail('resource_locked', `needs Gods Trials season ${token.season} Suppression Treasure total ${next.treasureTotal}`);
  }
  const key = String(token.id);
  const fragments = state.trainerTokens.fragments[key] ?? 0;
  if (fragments < next.cost) return fail('insufficient_items', `not enough ${token.fragmentName}`);
  const left = { ...state.trainerTokens.fragments, [key]: fragments - next.cost };
  if (left[key] === 0) delete left[key];
  return ok({
    ...state,
    trainerTokens: {
      ...state.trainerTokens,
      levels: { ...state.trainerTokens.levels, [key]: next.level },
      fragments: left,
    },
  });
}

export function grantTokenFragments(state: AccountState, tokenId: number, count: number): AccountState {
  const key = String(tokenId);
  const fragments = { ...state.trainerTokens.fragments, [key]: (state.trainerTokens.fragments[key] ?? 0) + count };
  return { ...state, trainerTokens: { ...state.trainerTokens, fragments } };
}

/** The PvP-only sheet lines from every token's current level (each level's lines replace the last). */
export function tokenPvpLines(config: GameConfig, state: AccountState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const token of config.tokens.tokens) {
    const current = token.levels.find((l) => l.level === tokenLevel(state, token));
    for (const line of current?.lines ?? []) out[line.field] = (out[line.field] ?? 0) + line.value;
  }
  return out;
}
