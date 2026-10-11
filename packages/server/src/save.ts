import {
  CURRENCY_IDS,
  defaultStrategies,
  emptySquads,
  type AccountState,
  type CurrencyId,
  type WildInstance,
} from '@wildbound/engine';
import { fail, ok, type Result } from './index';
import type { GameConfig } from './config';

/** Bump when the persisted shape changes; `migrateSave` upgrades older saves. */
export const SAVE_VERSION = 1;
export const SAVE_KEY = 'wildbound.account';
export const BACKUP_KEY = 'wildbound.account.backup';

function currenciesFrom(source: Record<string, number>): Record<CurrencyId, number> {
  const out = {} as Record<CurrencyId, number>;
  for (const id of CURRENCY_IDS) out[id] = Math.max(0, Math.floor(source[id] ?? 0));
  return out;
}

/** A fresh account seeded from content (starting currencies + roster). */
export function createInitialState(config: GameConfig): AccountState {
  let seq = 1;
  const roster: WildInstance[] = config.startingRoster
    .filter((id) => config.species.has(id))
    .map((speciesId) => ({
      id: `w${seq++}`,
      speciesId,
      level: 1,
      stars: 1,
      evolutionStage: 0,
      locked: false,
      acquiredAt: config.now(),
    }));
  return {
    schemaVersion: SAVE_VERSION,
    profile: { name: config.playerName, level: 1, xp: 0 },
    roster,
    squads: emptySquads(),
    strategies: defaultStrategies(),
    currencies: currenciesFrom(config.startingCurrencies),
    nextInstanceSeq: seq,
  };
}

export function serializeSave(state: AccountState): string {
  return JSON.stringify({ version: SAVE_VERSION, state }, null, 2);
}

/** Parse + migrate an exported/unparsed save; typed `corrupt_save` on failure. */
export function parseSave(json: string): Result<AccountState> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return fail('corrupt_save', 'save is not valid JSON');
  }
  return migrateSave(raw);
}

export function migrateSave(raw: unknown): Result<AccountState> {
  if (raw === null || typeof raw !== 'object') return fail('corrupt_save', 'save is not an object');
  const envelope = raw as { version?: unknown; state?: unknown };
  const version = typeof envelope.version === 'number' ? envelope.version : NaN;
  if (!Number.isFinite(version)) return fail('corrupt_save', 'save has no version');
  if (version > SAVE_VERSION) return fail('corrupt_save', `save version ${version} is newer than supported ${SAVE_VERSION}`);
  const state = envelope.state;
  if (!isAccountState(state)) return fail('corrupt_save', 'save is missing required account fields');
  // Future version upgrades land here; version 1 needs none.
  return ok({ ...state, schemaVersion: SAVE_VERSION });
}

function isAccountState(value: unknown): value is AccountState {
  if (value === null || typeof value !== 'object') return false;
  const s = value as Partial<AccountState>;
  if (typeof s.schemaVersion !== 'number') return false;
  if (!s.profile || typeof s.profile.name !== 'string' || typeof s.profile.level !== 'number') return false;
  if (!Array.isArray(s.roster)) return false;
  if (!s.roster.every(isInstance)) return false;
  if (!s.squads || typeof s.squads !== 'object') return false;
  if (!s.currencies || typeof s.currencies !== 'object') return false;
  if (typeof s.nextInstanceSeq !== 'number') return false;
  return true;
}

function isInstance(value: unknown): value is WildInstance {
  if (value === null || typeof value !== 'object') return false;
  const w = value as Partial<WildInstance>;
  return (
    typeof w.id === 'string' &&
    typeof w.speciesId === 'string' &&
    typeof w.level === 'number' &&
    typeof w.stars === 'number' &&
    typeof w.evolutionStage === 'number' &&
    typeof w.locked === 'boolean' &&
    typeof w.acquiredAt === 'number'
  );
}
