import type {
  BuffSpec,
  CombatField,
  Effect,
  KitDef,
  PlateSkillDef,
  SkillDef,
  SkillSlot,
  StatMod,
  TalentDef,
  TriggerDef,
} from '@wildbound/engine';
import type { KitJson } from './schemas';

/**
 * The canonical content→engine kit adapter (M9.4). It lives in `@wildbound/content`
 * so both the CLI (validator / kit loader) and the server (battle setup) convert
 * kits identically — a browser-safe, filesystem-free pure function that only
 * imports engine *types*.
 */

interface ContentBuffSpec {
  tag: string;
  kind?: BuffSpec['kind'];
  field?: CombatField;
  amount?: number;
  turns?: number;
  bigRounds?: number;
  maxStacks?: number;
  undispellable?: boolean;
  scalesWithLevel?: [number, number][];
}

/** Content buff specs default to a stat buff when no kind is given. */
export function withKind(b: ContentBuffSpec): BuffSpec {
  return { ...b, kind: b.kind ?? 'stat' };
}

type ContentSkill = KitJson['skills'][SkillSlot];
type ContentEffect = NonNullable<ContentSkill['effects']>[number];
type ContentTalent = NonNullable<KitJson['talents']>;
type ContentTrigger = NonNullable<ContentTalent['triggers']>[number];

function toEngineEffect(e: ContentEffect): Effect {
  if (e.op === 'buff') return { ...e, buff: withKind(e.buff) };
  return e;
}

export function toEngineTrigger(t: ContentTrigger): TriggerDef {
  return {
    ...t,
    buff: t.buff ? withKind(t.buff) : undefined,
    effects: t.effects?.map(toEngineEffect),
  };
}

function toEngineTalent(t: ContentTalent): TalentDef {
  return {
    ...t,
    triggers: t.triggers?.map(toEngineTrigger),
  };
}

function toEngineSkill(slot: SkillSlot, s: ContentSkill): SkillDef {
  return {
    slot,
    type: s.type,
    rates: s.rates,
    rule: s.rule,
    targets: s.targets,
    damageType: s.damageType,
    hpShare: s.hpShare,
    control: s.control,
    selfBuffs: s.selfBuffs?.map(withKind),
    targetDebuffs: s.targetDebuffs?.map(withKind),
    counter: s.counter,
    heal: s.heal,
    shield: s.shield,
    lifesteal: s.lifesteal,
    side: s.side,
    rowFilter: s.rowFilter,
    filters: s.filters,
    hasTag: s.hasTag,
    hpShareBasis: s.hpShareBasis,
    trueDamage: s.trueDamage,
    ignoreShield: s.ignoreShield,
    ignoreDefense: s.ignoreDefense,
    dot: s.dot,
    bonusVs: s.bonusVs,
    recastOnKill: s.recastOnKill,
    condition: s.condition,
    effects: s.effects?.map(toEngineEffect),
  };
}

type ContentLevels = NonNullable<KitJson['levels']>;

/** E4: convert an Origin's level rows (skills and triggers need the same mapping as the kit's). */
function toEngineLevels(levels: ContentLevels): NonNullable<KitDef['levels']> {
  const out: NonNullable<KitDef['levels']> = {};
  for (const [row, def] of Object.entries(levels) as [keyof ContentLevels, NonNullable<ContentLevels[keyof ContentLevels]>][]) {
    const conv = (lv: '2' | '3') => {
      const d = def[lv];
      if (!d) return undefined;
      const slot: SkillSlot = row === 'basic' ? 'basic' : 'ult';
      return {
        ...(d.skill ? { skill: toEngineSkill(slot, d.skill) } : {}),
        ...(d.triggers ? { triggers: d.triggers.map(toEngineTrigger) } : {}),
        ...(d.damageMods ? { damageMods: d.damageMods } : {}),
      };
    };
    out[row] = { name: def.name, text: def.text, '2': conv('2'), '3': conv('3') };
  }
  return out;
}

type ContentPlate = NonNullable<KitJson['plate']>;

/** R6a: convert a kit's plate skills (skills and triggers need the kit's own mapping). */
function toEnginePlate<K extends string>(plate: Partial<Record<K, NonNullable<ContentPlate['6']>>>): Partial<Record<K, PlateSkillDef>> {
  const out: Partial<Record<K, PlateSkillDef>> = {};
  for (const [tier, d] of Object.entries(plate) as [K, NonNullable<ContentPlate['6']>][]) {
    const skills: Partial<Record<SkillSlot, SkillDef>> = {};
    for (const [slot, s] of Object.entries(d.skills ?? {}) as [SkillSlot, NonNullable<ContentSkill>][]) skills[slot] = toEngineSkill(slot, s);
    out[tier] = {
      text: d.text,
      ...(d.skills ? { skills } : {}),
      ...(d.triggers ? { triggers: d.triggers.map(toEngineTrigger) } : {}),
      ...(d.damageMods ? { damageMods: d.damageMods } : {}),
      ...(d.statMods ? { statMods: d.statMods as StatMod[] } : {}),
      ...(d.dropGroups ? { dropGroups: d.dropGroups } : {}),
      ...(d.counterShare !== undefined ? { counterShare: d.counterShare } : {}),
    };
  }
  return out;
}

/** Convert one validated content kit into the engine's `KitDef`. */
export function kitToEngine(j: KitJson): KitDef {
  return {
    id: j.id,
    name: j.name,
    faction: j.faction,
    class: j.class,
    tier: j.tier,
    traits: j.traits,
    skills: {
      normal: toEngineSkill('normal', j.skills.normal),
      basic: toEngineSkill('basic', j.skills.basic),
      ult: toEngineSkill('ult', j.skills.ult),
    },
    counterShare: j.counterShare,
    talents: j.talents ? toEngineTalent(j.talents) : undefined,
    hooksConfig: j.hooksConfig,
    ...(j.levels ? { levels: toEngineLevels(j.levels) } : {}),
    ...(j.plate ? { plate: toEnginePlate(j.plate) } : {}),
    ...(j.trinket ? { trinket: toEnginePlate(j.trinket) } : {}),
  };
}
