import type { ResonanceState } from '../resonance';
/**
 * Account / roster / squad domain types (M3) plus the M5 campaign/idle/daily
 * slices. Pure data — the engine owns the rules (in sibling modules), the server
 * owns persistence, the client owns UI. See docs/design/account.md, pve.md.
 */

import type { CampaignProgress } from '../campaign/types';
import type { IdleState } from '../economy/idle';
import type { QuestState } from '../daily/quests';
import type { MailItem } from '../daily/mail';
import type { GachaState } from '../gacha/types';
import type { ShopState } from '../shop/types';
import type { TowerState } from '../pve/tower';
import type { WorldBossState } from '../pve/worldBoss';
import type { DungeonState } from '../pve/dungeons';
import type { PetHomeState } from '../pet-home/types';
import type { SkyPillarState } from '../sky-pillar/types';
import { initialTowerState } from '../pve/tower';
import { initialWorldBossState } from '../pve/worldBoss';
import { initialDungeonState } from '../pve/dungeons';
import type { ArenaState, RankedState } from '../pvp/types';
import { initialArenaState } from '../pvp/arena';
import { initialRankedState } from '../pvp/ranked';
import type { BattleStrategy } from '../combat/types';
import { BATTLE_STRATEGIES } from '../combat/types';

export type SquadMode = 'campaign' | 'arenaAttack' | 'arenaDefence' | 'tower' | 'worldBoss' | 'skyPillar';

export const SQUAD_MODES: readonly SquadMode[] = [
  'campaign',
  'arenaAttack',
  'arenaDefence',
  'tower',
  'worldBoss',
  'skyPillar',
];

export const SQUAD_SIZE = 6;

/** Slots 0-2 are the front row (absorb multi-target hits first); 3-5 the back. */
export const FRONT_ROW_SLOTS: readonly number[] = [0, 1, 2];

export type StrategyId = BattleStrategy;

export { BATTLE_STRATEGIES as STRATEGIES };

export type CurrencyId =
  // M3 core currencies.
  | 'gold'
  | 'gems'
  | 'candy'
  | 'shard'
  | 'stone'
  // M6 summon tickets.
  | 'ticketCommon'
  | 'ticketPremium'
  // M6 economy shape: per-mode and shop tokens (their sources land with their modes).
  | 'arenaToken'
  | 'guildCoin'
  | 'homeCoin'
  | 'forestCoin'
  | 'islandCoin'
  | 'wildCoin'
  // M11 collection materials.
  | 'potentialShard'
  // R4: item 10061, stands in for a Potential fodder Pokémon on 21 Pokémon (tiers 5–9).
  | 'potentialCore'
  | 'orbEssence'
  | 'soulHeartExp'
  | 'berryEssence'
  | 'heldItemShard'
  // R5 held-item refining (source items 100002 / 100003).
  | 'resetterShard'
  | 'heldItemResetter'
  | 'plateBottle'
  | 'plateFragment'
  | 'starShard'
  | 'resonationShard'
  // R6b: the Faction Tower Shop's coin (source item 33) and the trinket chests (hero_weapon_box).
  | 'factionCoin'
  | 'trinketChestOrange'
  | 'trinketChestRed'
  | 'trinketChestBlue'
  | 'trinketChestPurple'
  | 'trinketChest'
  | 'trinketBoxShiny'
  // R6d: berry breakthrough Mulch (source items 10013–10016) and Reforge Potions (10017).
  | 'berryMulchBlue'
  | 'berryMulchPurple'
  | 'berryMulchOrange'
  | 'berryMulchRed'
  | 'reforgePotion'
  | 'pokemonShard3'
  | 'pokemonShard5'
  // R8: VIP points (source attribute 6, the Privilege XP item).
  | 'privilegeXp';

export const CURRENCY_IDS: readonly CurrencyId[] = [
  'gold',
  'gems',
  'candy',
  'shard',
  'stone',
  'ticketCommon',
  'ticketPremium',
  'arenaToken',
  'guildCoin',
  'homeCoin',
  'forestCoin',
  'islandCoin',
  'wildCoin',
  'potentialShard',
  'potentialCore',
  'orbEssence',
  'soulHeartExp',
  'berryEssence',
  'heldItemShard',
  'resetterShard',
  'heldItemResetter',
  'plateBottle',
  'plateFragment',
  'starShard',
  'resonationShard',
  'factionCoin',
  'trinketChestOrange',
  'trinketChestRed',
  'trinketChestBlue',
  'trinketChestPurple',
  'trinketChest',
  'trinketBoxShiny',
  'berryMulchBlue',
  'berryMulchPurple',
  'berryMulchOrange',
  'berryMulchRed',
  'reforgePotion',
  'pokemonShard3',
  'pokemonShard5',
  'privilegeXp',
];

