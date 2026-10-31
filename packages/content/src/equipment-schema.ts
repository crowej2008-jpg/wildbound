import { z } from 'zod';

/**
 * Equipment content schemas (M7). Shapes mirror the engine's `equipment/types.ts`
 * interfaces; the content package stays dependency-free from the engine.
 */

export const TIERS = ['common', 'rare', 'epic', 'legendary', 'supreme', 'mythic'] as const;
export const CLASSES = ['striker', 'guardian', 'adept'] as const;
export const FACTIONS = ['water', 'fire', 'grass', 'light', 'dark'] as const;

export const CORE_FIELDS = ['hp', 'pAtk', 'sAtk', 'spd', 'pDef', 'sDef'] as const;
export const SOUL_FIELDS = ['spiritAtk', 'spiritDef'] as const;
export const PERCENT_FIELDS = [
  'hpPct',
  'pAtkPct',
  'sAtkPct',
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
] as const;

/** Every field a conditional effect may target (matches engine `CombatField`). */
export const COMBAT_FIELDS = [
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
] as const;

export const statLineSchema = z
  .object({
    kind: z.enum(['core', 'percent', 'soul']),
    field: z.string().min(1),
    base: z.number(),
    perLevel: z.number(),
  })
  .superRefine((line, ctx) => {
    const allowed: readonly string[] =
      line.kind === 'core' ? CORE_FIELDS : line.kind === 'percent' ? PERCENT_FIELDS : SOUL_FIELDS;
    if (!allowed.includes(line.field)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `field "${line.field}" is not a ${line.kind} field` });
    }
  });

export const effectSchema = z.object({
  tag: z.string().min(1),
  text: z.string().min(1),
  field: z.enum(COMBAT_FIELDS),
  add: z.number().optional(),
  mult: z.number().optional(),
  fromRound: z.number().int().min(1),
  bigRounds: z.number().int().min(1).optional(),
});

export const relicsSchema = z.object({
  relics: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      className: z.enum(CLASSES),
      tier: z.enum(TIERS),
      lines: z.array(statLineSchema).min(1),
      effect: effectSchema,
    }),
  ),
});

export const platesSchema = z.object({
  plates: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      faction: z.enum(FACTIONS),
      lines: z.array(statLineSchema).min(1),
    }),
  ),
});

export const trinketsSchema = z.object({
  trinkets: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      speciesId: z.string().min(1),
      lines: z.array(statLineSchema).min(1),
    }),
  ),
});

export const runesSchema = z.object({
  runes: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      setId: z.string().min(1),
      tier: z.enum(TIERS),
      lines: z.array(statLineSchema).min(1),
    }),
  ),
  sets: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      bonuses: z
        .array(
          z.object({
            pieces: z.number().int().min(1),
            lines: z.array(statLineSchema).min(1),
          }),
        )
        .min(1),
    }),
  ),
});

export const charmsSchema = z.object({
  charms: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      tier: z.enum(['common', 'basic', 'intermediate', 'greater']),
      maxStars: z.number().int().min(0).max(5),
      lines: z.array(statLineSchema).min(1),
    }),
  ),
});

const soulheartSchema = z
  .object({
    text: z.string().min(1),
    lifesteal: z.number().min(0).max(1).optional(),
    shieldDmgBonus: z.number().min(0).optional(),
    shieldedDmgBonus: z.number().min(0).optional(),
    punctureEvery: z.number().int().min(1).optional(),
    controlImmunityEvery: z.number().int().min(1).optional(),
    roundHeal: z
      .object({ rounds: z.array(z.number().int().min(1)).min(1), rate: z.number().min(0).max(1) })
      .optional(),
    onHitHeal: z.object({ chance: z.number().min(0).max(1), rate: z.number().min(0).max(1) }).optional(),
    turnHeal: z.number().min(0).max(1).optional(),
    paralysisChance: z.number().min(0).max(1).optional(),
    startShield: z.number().min(0).max(1).optional(),
    overhealShield: z.number().min(0).max(1).optional(),
    startDmgRdct: z.number().min(0).max(1).optional(),
    firstRoundSpiritDefMult: z.number().min(1).optional(),
    firstRoundDmgRdct: z.number().min(0).max(1).optional(),
    spiritAtkMult: z.number().min(1).optional(),
    spiritDefMult: z.number().min(1).optional(),
    sAtkMult: z.number().min(1).optional(),
  })
  .strict();

