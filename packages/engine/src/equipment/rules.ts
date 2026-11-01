import type { Tier, WildClass } from '../model';
import type {
  CoreInstance,
  EquipmentTuning,
  Loadout,
  RelicDef,
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

export function charmsUnlocked(stars: number, tuning: EquipmentTuning): boolean {
  return stars >= tuning.charms.minStars;
}

export function coresUnlocked(stars: number, tuning: EquipmentTuning): boolean {
  return stars >= tuning.cores.minStars;
}


/** A relic fits when the Wild's class matches and the Wild is high enough tier. */
export function canEquipRelic(def: RelicDef, wildClass: WildClass, wildTier: Tier, tuning: EquipmentTuning): boolean {
  return def.className === wildClass && relicUnlocked(wildTier, tuning);
}

export function equipRelic(loadout: Loadout, instanceId: string | null): Loadout {
  return { ...loadout, relic: instanceId };
}

export function equipOrb(loadout: Loadout, socket: number, instanceId: string | null): Loadout {
  const orbs = [...loadout.orbs];
  if (socket >= 0 && socket < orbs.length) orbs[socket] = instanceId;
  return { ...loadout, orbs };
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


export function coreAt(loadout: Loadout, socket: number): string | null {
  return loadout.cores[socket] ?? null;
}


export function coreEquipped(loadout: Loadout, instanceId: string): boolean {
  return loadout.cores.some((id) => id === instanceId);
}


/** R6c: a Soul-heart's star cap by quality. */
export function coreMaxStars(core: CoreInstance, tuning: EquipmentTuning): number {
  return tuning.cores.qualityStars[core.quality] ?? 0;
}

/** R6c: Soul-heart EXP for the next star (null at the cap). */
export function coreStarCost(core: CoreInstance, tuning: EquipmentTuning): number | null {
  if (core.stars >= coreMaxStars(core, tuning)) return null;
  return tuning.cores.starExp[core.quality]?.[core.stars] ?? null;
}
