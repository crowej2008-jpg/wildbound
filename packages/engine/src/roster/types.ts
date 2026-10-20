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
import type { LinkCrystalState } from '../pve/linkCrystal';
import { initialTowerState } from '../pve/tower';
import { initialWorldBossState } from '../pve/worldBoss';
import { initialDungeonState } from '../pve/dungeons';
import { initialLinkCrystal } from '../pve/linkCrystal';
import type { ArenaState, RankedState } from '../pvp/types';
import { initialArenaState } from '../pvp/arena';
import { initialRankedState } from '../pvp/ranked';
import type { BattleStrategy } from '../combat/types';
import { BATTLE_STRATEGIES } from '../combat/types';

export type SquadMode = 'campaign' | 'arenaAttack' | 'arenaDefence' | 'tower' | 'worldBoss';

export const SQUAD_MODES: readonly SquadMode[] = [
  'campaign',
  'arenaAttack',
  'arenaDefence',
  'tower',
  'worldBoss',
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
  | 'orbEssence'
  | 'soulHeartExp'
  | 'berryEssence'
  | 'heldItemShard'
  | 'plateBottle'
  | 'plateFragment'
  | 'starShard'
  | 'resonationShard'
  | 'titleTicket';

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
  'orbEssence',
  'soulHeartExp',
  'berryEssence',
  'heldItemShard',
  'plateBottle',
  'plateFragment',
  'starShard',
  'resonationShard',
  'titleTicket',
];

/** M11 materials shown on the Trainer screen and spent by the collection layers. */
export const MATERIAL_CURRENCY_IDS: readonly CurrencyId[] = [
  'potentialShard',
  'orbEssence',
  'soulHeartExp',
  'berryEssence',
  'heldItemShard',
  'plateBottle',
  'plateFragment',
  'starShard',
  'resonationShard',
  'titleTicket',
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

/** One owned Wild (an *instance*, so duplicates of a species are separate). */
export interface WildInstance {
  id: string;
  speciesId: string;
  level: number;
  stars: number;
  /** 0-based evolution stage; bounded by the species' `stages.length`. */
  evolutionStage: number;
  locked: boolean;
  acquiredAt: number;
}

export interface PlayerProfile {
  name: string;
  level: number;
  xp: number;
}

export type Squad = (string | null)[];

export interface AccountState {
  schemaVersion: number;
  profile: PlayerProfile;
  roster: WildInstance[];
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
  /** M8: PvE mode progress (tower, trials, world boss, dungeons, link crystal). */
  pve: PveState;
  /** M10: PvP progress (Arena credits/rank, Ranked ladder). */
  pvp: PvpState;
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
  linkCrystal: LinkCrystalState;
}

export function initialPve(day: string, week: string): PveState {
  return {
    tower: initialTowerState(day, week),
    trials: { lastCleared: {} },
    worldBoss: initialWorldBossState(day),
    dungeons: initialDungeonState(day),
    linkCrystal: initialLinkCrystal(),
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
  };
}

export function defaultStrategies(): Record<SquadMode, StrategyId> {
  return {
    campaign: 'balanced',
    arenaAttack: 'aggressive',
    arenaDefence: 'defensive',
    tower: 'balanced',
    worldBoss: 'aggressive',
  };
}

/** Tuning for growth actions, mirroring `tuning/growth.json`'s progress block. */
export interface EvolveStep {
  minLevel: number;
  minStars: number;
  candy: number;
  gold: number;
  stones: number;
}

export interface ProgressTables {
  levelUp: { candyBase: number; candyExponent: number; goldPerCandy: number };
  starUp: { shardsPerStar: number; goldPerStar: number };
  /** Indexed by target stage (index 0 is unused — a Wild cannot evolve to stage 0). */
  evolve: EvolveStep[];
  respawn: { gemCost: number; refundRate: number };
  maxLevelByStage: number[];
  maxStars: number;
}