/** M11 materials shown on the Trainer screen and spent by the collection layers. */
export const MATERIAL_CURRENCY_IDS: readonly CurrencyId[] = [
  'potentialShard',
  'potentialCore',
  'orbEssence',
  'soulHeartExp',
  'berryEssence',
  'heldItemShard',
  'resetterShard',
  'heldItemResetter',
  'plateBottle',
  'plateFragment',
  'starShard',
  'resonationShard',
  'factionCoin',
  'trinketChestOrange',
  'trinketChestRed',
  'trinketChestBlue',
  'trinketChestPurple',
  'trinketChest',
  'trinketBoxShiny',
  'berryMulchBlue',
  'berryMulchPurple',
  'berryMulchOrange',
  'berryMulchRed',
  'reforgePotion',
  'pokemonShard3',
  'pokemonShard5',
  'privilegeXp',
];

/** The currencies the persistent HUD strip shows; the rest live on their own screens. */
export const HUD_CURRENCY_IDS: readonly CurrencyId[] = [
  'gold',
  'gems',
  'candy',
  'shard',
  'stone',
  'ticketCommon',
  'ticketPremium',
];

import type { EquipmentState, Loadout } from '../equipment/types';
import type { PotentialState } from '../potential/types';

/** One owned Wild (an *instance*, so duplicates of a species are separate). */
export interface WildInstance {
  id: string;
  speciesId: string;
  level: number;
  /** The source's star (R1): picks the species' star card — form, level cap and stats. */
  stars: number;
  locked: boolean;
  acquiredAt: number;
  /** E4: an Origin's skill levels (ult / basic / passive / talent4, 1–3; absent = 1). */
  skillLevels?: Partial<Record<'ult' | 'basic' | 'passive' | 'talent4', number>>;
  /** R7: the Pokémon's own level while Resonance shares the crystal level with it (absent otherwise). */
  ownLevel?: number;
}

export interface PlayerProfile {
  name: string;
  level: number;
  xp: number;
}

export type Squad = (string | null)[];

export interface AccountState {
  schemaVersion: number;
  /** Account creation epoch (ms). Server-day gates count from here (M13.0b). */
  serverEpoch: number;
  profile: PlayerProfile;
  roster: WildInstance[];
  /** E4: each species' own shards (source items 40001–40095, Origins 41001–41006). */
  speciesShards: Record<string, number>;
  /** R6b: each trinket holder's own levelling item (source items 23002+, e.g. Beldum Sunglasses), by species. */
  trinketItems: Record<string, number>;
  squads: Record<SquadMode, Squad>;
  strategies: Record<SquadMode, StrategyId>;
  currencies: Record<CurrencyId, number>;
  nextInstanceSeq: number;
  /** M5: campaign star record. */
  campaign: CampaignProgress;
  /** M5: idle income bookkeeping. */
  idle: IdleState;
  /** M5: daily quests (resets at 00:00 UTC). */
  quests: QuestState;
  /** M5: system mail. */
  mail: MailItem[];
  /** M5: first-session tutorial step index (0 = active). */
  tutorial: TutorialState;
  /** M6: summoning machine state, wish and history. */
  gacha: GachaState;
  /** M6: per-shop restock / purchase bookkeeping. */
  shops: ShopState;
  /** M7 owned equipment (relics, runes, cores, charm counts). */
  equipment: EquipmentState;
  /** M7 per-Wild loadouts, keyed by WildInstance id. */
  loadouts: Record<string, Loadout>;
  /** R4: Potential per Wild (instance id): nine tiers of picks plus what was paid. */
  potential: Record<string, PotentialState>;
  /** M11.7 plate stage per Wild (element-keyed); absent means stage 0. */
  plates: Record<string, number>;
  /** M11.8 signature trinket level per species id; absent means level 0. */
  trinkets: Record<string, number>;
  /** R7: the source's Resonance (top six, crystal, slots, cooldowns). */
  resonance: ResonanceState;
  /** R8 owned/equipped titles and their activation cards. */
  titles: TitlesState;
  /** R8 Trainer Tokens (source celestica_trial_token_json). */
  trainerTokens: TrainerTokensState;
  /** R9 Sign In (source sign_json). */
  signIn: SignInState;
  /** M8: PvE mode progress (tower, trials, world boss, dungeons, link crystal). */
  pve: PveState;
  /** M10: PvP progress (Arena credits/rank, Ranked ladder). */
  pvp: PvpState;
  /** M13.1: the Pet Home merge board, album and shop bookkeeping. */
  petHome: PetHomeState;
  /** M13.2: Sky Pillar star records, proofs and floor chests. */
  skyPillar: SkyPillarState;
  /** M5 debug: minutes of clock fast-forward added to the injected clock. */
  debugClockOffset: number;
}

/** M8 mode progress. Pure data; the engine owns every rule that reads it. */
export interface PveState {
  tower: TowerState;
  /** Trial id → UTC day-key it was last cleared (first clear each day pays). */
  trials: { lastCleared: Record<string, string> };
  worldBoss: WorldBossState;
  dungeons: DungeonState;
}

