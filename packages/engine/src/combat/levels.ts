import type { KitDef, SkillRow } from './types';

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
