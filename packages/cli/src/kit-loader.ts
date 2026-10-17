import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { kitSchema, type KitJson } from '@wildbound/content';
import type { BuffSpec, CombatField, Effect, KitDef, SkillDef, SkillSlot } from '@wildbound/engine';

/**
 * Loads every skill-kit in packages/content/kits and converts the content
 * DSL (schema in packages/content/src/schemas.ts) into the engine's KitDef.
 * The engine itself never reads the filesystem; the CLI is the adapter.
 */

interface ContentBuffSpec {
  tag: string;
  kind?: 'stat' | 'immune' | 'regen' | 'stack';
  field?: CombatField;
  amount?: number;
  turns?: number;
  bigRounds?: number;
  maxStacks?: number;
  undispellable?: boolean;
  scalesWithLevel?: [number, number][];
}

/** Content buff specs default to a stat buff when no kind is given. */
function withKind(b: ContentBuffSpec): BuffSpec {
  return { ...b, kind: b.kind ?? 'stat' };
}

type ContentEffect = NonNullable<KitJson['skills']['normal']['effects']>[number];

function toEngineEffect(e: ContentEffect): Effect {
  if (e.op === 'buff') return { ...e, buff: withKind(e.buff) };
  return e;
}

function toEngineSkill(slot: SkillSlot, s: KitJson['skills'][SkillSlot]): SkillDef {
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
    talents: j.talents,
    hooksConfig: j.hooksConfig,
  };
}

/** Read + validate + convert every kit under the given kits dir. A file may
 * hold a single kit object (M1) or an array of kits (M2, one file per faction). */
export function loadKits(kitsDir: string): KitDef[] {
  const out: KitDef[] = [];
  for (const file of readdirSync(kitsDir)) {
    if (!file.endsWith('.json')) continue;
    const parsed: unknown = JSON.parse(readFileSync(resolve(kitsDir, file), 'utf8'));
    const raws = Array.isArray(parsed) ? parsed : [parsed];
    for (const raw of raws) out.push(kitToEngine(kitSchema.parse(raw)));
  }
  return out;
}