export function initialPve(day: string, week: string): PveState {
  return {
    tower: initialTowerState(day, week),
    trials: { lastCleared: {} },
    worldBoss: initialWorldBossState(day),
    dungeons: initialDungeonState(day),
  };
}

/** M10 PvP progress. Pure data; the engine owns every rule that reads it. */
export interface PvpState {
  arena: ArenaState;
  ranked: RankedState;
}

/**
 * A fresh PvP slice: Arena credits/attempts keyed to the UTC day + ISO week, and
 * a Ranked ladder starting at the first phase's bottom tier. The server calls
 * this on a new save and fills it in for older ones (see `docs/design/pvp.md`).
 */
export function initialPvp(day: string, week: string): PvpState {
  return {
    arena: initialArenaState(day, week),
    ranked: initialRankedState(0, day, week),
  };
}



/**
 * R8 Trainer Tokens, keyed by source token id: each token's level (0–5) and its own fragments. Each level needs
 * that Gods Trials season's Suppression Treasure total (0–60), which the Gods Trials mode (M13) will record in
 * `treasureTotals` by season.
 */
export interface TrainerTokensState {
  levels: Record<string, number>;
  fragments: Record<string, number>;
  treasureTotals: Record<string, number>;
}

export function initialTrainerTokens(): TrainerTokensState {
  return { levels: {}, fragments: {}, treasureTotals: {} };
}

/**
 * R9 Sign In: a 31-day calendar starting on `calendarStart` (a UTC day key); the next calendar starts the day after
 * day 31. `signed` / `doubled` hold this calendar's day numbers, `milestones` the signed-day bonuses claimed.
 */
export interface SignInState {
  calendarStart: string;
  signed: number[];
  doubled: number[];
  milestones: number[];
}

export function initialSignIn(day: string): SignInState {
  return { calendarStart: day, signed: [], doubled: [], milestones: [] };
}

/** Three account-wide title slots (source layers 1–3: Common / Premium / Rare). */
export const TITLE_SLOTS = ['common', 'premium', 'rare'] as const;
export type TitleSlot = (typeof TITLE_SLOTS)[number];

export interface TitleOwnership {
  /** 1-based stage in the title's authored ladder. */
  stage: number;
  /** Epoch ms for timed titles; null for permanent titles. */
  expiresAt: number | null;
}

export interface TitlesState {
  owned: Record<string, TitleOwnership>;
  equipped: Record<TitleSlot, string | null>;
  /** R8: each title's own activation cards (source: one item per title), by title id. */
  cards: Record<string, number>;
}

export function initialTitles(): TitlesState {
  return { owned: {}, equipped: { common: null, premium: null, rare: null }, cards: {} };
}

/** Drop expired titles and clear any slot that pointed at one (lazy expiry). */
export function expireTitles(titles: TitlesState, now: number): TitlesState {
  let changed = false;
  const owned: Record<string, TitleOwnership> = {};
  for (const [id, ownedTitle] of Object.entries(titles.owned)) {
    if (ownedTitle.expiresAt !== null && ownedTitle.expiresAt <= now) {
      changed = true;
      continue;
    }
    owned[id] = ownedTitle;
  }
  const equipped = { ...titles.equipped };
  for (const slot of TITLE_SLOTS) {
    const id = equipped[slot];
    if (id !== null && !owned[id]) {
      equipped[slot] = null;
      changed = true;
    }
  }
  return changed ? { ...titles, owned, equipped } : titles;
}

export interface TutorialState {
  step: number;
  done: boolean;
}

/** Steps in the first-session guide: level a Wild, set a squad, win stage 1-1. */
export const TUTORIAL_STEPS = 3;

export function emptySquad(): Squad {
  return Array.from({ length: SQUAD_SIZE }, () => null);
}

export function emptySquads(): Record<SquadMode, Squad> {
  return {
    campaign: emptySquad(),
    arenaAttack: emptySquad(),
    arenaDefence: emptySquad(),
    tower: emptySquad(),
    worldBoss: emptySquad(),
    skyPillar: emptySquad(),
  };
}

export function defaultStrategies(): Record<SquadMode, StrategyId> {
  return {
    campaign: 'balanced',
    arenaAttack: 'aggressive',
    arenaDefence: 'defensive',
    tower: 'balanced',
    worldBoss: 'aggressive',
    skyPillar: 'balanced',
  };
}

/**
 * Tuning for growth actions (`tuning/growth.json`). Star caps, level caps and evolution fodder come
 * from each species' star cards (R1); the level-up price is a stand-in until the source's table is
 * captured (ASSUMPTIONS #51).
 */
export interface ProgressTables {
  levelUp: { candyBase: number; candyExponent: number; goldPerCandy: number };
  respawn: { gemCost: number; refundRate: number };
}
