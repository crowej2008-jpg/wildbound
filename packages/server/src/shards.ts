import { emptyLoadout, type AccountState, type SkillRow, type WildInstance } from '@wildbound/engine';
import { kitById } from '@wildbound/content';
import { fail, ok, type Result } from './index';
import { firstStar, type GameConfig } from './config';

/**
 * E4: each species' own shards and the Origins' skill levels (source: hero_basic_json item_num,
 * hero_origin_skill_up_json). Shards make a Pokémon — 30 / 40 / 50 by quality, an Origin 50 — and
 * an Origin spends its own shards on skill LV.2 (50) and LV.3 (100). Owner, 2026-10-31: no shard
 * source until R9 wires the real rewards.
 */

export const SKILL_ROWS: readonly SkillRow[] = ['ult', 'basic', 'passive', 'talent4'];

export function shardsOf(state: AccountState, speciesId: string): number {
  return state.speciesShards[speciesId] ?? 0;
}

function withShards(state: AccountState, speciesId: string, next: number): AccountState {
  return { ...state, speciesShards: { ...state.speciesShards, [speciesId]: next } };
}

/** Spend a species' shards on a new copy of it at its first star. */
export function composeWildAction(config: GameConfig, state: AccountState, speciesId: string, now: number): Result<AccountState> {
  const meta = config.species.get(speciesId);
  if (!meta) return fail('not_found', `unknown species "${speciesId}"`);
  const have = shardsOf(state, speciesId);
  if (have < meta.shards) return fail('insufficient_items', `${meta.name} needs ${meta.shards} shards`);
  const instance: WildInstance = {
    id: `w${state.nextInstanceSeq}`,
    speciesId,
    level: 1,
    stars: firstStar(meta),
    locked: false,
    acquiredAt: now,
  };
  return ok({
    ...withShards(state, speciesId, have - meta.shards),
    roster: [...state.roster, instance],
    nextInstanceSeq: state.nextInstanceSeq + 1,
    loadouts: { ...state.loadouts, [instance.id]: emptyLoadout(config.equipment.tuning) },
  });
}

export function skillLevelOf(wild: WildInstance, row: SkillRow): number {
  return Math.min(3, Math.max(1, Math.floor(wild.skillLevels?.[row] ?? 1)));
}

/** Raise one of an Origin's four skill rows a level with its own shards. */
export function upgradeOriginSkillAction(
  config: GameConfig,
  state: AccountState,
  wildId: string,
  row: SkillRow,
): Result<AccountState> {
  if (!SKILL_ROWS.includes(row)) return fail('invalid_input', `no skill row "${row}"`);
  const wild = state.roster.find((w) => w.id === wildId);
  if (!wild) return fail('not_found', `no Wild "${wildId}"`);
  const meta = config.species.get(wild.speciesId);
  if (!meta) return fail('not_found', `unknown species "${wild.speciesId}"`);
  if (meta.tier !== 'origin') return fail('resource_locked', 'only Origins level their skills');
  const level = skillLevelOf(wild, row);
  const cost = config.originSkillCosts[level - 1];
  if (cost === undefined) return fail('at_level_cap', 'skill already at LV.3');
  const have = shardsOf(state, wild.speciesId);
  if (have < cost) return fail('insufficient_items', `needs ${cost} ${meta.name} shards`);
  const next: WildInstance = { ...wild, skillLevels: { ...(wild.skillLevels ?? {}), [row]: level + 1 } };
  return ok({
    ...withShards(state, wild.speciesId, have - cost),
    roster: state.roster.map((w) => (w.id === wildId ? next : w)),
  });
}

export interface OriginSkillRowView {
  row: SkillRow;
  name: string;
  level: number;
  /** The sheet's text at LV.1, LV.2, LV.3 (LV.2+ describe what the level adds). */
  text: string[];
  /** Own shards for the next level, or null at LV.3. */
  cost: number | null;
}

export interface OriginSkillsView {
  wildId: string;
  speciesId: string;
  shards: number;
  rows: OriginSkillRowView[];
}

/** Display-ready Origin skill levels for the Wild screen (null for ordinary Pokémon). */
export function originSkillsView(config: GameConfig, state: AccountState, wildId: string): OriginSkillsView | null {
  const wild = state.roster.find((w) => w.id === wildId);
  if (!wild) return null;
  const meta = config.species.get(wild.speciesId);
  const kit = kitById(wild.speciesId);
  if (!meta || meta.tier !== 'origin' || !kit?.levels) return null;
  return {
    wildId,
    speciesId: wild.speciesId,
    shards: shardsOf(state, wild.speciesId),
    rows: SKILL_ROWS.map((row) => {
      const level = skillLevelOf(wild, row);
      const def = kit.levels?.[row];
      return {
        row,
        name: def?.name ?? row,
        level,
        text: def?.text ?? [],
        cost: config.originSkillCosts[level - 1] ?? null,
      };
    }),
  };
}

/** Test / debug support: add a species' shards. */
export function grantSpeciesShardsAction(config: GameConfig, state: AccountState, speciesId: string, amount: number): Result<AccountState> {
  if (!config.species.has(speciesId)) return fail('not_found', `unknown species "${speciesId}"`);
  if (!Number.isFinite(amount) || amount < 0) return fail('invalid_input', 'amount must be non-negative');
  return ok(withShards(state, speciesId, shardsOf(state, speciesId) + Math.floor(amount)));
}
