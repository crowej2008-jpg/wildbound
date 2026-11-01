import type { KitDef, PlateSkillDef, SkillRow } from './types';

/**
 * E4: an Origin's skill levels. Rows at LV.1 keep the kit as written; a row at LV.2 / LV.3 swaps in
 * that level's skill (ult / basic) and replaces every trigger and damage modifier of its group.
 * Pure: returns a new kit.
 */
export type SkillLevels = Partial<Record<SkillRow, number>>;

export function applySkillLevels(kit: KitDef, levels: SkillLevels | undefined): KitDef {
  if (!kit.levels || !levels) return kit;
  let out: KitDef = kit;
  for (const row of ['ult', 'basic', 'passive', 'talent4'] as const) {
    const lv = Math.min(3, Math.max(1, Math.floor(levels[row] ?? 1)));
    if (lv < 2) continue;
    const def = kit.levels[row]?.[String(lv) as '2' | '3'];
    if (!def) continue;
    const skills = def.skill && (row === 'ult' || row === 'basic') ? { ...out.skills, [row]: def.skill } : out.skills;
    const talents = { ...(out.talents ?? {}) };
    if (def.triggers) talents.triggers = [...(talents.triggers ?? []).filter((t) => t.group !== row), ...def.triggers];
    if (def.damageMods) talents.damageMods = [...(talents.damageMods ?? []).filter((m) => m.group !== row), ...def.damageMods];
    out = { ...out, skills, talents };
  }
  return out;
}

/**
 * R6a: a Pokémon's plate skills — every tier at or below its plate stage (6 / 12 / 18), in order. A tier
 * can replace skills, drop trigger / damage-mod groups, and add triggers, damage mods and stat mods.
 */
export function applyPlateSkills(kit: KitDef, stage: number): KitDef {
  if (!kit.plate || stage < 6) return kit;
  let out: KitDef = kit;
  for (const tier of ['6', '12', '18'] as const) {
    if (stage < Number(tier)) break;
    const def = kit.plate[tier];
    if (def) out = applySkillDef(out, def);
  }
  return out;
}

/**
 * R6b: a Pokémon's exclusive-trinket skill — only the highest tier at or below its trinket level
 * (10 / 20 / 30 / 40: I–IV of one skill, each replacing the one below).
 */
export function applyTrinketSkills(kit: KitDef, level: number): KitDef {
  if (!kit.trinket || level < 10) return kit;
  for (const tier of ['40', '30', '20', '10'] as const) {
    if (level < Number(tier)) continue;
    const def = kit.trinket[tier];
    return def ? applySkillDef(kit, def) : kit;
  }
  return kit;
}

/** One plate / trinket skill on a kit: replace skills, drop groups, add triggers / damage mods / stat mods. */
function applySkillDef(kit: KitDef, def: PlateSkillDef): KitDef {
  const drop = new Set(def.dropGroups ?? []);
  const talents = { ...(kit.talents ?? {}) };
  talents.triggers = [...(talents.triggers ?? []).filter((t) => !t.group || !drop.has(t.group)), ...(def.triggers ?? [])];
  talents.damageMods = [...(talents.damageMods ?? []).filter((m) => !m.group || !drop.has(m.group)), ...(def.damageMods ?? [])];
  talents.statMods = [...(talents.statMods ?? []), ...(def.statMods ?? [])];
  return {
    ...kit,
    skills: { ...kit.skills, ...(def.skills ?? {}) },
    talents,
    ...(def.counterShare !== undefined ? { counterShare: def.counterShare } : {}),
  };
}
