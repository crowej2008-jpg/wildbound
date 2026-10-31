import type {
  BuffSpec,
  CombatField,
  Effect,
  KitDef,
  SkillDef,
  SkillSlot,
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
  };
}
