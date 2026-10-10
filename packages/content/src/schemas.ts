import { z } from 'zod';

/**
 * Zod schemas for the skill-kit DSL (PROMPT §6.7) and combat settings
 * (Appendix A). The engine consumes plain JSON; the CLI validator parses every
 * file under packages/content against these before a milestone ships.
 */

export const factionSchema = z.enum(['ember', 'tide', 'grove', 'volt', 'frost', 'shade']);
export const classSchema = z.enum(['striker', 'guardian', 'adept']);
export const tierSchema = z.enum(['common', 'rare', 'epic', 'legendary', 'supreme', 'mythic']);
export const skillSlotSchema = z.enum(['normal', 'basic', 'ult']);
export const targetRuleSchema = z.enum(['column', 'row', 'all', 'lowest_hp', 'random', 'self']);

const combatFieldSchema = z.enum([
  'hp',
  'pAtk',
  'sAtk',
  'spd',
  'dmgBoost',
  'dmgRdct',
  'pvpBoost',
  'pvpRdct',
  'ultBoost',
  'ultRed',
  'skillBoost',
  'skillRed',
  'crit',
  'critRes',
  'critPower',
  'block',
  'blockPower',
  'guardBreak',
  'controlBoost',
  'controlRes',
  'healBoost',
  'receiveHealBoost',
  'counterBoost',
  'spiritAtk',
  'spiritDef',
]);

const buffSpecSchema = z
  .object({
    tag: z.string().min(1),
    field: combatFieldSchema.optional(),
    amount: z.number().optional(),
    turns: z.number().int().positive().optional(),
    bigRounds: z.number().int().positive().optional(),
    maxStacks: z.number().int().positive().optional(),
  })
  .strict();

const controlSchema = z
  .object({
    kind: z.string().min(1),
    /** null == guaranteed (bypasses Control Res; only immunity stops it). */
    chance: z.number().min(0).max(1).nullable(),
    turns: z.number().int().positive().optional(),
  })
  .strict();

const skillSchema = z
  .object({
    type: z.enum(['P', 'S']),
    rates: z.array(z.number()).min(1),
    rule: targetRuleSchema,
    targets: z.number().int().positive().optional(),
    damageType: z.enum(['hpShare', 'dot']).optional(),
    hpShare: z.number().min(0).max(1).optional(),
    control: controlSchema.optional(),
    selfBuffs: z.array(buffSpecSchema).optional(),
    targetDebuffs: z.array(buffSpecSchema).optional(),
    counter: z.boolean().optional(),
    heal: z
      .object({ target: z.enum(['ally', 'self', 'allies']), rate: z.number().min(0) })
      .strict()
      .optional(),
    shield: z
      .object({ target: z.enum(['ally', 'self', 'allies']), share: z.number().min(0) })
      .strict()
      .optional(),
    lifesteal: z.number().min(0).max(1).optional(),
  })
  .strict()
  .refine((s) => s.damageType !== 'hpShare' || s.hpShare !== undefined, {
    message: 'damageType hpShare requires hpShare',
  });

const statModSchema = z
  .object({ field: combatFieldSchema, mult: z.number().optional(), add: z.number().optional() })
  .strict()
  .refine((m) => m.mult !== undefined || m.add !== undefined, { message: 'statMod needs mult and/or add' });

const talentSchema = z
  .object({
    statMods: z.array(statModSchema).optional(),
    rageOnHit: z.number().int().optional(),
    rageCutChance: z.number().min(0).max(1).optional(),
    safeguard: z
      .object({ active: z.number().int().positive(), cycle: z.number().int().positive() })
      .strict()
      .optional(),
    turnHooks: z.array(z.enum(['allyShelterStack'])).optional(),
  })
  .strict();

export const kitSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    faction: factionSchema,
    class: classSchema,
    tier: tierSchema,
    skills: z.object({
      normal: skillSchema,
      basic: skillSchema,
      ult: skillSchema,
    }),
    counterShare: z.number().min(0).max(1).optional(),
    talents: talentSchema.optional(),
    hooksConfig: z.record(z.string(), z.record(z.string(), z.union([z.string(), z.number()]))).optional(),
  })
  .strict();

export const combatSettingsSchema = z
  .object({
    mode: z.enum(['pvp', 'pve']),
    maxRounds: z.number().int().positive(),
    gFloor: z.number(),
    pFloor: z.number(),
    pvpConst: z.number(),
    soulCap: z.number(),
    soulHalf: z.number(),
    critFloor: z.number().min(0).max(1),
    critSlope: z.number(),
    critBaseMult: z.number(),
    blockPoints: z.array(z.tuple([z.number(), z.number()])),
    blockKeep: z.number().min(0).max(1),
    blockIntScale: z.number(),
    tpThreshold: z.number().min(0).max(1),
    tpSymmetric: z.boolean(),
    classMult: z.record(z.string(), z.number()),
    weatherDefault: z.number(),
    basicReplace: z.number().min(0).max(1),
    rageStart: z.number(),
    rageStrikerStart: z.number(),
    rageMax: z.number(),
    ragePerAction: z.number(),
    rageHitBase: z.number(),
    rageHitScale: z.number(),
    ultRageCost: z.number(),
    counterShare: z.number().min(0).max(1),
    tieBreak: z.literal('attackersFirst'),
    buffTickTiming: z.literal('ownTurnEnd'),
    defendersUseDef: z.boolean(),
    healBasis: z.enum(['targetMaxHp', 'casterAtk']),
    shieldCountsForRage: z.boolean(),
    redirectChance: z.number().min(0).max(1),
  })
  .strict();

export type KitJson = z.infer<typeof kitSchema>;
export type CombatSettingsJson = z.infer<typeof combatSettingsSchema>;