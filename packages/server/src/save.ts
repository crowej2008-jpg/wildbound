import {
  createMail,
  CURRENCY_IDS,
  dayKey,
  weekKey,
  defaultStrategies,
  SQUAD_MODES,
  emptyQuestState,
  emptySquads,
  emptyStartingEquipment,
  initialEquipment,
  initialIdle,
  initialGacha,
  initialPetHome,
  initialPve,
  initialPvp,
  initialResonance,
  initialShopState,
  initialTitles,
  initialVip,
  initialSkyPillar,
  TITLE_SLOTS,
  type AccountState,
  type CurrencyId,
  type MailItem,
  type ResonanceState,
  type SkyPillarState,
  type Squad,
  type SquadMode,
  type TitleOwnership,
  type TitlesState,
  type WildInstance,
} from '@wildbound/engine';
import { fail, ok, type Result } from './index';
import { firstStar, type GameConfig } from './config';

/** Bump when the persisted shape changes; `migrateSave` upgrades saves at or above MIN_SAVE_VERSION. */
export const SAVE_VERSION = 19;
/**
 * Oldest save that still loads. During the source retrofit (owner decision 2026-10-31) saves are
 * reset rather than migrated, so every retrofit step that changes the save shape raises this to the
 * new SAVE_VERSION. An older save is refused as `outdated_save`; LocalServer then starts a fresh
 * account and keeps the old save under RETIRED_KEY.
 */
export const MIN_SAVE_VERSION = 19;
export const SAVE_KEY = 'wildbound.account';
export const BACKUP_KEY = 'wildbound.account.backup';
export const RETIRED_KEY = 'wildbound.account.retired';

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

/** Fill the resonance board and keep its slot array the tuned length. */
function normalizeResonance(
  source: Partial<ResonanceState> | undefined,
  config: GameConfig,
): ResonanceState {
  const tuning = config?.collection?.resonance;
  const slots = tuning?.slots ?? 6;
  const openSlots = tuning?.openSlots ?? 2;
  const base = initialResonance(slots, openSlots);
  const unlocked = Math.max(
    base.unlocked,
    Math.min(base.slots.length, Math.floor(source?.unlocked ?? base.unlocked)),
  );
  const stored = source?.slots ?? [];
  return {
    unlocked,
    slots: base.slots.map((_, index) => (typeof stored[index] === 'string' ? stored[index] : null)),
  };
}

/** Fill the title board and drop timed titles that already expired. */
function normalizeTitles(
  source: Partial<TitlesState> | undefined,
  now: number,
): TitlesState {
  const base = initialTitles();
  const owned: Record<string, TitleOwnership> = {};
  for (const [id, value] of Object.entries(source?.owned ?? {})) {
    if (!value || typeof value.stage !== 'number' || !Number.isFinite(value.stage)) continue;
    const expiresAt =
      typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt) ? value.expiresAt : null;
    if (expiresAt !== null && expiresAt <= now) continue;
    owned[id] = { stage: Math.max(1, Math.floor(value.stage)), expiresAt };
  }
  const equipped = { ...base.equipped };
  for (const slot of TITLE_SLOTS) {
    const id = source?.equipped?.[slot];
    if (typeof id === 'string' && owned[id]) equipped[slot] = id;
  }
  return { owned, equipped };
}

/** Fill every squad mode and strategy, including modes added after an old save. */
function normalizeSquads(
  source: Partial<Record<SquadMode, Squad>> | undefined,
): Record<SquadMode, Squad> {
  const base = emptySquads();
  for (const mode of SQUAD_MODES) {
    const slots = source?.[mode];
    if (!Array.isArray(slots)) continue;
    base[mode] = base[mode].map((_, index) =>
      typeof slots[index] === 'string' ? (slots[index] as string) : null,
    );
  }
  return base;
}