export const coresSchema = z.object({
  sets: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      socketLines: z.array(z.array(statLineSchema).min(1)).length(6),
      bonuses: z.array(
        z.object({
          pieces: z.number().int().min(1).max(6),
          lines: z.array(statLineSchema),
          effect: effectSchema.optional(),
          text: z.string().min(1).optional(),
          soulheart: soulheartSchema.optional(),
        }),
      ),
    }),
  ),
});

export const talentsSchema = z.object({
  blocks: z.array(
    z.object({
      id: z.string().min(1),
      text: z.string().min(1),
      lines: z.array(statLineSchema),
      effect: effectSchema.optional(),
    }),
  ),
  trees: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      className: z.enum(CLASSES),
      tiers: z.array(z.array(z.string().min(1)).length(3)).length(9),
    }),
  ),
});

export const equipmentTuningSchema = z.object({
  relic: z.object({ minTier: z.enum(TIERS), maxLevel: z.number().int().min(1), maxRefine: z.number().int().min(0) }),
  runes: z.object({ minStars: z.number().int().min(0), sockets: z.number().int().min(1), maxLevel: z.number().int().min(1) }),
  charms: z.object({ minStars: z.number().int().min(0), slots: z.number().int().min(1) }),
  cores: z.object({
    minStars: z.number().int().min(0),
    sockets: z.number().int().min(1),
    pieceMinStars: z.number().int().min(1),
    pieceMaxStars: z.number().int().min(1),
  }),
  talents: z.object({
    minTier: z.enum(TIERS),
    tiers: z.number().int().min(1),
    optionsPerTier: z.number().int().min(1),
    resetGems: z.number().int().min(0),
    allocateGold: z.number().int().min(0),
  }),
  relicLevelCost: z.object({ shards: z.number(), shardsPerLevel: z.number() }),
  relicRefineCost: z.object({ gold: z.number(), shards: z.number(), goldPerRefine: z.number(), shardsPerRefine: z.number() }),
  runeLevelCost: z.object({ gold: z.number(), goldPerLevel: z.number() }),
  starting: z.object({
    relics: z.array(z.object({ defId: z.string(), level: z.number().int().min(1), refine: z.number().int().min(0) })),
    runes: z.array(z.object({ defId: z.string(), level: z.number().int().min(1) })),
    cores: z.array(z.object({ setId: z.string(), socket: z.number().int().min(0), stars: z.number().int().min(1) })),
    charms: z.array(z.object({ defId: z.string(), stars: z.number().int().min(1), count: z.number().int().min(1) })),
  }),
});

export type RelicJson = z.infer<typeof relicsSchema>['relics'][number];
export type PlateJson = z.infer<typeof platesSchema>['plates'][number];
export type TrinketJson = z.infer<typeof trinketsSchema>['trinkets'][number];
export type RuneJson = z.infer<typeof runesSchema>['runes'][number];
export type RuneSetJson = z.infer<typeof runesSchema>['sets'][number];
export type CharmJson = z.infer<typeof charmsSchema>['charms'][number];
export type CoreSetJson = z.infer<typeof coresSchema>['sets'][number];
export type TalentBlockJson = z.infer<typeof talentsSchema>['blocks'][number];
export type TalentTreeJson = z.infer<typeof talentsSchema>['trees'][number];
export type EquipmentTuningJson = z.infer<typeof equipmentTuningSchema>;
