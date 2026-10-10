import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { kitSchema, type KitJson } from '@wildbound/content';
import type { BuffSpec, CombatField, KitDef, SkillDef, SkillSlot } from '@wildbound/engine';

/**
 * Loads every skill-kit in packages/content/kits and converts the content
 * DSL (schema in packages/content/src/schemas.ts) into the engine's KitDef.
 * The engine itself never reads the filesystem; the CLI is the adapter.
 */

interface ContentBuffSpec {
  tag: string;
  field?: CombatField;
  amount?: number;
  turns?: number;
  bigRounds?: number;
  maxStacks?: number;
}

/** Content buff specs ('field' => a stat buff) get their kind from the field. */
function withKind(b: ContentBuffSpec): BuffSpec {
  return { ...b, kind: 'stat' };
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
  };
}

export function kitToEngine(j: KitJson): KitDef {
  return {
    id: j.id,
    name: j.name,
    faction: j.faction,
    class: j.class,
    tier: j.tier,
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

/** Read + validate + convert every kit file under the given kits dir. */
export function loadKits(kitsDir: string): KitDef[] {
  const out: KitDef[] = [];
  for (const file of readdirSync(kitsDir)) {
    if (!file.endsWith('.json')) continue;
    const j = kitSchema.parse(JSON.parse(readFileSync(resolve(kitsDir, file), 'utf8')));
    out.push(kitToEngine(j));
  }
  return out;
}