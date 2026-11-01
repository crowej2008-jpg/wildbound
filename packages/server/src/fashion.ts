import { FASHION_LADDERS, FASHION_SLOTS, type FashionLadder, type FashionPieceJson, type FashionSlot } from '@wildbound/content';
import type { AccountState, CurrencyId, StatLine } from '@wildbound/engine';
import type { GameConfig } from './config';
import { fail, ok, type Result } from './index';

/**
 * R8 Mount / Back Decor / Follower / Outfits (packages/content/tuning/fashion.json). The pieces and the 35 sets are
 * the source's; the shared level curve 0–200 and every piece's stats are made up (owner, 2026-11-01). Mount, Back
 * Decor and Follower each climb the same ladder with their own stone (10 stones per 100 exp, the client's price);
 * every owned piece adds its own bonus by star (1★–15★, its own shards); a set adds its 2 / 3 / 5-piece bonus,
 * its title counting as the fifth piece. All of it applies to every Pokémon. See ASSUMPTIONS #77.
 */

const STONE: Record<FashionLadder, CurrencyId> = {
  mount: 'mountStone',
  backDecor: 'backDecorStone',
  follower: 'followerStone',
};

export function pieceKey(slot: FashionSlot, index: number): string {
  return `${slot}:${index}`;
}

function pieceStar(state: AccountState, piece: FashionPieceJson): number {
  return piece.free ? 0 : state.fashion.stars[pieceKey(piece.slot, piece.index)] ?? 0;
}

function owned(state: AccountState, piece: FashionPieceJson): boolean {
  return piece.free || pieceStar(state, piece) > 0;
}

function ladderLevel(state: AccountState, ladder: FashionLadder): { level: number; exp: number } {
  return state.fashion.levels[ladder] ?? { level: 0, exp: 0 };
}

/** Stones to finish the current level (the client's ceil(remaining exp / 100) × 10). */
function levelCost(config: GameConfig, level: number, exp: number): number {
  const need = config.fashion.ladder[level]?.exp ?? 0;
  return need === 0 ? 0 : Math.ceil(Math.max(0, need - exp) / 100) * 10;
}

function pieceBonus(piece: FashionPieceJson, star: number): { hp: number; atk: number; pct: number } {
  const s = piece.shape;
  if (!s || star <= 0) return { hp: 0, atk: 0, pct: 0 };
  const n = star - 1;
  return { hp: s.hp + s.hpStep * n, atk: s.atk + s.atkStep * n, pct: s.pct + s.pctStep * n };
}

const flat = (field: string, value: number): StatLine => ({ kind: 'core', field, base: value, perLevel: 0 });
const pct = (field: string, value: number): StatLine => ({ kind: 'percent', field, base: value, perLevel: 0 });

function setCounts(config: GameConfig, state: AccountState, titleOwned: (id: string) => boolean) {
  return config.fashion.sets.map((set) => {
    let count = titleOwned(set.title) ? 1 : 0;
    for (const p of set.pieces) {
      const piece = config.fashion.pieces.find((x) => x.slot === p.slot && x.index === p.index);
      if (piece && owned(state, piece)) count += 1;
    }
    const bonus = [...set.bonuses].reverse().find((b) => count >= b.pieces) ?? null;
    return { set, count, bonus };
  });
}

/** Every account-wide line Mount / Back Decor / Follower / Outfits give (added to every Pokémon). */
export function fashionLines(config: GameConfig, state: AccountState, titleOwned: (id: string) => boolean): StatLine[] {
  const lines: StatLine[] = [];
  for (const ladder of FASHION_LADDERS) {
    const row = config.fashion.ladder[ladderLevel(state, ladder).level];
    if (!row || row.level === 0) continue;
    lines.push(flat('hp', row.hp), flat('pAtk', row.atk), flat('sAtk', row.atk));
    lines.push(pct('hpPct', row.pct), pct('pAtkPct', row.pct), pct('sAtkPct', row.pct));
  }
  for (const piece of config.fashion.pieces) {
    const b = pieceBonus(piece, pieceStar(state, piece));
    if (b.hp === 0 && b.atk === 0) continue;
    lines.push(flat('hp', b.hp), flat('pAtk', b.atk), flat('sAtk', b.atk));
    if (b.pct > 0) {
      if (piece.shape?.pctStat === 'hpPct') lines.push(pct('hpPct', b.pct));
      else lines.push(pct('pAtkPct', b.pct), pct('sAtkPct', b.pct));
    }
  }
  for (const { bonus } of setCounts(config, state, titleOwned)) {
    for (const l of bonus?.lines ?? []) lines.push(l.field.endsWith('Pct') ? pct(l.field, l.value) : flat(l.field, l.value));
  }
  return lines;
}

export interface FashionLadderView {
  slot: FashionLadder;
  level: number;
  tier: number;
  star: number;
  exp: number;
  expNeed: number;
  cost: number;
  stones: number;
  current: { hp: number; atk: number; pct: number };
  next: { hp: number; atk: number; pct: number } | null;
}

export interface FashionPieceView {
  slot: FashionSlot;
  index: number;
  name: string;
  free: boolean;
  owned: boolean;
  star: number;
  worn: boolean;
  shards: number;
  /** Shards the next step costs (activate = 1, then star + 1), null at 15★ or for a free piece. */
  nextCost: number | null;
  bonus: { hp: number; atk: number; pct: number; pctStat: 'hpPct' | 'atkPct' | null };
}