/** Fill any missing slices on an older save (v1–v16 → current). */
function withDefaults(state: AccountState, now: number, config: GameConfig): AccountState {
  const s = state as Partial<AccountState>;
  const day = dayKey(now);
  const charmSlots = config?.equipment?.tuning?.charms?.slots ?? 2;
  const welcomeCreatedAt = (s.mail ?? []).find((m) => m.subjectKey === 'mail.welcome.subject')?.createdAt;
  const serverEpoch =
    typeof s.serverEpoch === 'number' && Number.isFinite(s.serverEpoch)
      ? s.serverEpoch
      : welcomeCreatedAt ?? now;
  return {
    ...state,
    schemaVersion: SAVE_VERSION,
    serverEpoch,
    squads: normalizeSquads(s.squads),
    strategies: { ...defaultStrategies(), ...(s.strategies ?? {}) },
    currencies: currenciesFrom(s.currencies ?? {}),
    campaign: {
      stars: s.campaign?.stars ?? {},
      gyms: s.campaign?.gyms ?? {},
    },
    idle: s.idle ?? initialIdle(now, day),
    quests: s.quests ?? emptyQuestState(day),
    mail: s.mail ?? [],
    tutorial: s.tutorial ?? { step: 0, done: false },
    gacha: s.gacha ?? initialGacha(config?.gacha?.machines ?? [], day),
    shops: s.shops ?? initialShopState(config?.shops ?? [], now, day),
    equipment: s.equipment ?? initialEquipment(config?.equipment?.tuning?.starting ?? emptyStartingEquipment()),
    loadouts: normalizeLoadouts(s.loadouts, charmSlots),
    plates: s.plates ?? {},
    trinkets: s.trinkets ?? {},
    resonance: normalizeResonance(s.resonance, config),
    vip: { lastClaimDay: s.vip?.lastClaimDay ?? null },
    titles: normalizeTitles(s.titles, now),
    pve: s.pve ?? initialPve(day, weekKey(now)),
    pvp: s.pvp ?? initialPvp(day, weekKey(now)),
    petHome: s.petHome ?? initialPetHome(now, day),
    skyPillar: s.skyPillar ?? initialSkyPillar(now, config?.skyPillar),
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

/** Told to a player whose save was older than MIN_SAVE_VERSION and was replaced by a fresh account. */
export function freshStartMail(config: GameConfig, now: number): MailItem {
  return createMail({
    id: 'mail_fresh_start',
    subjectKey: 'mail.freshStart.subject',
    bodyKey: 'mail.freshStart.body',
    grants: {},
    createdAt: now,
    ttlMs: Math.round(config.economy.mailTtlHours * 3_600_000),
  });
}

/** A fresh account seeded from content (starting currencies + roster). */
export function createInitialState(config: GameConfig): AccountState {
  const now = config.now();
  let seq = 1;
  const roster: WildInstance[] = config.startingRoster
    .filter((id) => config.species.has(id))
    .map((speciesId) => ({
      id: `w${seq++}`,
      speciesId,
      level: 1,
      stars: firstStar(config.species.get(speciesId)!),
      locked: false,
      acquiredAt: now,
    }));
  const day = dayKey(now);
  return {
    schemaVersion: SAVE_VERSION,
    serverEpoch: now,
    profile: { name: config.playerName, level: 1, xp: 0 },
    roster,
    squads: emptySquads(),
    strategies: defaultStrategies(),
    currencies: currenciesFrom(config.startingCurrencies),
    nextInstanceSeq: seq,
    campaign: { stars: {}, gyms: {} },
    idle: initialIdle(now, day),
    quests: emptyQuestState(day),
    mail: [welcomeMail(config, now)],
    tutorial: { step: 0, done: false },
    gacha: initialGacha(config.gacha.machines, day),
    shops: initialShopState(config.shops, now, day),
    equipment: initialEquipment(config.equipment.tuning.starting),
    loadouts: {},
    plates: {},
    trinkets: {},
    resonance: initialResonance(
      config.collection.resonance.slots,
      config.collection.resonance.openSlots,
    ),
    vip: initialVip(),
    titles: initialTitles(),
    pve: initialPve(day, weekKey(now)),
    pvp: initialPvp(day, weekKey(now)),
    petHome: initialPetHome(now, day),
    skyPillar: initialSkyPillar(now, config.skyPillar),
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
  if (version < MIN_SAVE_VERSION) {
    return fail(
      'outdated_save',
      `This save is from an older version of Wildbound (v${version}) and can't be loaded after the source update. Start a new game.`,
    );
  }
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
  if (typeof s.serverEpoch !== 'number' || !Number.isFinite(s.serverEpoch)) return false;
  if (!s.profile || typeof s.profile.name !== 'string' || typeof s.profile.level !== 'number') return false;
  if (!Array.isArray(s.roster)) return false;
  if (!s.roster.every(isInstance)) return false;
  if (!s.squads || typeof s.squads !== 'object') return false;
  if (!s.currencies || typeof s.currencies !== 'object') return false;
  if (!isPetHome(s.petHome)) return false;
  if (!isSkyPillar(s.skyPillar)) return false;
  if (typeof s.nextInstanceSeq !== 'number') return false;
  return true;
}

function isPetHome(value: unknown): value is AccountState['petHome'] {
  if (value === null || typeof value !== 'object') return false;
  const home = value as Partial<AccountState['petHome']>;
  if (typeof home.xp !== 'number' || !Number.isFinite(home.xp)) return false;
  if (!Array.isArray(home.unlockedTiles) || !home.unlockedTiles.every((id) => typeof id === 'number')) {
    return false;
  }
  if (!Array.isArray(home.pets) || !home.pets.every(isPetHomePet)) return false;
  if (typeof home.nextPetSeq !== 'number' || !Number.isFinite(home.nextPetSeq)) return false;
  if (typeof home.lastSettledAt !== 'number' || !Number.isFinite(home.lastSettledAt)) return false;
  if (typeof home.summonDay !== 'string' || typeof home.shopDay !== 'string') return false;
  if (typeof home.freeSummonsUsed !== 'number' || typeof home.paidSummonsUsed !== 'number') return false;
  if (!Array.isArray(home.levelClaims) || !home.levelClaims.every((level) => typeof level === 'number')) {
    return false;
  }
  if (!Array.isArray(home.album) || !home.album.every((id) => typeof id === 'string')) return false;
  if (typeof home.shopRefreshes !== 'number') return false;
  if (!Array.isArray(home.shopBought) || !home.shopBought.every((id) => typeof id === 'string')) {
    return false;
  }
  return true;
}

function isSkyPillar(value: unknown): value is SkyPillarState {
  if (value === null || typeof value !== 'object') return false;
  const sky = value as Partial<SkyPillarState>;
  if (typeof sky.proofs !== 'number' || !Number.isFinite(sky.proofs)) return false;
  if (typeof sky.lastProofAt !== 'number' || !Number.isFinite(sky.lastProofAt)) return false;
  if (!sky.stars || typeof sky.stars !== 'object') return false;
  if (!Object.values(sky.stars).every((stars) => typeof stars === 'number')) return false;
  if (!Array.isArray(sky.claimedChests) || !sky.claimedChests.every((key) => typeof key === 'string')) {
    return false;
  }
  return true;
}

function isPetHomePet(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  const pet = value as Record<string, unknown>;
  return (
    typeof pet.id === 'string' &&
    typeof pet.speciesId === 'string' &&
    typeof pet.level === 'number' &&
    typeof pet.tileId === 'number' &&
    typeof pet.opened === 'boolean'
  );
}

function isInstance(value: unknown): value is WildInstance {
  if (value === null || typeof value !== 'object') return false;
  const w = value as Partial<WildInstance>;
  return (
    typeof w.id === 'string' &&
    typeof w.speciesId === 'string' &&
    typeof w.level === 'number' &&
    typeof w.stars === 'number' &&
    typeof w.locked === 'boolean' &&
    typeof w.acquiredAt === 'number'
  );
}
