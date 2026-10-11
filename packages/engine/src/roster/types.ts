/**
 * Account / roster / squad domain types (M3). Pure data — the engine owns the
 * rules (in sibling modules), the server owns persistence, the client owns UI.
 * See docs/design/account.md.
 */

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

export type StrategyId = 'aggressive' | 'balanced' | 'defensive';

export const STRATEGIES: readonly StrategyId[] = ['aggressive', 'balanced', 'defensive'];

export type CurrencyId = 'gold' | 'gems' | 'candy' | 'shard' | 'stone';

export const CURRENCY_IDS: readonly CurrencyId[] = ['gold', 'gems', 'candy', 'shard', 'stone'];

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
}

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
