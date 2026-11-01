import type { CombatField, SkillSlot } from '../combat/types';
import type { FodderReq } from '../growth/types';
import type { Faction, WildClass } from '../model';

/**
 * R4 Potential (the source's 天赋 "talent" system, kb/potential.md): 62 Pokémon (Legendary+) each
 * have nine tiers of three options; a tier unlocks at 6 + N stars, an unlocked option levels 1 → 6.
 */

/** When an event option fires. `afterAttack` = after any of its own actions that attack. */
export type PotentialEvent = 'afterAttack' | 'afterUlt' | 'afterNonUlt' | 'afterNormal' | 'afterBasic' | 'onHit' | 'battleStart';

/**
 * What an option does, with its level value `v` (a fraction for % lines, points for SPD).
 * - `stat`: in battle, always on. `negate` makes `v` a penalty; `extra` adds a fixed second line.
 * - `factionAllies`: per other deployed ally of the unit's faction, up to `cap` times.
 * - `classAlly`: on while another deployed ally of `allyClass` is in the lineup.
 * - `classAllyDmg`: the same gate; `role: attack` = more damage to `vs`, `defend` = less from `vs`.
 * - `alive`: on while the living units of its side (itself included) are ≥ `atLeast` / < `below`.
 * - `event`: a trigger — a buff, a heal (share of max HP) or a hit (share of its lost HP).
 */
export type PotentialEffect =
  | { kind: 'stat'; field: CombatField; mult?: boolean; negate?: boolean; extra?: { field: CombatField; add: number } }
  | { kind: 'factionAllies'; field: CombatField; mult?: boolean; cap: number }
  | { kind: 'classAlly'; allyClass: WildClass; field: CombatField; mult?: boolean }
  | { kind: 'classAllyDmg'; allyClass: WildClass; role: 'attack' | 'defend'; vs: WildClass }
  | { kind: 'alive'; atLeast?: number; below?: number; field: CombatField }
  | {
      kind: 'event';
      on: PotentialEvent;
      /** `onHit` only: the hit came from this skill slot. */
      hitBy?: SkillSlot;
      target: 'self' | 'event' | 'allies';
      act: 'buff' | 'heal' | 'damage';
      field?: CombatField;
      negate?: boolean;
      maxStacks?: number;
      /** the holder's own turns (2 after its own action = "until its next action"; 1 when hit) */
      turns?: number;
      bigRounds?: number;
      /** at most this many activations per big round */
      perTurn?: number;
    };

export interface PotentialOption {
  /** The source's skill group (e.g. 50102 = tier 1, option 2). */
  id: number;
  name: string;
  tier: number;
  /** Level 1 … 6 values. */
  values: number[];
  effect: PotentialEffect;
  /** The game's description (English, written from the Chinese text). */
  text: string;
}

export interface PotentialSpecies {
  /** Nine tiers × three option ids, in panel order. */
  tiers: number[][];
  /** Nine tiers of fodder lines. */
  fodder: FodderReq[][];
  /** Whether a Potential Core may stand in for one Pokémon of a line (tiers 5–9). */
  core: boolean;
}

export interface PotentialTable {
  /** Stars that unlock tier 1 … 9 (7 … 15). */
  unlockStars: number[];
  /** Per tier: [unlock, Lv1→2, Lv2→3, Lv3→4, Lv4→5, Lv5→6] Potential Shards. */
  costs: number[][];
  maxLevel: number;
  /** Diamonds for a full reset. */
  resetGems: number;
  options: PotentialOption[];
  species: Record<string, PotentialSpecies>;
}

/** One unlocked tier: the option slot (0–2) and its level (1–6). */
export interface PotentialPick {
  option: number;
  lv: number;
}

/** A Pokémon's Potential: nine tiers (null = locked) plus what was paid, for a reset. */
export interface PotentialState {
  picks: (PotentialPick | null)[];
  spent: { shards: number; cores: number; fodder: { speciesId: string; stars: number }[] };
}

/** Who else is in the lineup (for the faction / class options). */
export interface PotentialTeam {
  faction: Faction;
  allies: { faction: Faction; className: WildClass }[];
}
