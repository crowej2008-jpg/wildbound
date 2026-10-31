import type { Tier, WildClass } from '../model';
import type {
  EquipmentTuning,
  Loadout,
  RelicDef,
  RuneInstance,
  TalentTreeDef,
} from './types';

/**
 * Equipment rules (M7): unlock gates, equip validation, action costs and pure
 * loadout transitions. The server calls these; the client mirrors the gates to
 * show requirements. See docs/design/equipment.md.
 */

const TIER_ORDER: readonly Tier[] = ['common', 'rare', 'epic', 'legendary', 'supreme', 'mythic', 'origin'];

export function tierRankOf(tier: Tier): number {
  const i = TIER_ORDER.indexOf(tier);
  return i < 0 ? 0 : i;
}

export function tierAtLeast(tier: Tier, min: Tier): boolean {
  return tierRankOf(tier) >= tierRankOf(min);
}

export function relicUnlocked(wildTier: Tier, tuning: EquipmentTuning): boolean {
  return tierAtLeast(wildTier, tuning.relic.minTier);
}

export function runesUnlocked(stars: number, tuning: EquipmentTuning): boolean {
  return stars >= tuning.runes.minStars;
}

export function charmsUnlocked(stars: number, tuning: EquipmentTuning): boolean {
  return stars >= tuning.charms.minStars;
}

export function coresUnlocked(stars: number, tuning: EquipmentTuning): boolean {
  return stars >= tuning.cores.minStars;
}

export function talentsUnlocked(wildTier: Tier, tuning: EquipmentTuning): boolean {
  return tierAtLeast(wildTier, tuning.talents.minTier);
}

/** A relic fits when the Wild's class matches and the Wild is high enough tier. */
export function canEquipRelic(def: RelicDef, wildClass: WildClass, wildTier: Tier, tuning: EquipmentTuning): boolean {
  return def.className === wildClass && relicUnlocked(wildTier, tuning);
}

export function runeLevelCost(level: number, tuning: EquipmentTuning): { gold: number } {
  const { gold, goldPerLevel } = tuning.runeLevelCost;
  return { gold: Math.round(gold + goldPerLevel * Math.max(0, level - 1)) };
}

export function equipRelic(loadout: Loadout, instanceId: string | null): Loadout {
  return { ...loadout, relic: instanceId };
}

export function equipRune(loadout: Loadout, socket: number, instanceId: string | null): Loadout {
  const runes = [...loadout.runes];
  if (socket >= 0 && socket < runes.length) runes[socket] = instanceId;
  return { ...loadout, runes };
}

export function equipCore(loadout: Loadout, socket: number, instanceId: string | null): Loadout {
  const cores = [...loadout.cores];
  if (socket >= 0 && socket < cores.length) cores[socket] = instanceId;
  return { ...loadout, cores };
}

export function equipCharm(loadout: Loadout, slot: number, charmId: string | null): Loadout {
  const charms = [...loadout.charms];
  if (slot >= 0 && slot < charms.length) charms[slot] = charmId;
  return { ...loadout, charms };
}

export function chooseTree(loadout: Loadout, treeId: string | null, tuning: EquipmentTuning): Loadout {
  return { ...loadout, treeId, talents: Array.from({ length: tuning.talents.tiers }, () => -1) };
}

/**
 * Allocation is sequential: a tier can only be picked once every earlier tier has a
 * choice, mirroring the reference's potential ladder.
 */
export function canAllocateTalent(
  loadout: Loadout,
  tree: TalentTreeDef,
  tier: number,
  option: number,
  tuning: EquipmentTuning,
): boolean {
  if (tree.id !== loadout.treeId) return false;
  if (tier < 0 || tier >= tuning.talents.tiers) return false;
  if (tier >= tree.tiers.length) return false;
  if (option < 0 || option >= tuning.talents.optionsPerTier) return false;
  if (option >= tree.tiers[tier]!.length) return false;
  for (let i = 0; i < tier; i += 1) if ((loadout.talents[i] ?? -1) < 0) return false;
  return true;
}

/** Choose `option` on `tier`; later tiers are cleared (the ladder restarts there). */
export function allocateTalent(loadout: Loadout, tier: number, option: number, _tuning: EquipmentTuning): Loadout {
  const talents = [...loadout.talents];
  for (let i = tier; i < talents.length; i += 1) talents[i] = -1;
  talents[tier] = option;
  return { ...loadout, talents };
}

/** A newly socketed rune never needs an instance to exist yet. */
export function runeAt(loadout: Loadout, socket: number): string | null {
  return loadout.runes[socket] ?? null;
}

export function coreAt(loadout: Loadout, socket: number): string | null {
  return loadout.cores[socket] ?? null;
}

/** Whether a rune instance is already socketed anywhere in this loadout. */
export function runeEquipped(loadout: Loadout, instanceId: string): boolean {
  return loadout.runes.some((id) => id === instanceId);
}

export function coreEquipped(loadout: Loadout, instanceId: string): boolean {
  return loadout.cores.some((id) => id === instanceId);
}

export function socketOf(rune: RuneInstance): string {
  return rune.id;
}