export interface FashionView {
  ladders: FashionLadderView[];
  pieces: FashionPieceView[];
  sets: { id: number; name: string; count: number; pieces: number[]; reached: number | null }[];
}

export function buildFashionView(config: GameConfig, state: AccountState, titleOwned: (id: string) => boolean): FashionView {
  const ladders = FASHION_LADDERS.map((slot): FashionLadderView => {
    const { level, exp } = ladderLevel(state, slot);
    const row = config.fashion.ladder[level]!;
    const next = config.fashion.ladder[level + 1];
    return {
      slot,
      level,
      tier: row.tier,
      star: row.star,
      exp,
      expNeed: row.exp,
      cost: levelCost(config, level, exp),
      stones: state.currencies[STONE[slot]] ?? 0,
      current: { hp: row.hp, atk: row.atk, pct: row.pct },
      next: next ? { hp: next.hp, atk: next.atk, pct: next.pct } : null,
    };
  });
  const pieces = config.fashion.pieces.map((piece): FashionPieceView => {
    const star = pieceStar(state, piece);
    const key = pieceKey(piece.slot, piece.index);
    return {
      slot: piece.slot,
      index: piece.index,
      name: piece.name,
      free: piece.free,
      owned: owned(state, piece),
      star,
      worn: wornIndex(config, state, piece.slot) === piece.index,
      shards: state.fashion.shards[key] ?? 0,
      nextCost: piece.free || star >= config.fashion.maxStar ? null : star === 0 ? 1 : star + 1,
      bonus: { ...pieceBonus(piece, Math.max(1, star)), pctStat: piece.shape?.pctStat ?? null },
    };
  });
  const sets = setCounts(config, state, titleOwned).map(({ set, count, bonus }) => ({
    id: set.id,
    name: set.name,
    count,
    pieces: set.bonuses.map((b) => b.pieces),
    reached: bonus?.pieces ?? null,
  }));
  return { ladders, pieces, sets };
}

function wornIndex(config: GameConfig, state: AccountState, slot: FashionSlot): number {
  return state.fashion.worn[slot] ?? config.fashion.pieces.find((p) => p.slot === slot && p.free)?.index ?? 0;
}

/** Spend stones to raise a ladder up to `levels` levels (stops when stones run short or at 200). */
export function levelFashionAction(config: GameConfig, state: AccountState, ladder: FashionLadder, levels: number): Result<AccountState> {
  if (!FASHION_LADDERS.includes(ladder)) return fail('invalid_input', `no fashion ladder "${ladder}"`);
  let { level } = ladderLevel(state, ladder);
  const { exp } = ladderLevel(state, ladder);
  if (config.fashion.ladder[level]!.exp === 0) return fail('at_level_cap', 'already at level 200');
  let stones = state.currencies[STONE[ladder]] ?? 0;
  let spent = 0;
  let carried = exp;
  for (let i = 0; i < Math.max(1, Math.floor(levels)); i += 1) {
    const cost = levelCost(config, level, carried);
    if (cost === 0 || stones < cost) break;
    stones -= cost;
    spent += cost;
    level += 1;
    carried = 0;
  }
  if (spent === 0) return fail('insufficient_items', 'not enough stones');
  return ok({
    ...state,
    currencies: { ...state.currencies, [STONE[ladder]]: stones },
    fashion: { ...state.fashion, levels: { ...state.fashion.levels, [ladder]: { level, exp: 0 } } },
  });
}

/** Activate a piece (1 shard → 1★) or raise it one star (star + 1 shards), up to 15★. */
export function ascendFashionPieceAction(config: GameConfig, state: AccountState, slot: FashionSlot, index: number): Result<AccountState> {
  const piece = config.fashion.pieces.find((p) => p.slot === slot && p.index === index);
  if (!piece) return fail('not_found', `no ${slot} piece ${index}`);
  if (piece.free) return fail('invalid_input', `${piece.name} is a starting piece`);
  const star = pieceStar(state, piece);
  if (star >= config.fashion.maxStar) return fail('at_level_cap', `${piece.name} is at ${config.fashion.maxStar}★`);
  const key = pieceKey(slot, index);
  const cost = star === 0 ? 1 : star + 1;
  const have = state.fashion.shards[key] ?? 0;
  if (have < cost) return fail('insufficient_items', `not enough ${piece.name} shards`);
  const shards = { ...state.fashion.shards, [key]: have - cost };
  if (shards[key] === 0) delete shards[key];
  return ok({ ...state, fashion: { ...state.fashion, shards, stars: { ...state.fashion.stars, [key]: star + 1 } } });
}

export function wearFashionPieceAction(config: GameConfig, state: AccountState, slot: FashionSlot, index: number): Result<AccountState> {
  if (!FASHION_SLOTS.includes(slot)) return fail('invalid_input', `no fashion slot "${slot}"`);
  const piece = config.fashion.pieces.find((p) => p.slot === slot && p.index === index);
  if (!piece) return fail('not_found', `no ${slot} piece ${index}`);
  if (!owned(state, piece)) return fail('resource_locked', `${piece.name} is not owned`);
  return ok({ ...state, fashion: { ...state.fashion, worn: { ...state.fashion.worn, [slot]: index } } });
}

export function grantFashionShards(state: AccountState, slot: FashionSlot, index: number, count: number): AccountState {
  const key = pieceKey(slot, index);
  return { ...state, fashion: { ...state.fashion, shards: { ...state.fashion.shards, [key]: (state.fashion.shards[key] ?? 0) + count } } };
}
