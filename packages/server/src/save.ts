import {
  createMail,
  CURRENCY_IDS,
  dayKey,
  weekKey,
  defaultStrategies,
  emptyQuestState,
  emptySquads,
  emptyStartingEquipment,
  initialEquipment,
  initialIdle,
  initialGacha,
  initialPve,
  initialPvp,
  initialShopState,
  type AccountState,
  type CurrencyId,
  type MailItem,
  type WildInstance,
} from '@wildbound/engine';
import { fail, ok, type Result } from './index';
import type { GameConfig } from './config';

/** Bump when the persisted shape changes; `migrateSave` upgrades older saves. */
export const SAVE_VERSION = 8;
export const SAVE_KEY = 'wildbound.account';
export const BACKUP_KEY = 'wildbound.account.backup';

function currenciesFrom(source: Record<string, number>): Record<CurrencyId, number> {
  const out = {} as Record<CurrencyId, number>;
  for (const id of CURRENCY_IDS) out[id] = Math.max(0, Math.floor(source[id] ?? 0));
  return out;
}

/** v7 stored one `charm`; v8 stores an array of Berry slots. */
function normalizeLoadouts(
  source: AccountState['loadouts'] | undefined,
  slots: number,
): AccountState['loadouts'] {
  const out: AccountState['loadouts'] = {};
  for (const [wildId, raw] of Object.entries(source ?? {})) {
    const { charm: legacy, ...rest } = raw as typeof raw & { charm?: string | null };
    const stored = Array.isArray(rest.charms) ? rest.charms : [legacy ?? null];
    out[wildId] = { ...rest, charms: Array.from({ length: slots }, (_, i) => stored[i] ?? null) };
  }
  return out;
}

/** Fill any missing slices on an older save (v1–v7 → current). */
function withDefaults(state: AccountState, now: number, config: GameConfig): AccountState {
  const s = state as Partial<AccountState>;
  const day = dayKey(now);
  const charmSlots = config?.equipment?.tuning?.charms?.slots ?? 2;
  return {
    ...state,
    schemaVersion: SAVE_VERSION,
    currencies: currenciesFrom(s.currencies ?? {}),
    campaign: s.campaign ?? { stars: {} },
    idle: s.idle ?? initialIdle(now, day),
    quests: s.quests ?? emptyQuestState(day),
    mail: s.mail ?? [],
    tutorial: s.tutorial ?? { step: 0, done: false },
    gacha: s.gacha ?? initialGacha(config?.gacha?.machines ?? [], day),
    shops: s.shops ?? initialShopState(config?.shops ?? [], now, day),
    equipment: s.equipment ?? initialEquipment(config?.equipment?.tuning?.starting ?? emptyStartingEquipment()),
    loadouts: normalizeLoadouts(s.loadouts, charmSlots),
    pve: s.pve ?? initialPve(day, weekKey(now)),
    pvp: s.pvp ?? initialPvp(day, weekKey(now)),
    debugClockOffset: s.debugClockOffset ?? 0,
  };
}

/** The welcome letter every new account starts with (PROMPT §7.9). */
function welcomeMail(config: GameConfig, now: number): MailItem {
  return createMail({
    id: 'mail_welcome',
    subjectKey: 'mail.welcome.subject',
    bodyKey: 'mail.welcome.body',
    grants: config.economy.welcome,
    createdAt: now,
    ttlMs: Math.round(config.economy.mailTtlHours * 3_600_000),
  });
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
  const now = config.now();
  const day = dayKey(now);
  return {
    schemaVersion: SAVE_VERSION,
    profile: { name: config.playerName, level: 1, xp: 0 },
    roster,
    squads: emptySquads(),
    strategies: defaultStrategies(),
    currencies: currenciesFrom(config.startingCurrencies),
    nextInstanceSeq: seq,
    campaign: { stars: {} },
    idle: initialIdle(now, day),
    quests: emptyQuestState(day),
    mail: [welcomeMail(config, now)],
    tutorial: { step: 0, done: false },
    gacha: initialGacha(config.gacha.machines, day),
    shops: initialShopState(config.shops, now, day),
    equipment: initialEquipment(config.equipment.tuning.starting),
    loadouts: {},
    pve: initialPve(day, weekKey(now)),
    pvp: initialPvp(day, weekKey(now)),
    debugClockOffset: 0,
  };
}

export function serializeSave(state: AccountState): string {
  return JSON.stringify({ version: SAVE_VERSION, state }, null, 2);
}

/** Parse + migrate an exported/unparsed save; typed `corrupt_save` on failure. */
export function parseSave(json: string, now: number = Date.now(), config?: GameConfig): Result<AccountState> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return fail('corrupt_save', 'save is not valid JSON');
  }
  return migrateSave(raw, now, config);
}

export function migrateSave(raw: unknown, now: number = Date.now(), config?: GameConfig): Result<AccountState> {
  if (raw === null || typeof raw !== 'object') return fail('corrupt_save', 'save is not an object');
  const envelope = raw as { version?: unknown; state?: unknown };
  const version = typeof envelope.version === 'number' ? envelope.version : NaN;
  if (!Number.isFinite(version)) return fail('corrupt_save', 'save has no version');
  if (version > SAVE_VERSION) return fail('corrupt_save', `save version ${version} is newer than supported ${SAVE_VERSION}`);
  const state = envelope.state;
  if (state === null || typeof state !== 'object') return fail('corrupt_save', 'save is missing required account fields');
  // When migrating from old incomplete shapes, be lenient and fill defaults
  const migrated = {
    ...(state as Record<string, unknown>),
    schemaVersion: SAVE_VERSION,
  } as AccountState;
  const filled = withDefaults(migrated, now, config ?? ({} as GameConfig));
  if (!isAccountState(filled)) {
    return fail('corrupt_save', 'save is missing required account fields');
  }
  return ok(filled);
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
