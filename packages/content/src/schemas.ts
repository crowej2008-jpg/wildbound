import { z } from 'zod';

/**
 * Zod schemas for the skill-kit DSL (PROMPT §6.7), species/Power/growth tuning
 * (M2), account/stage/quest/economy data (M3/M5) and combat settings
 * (Appendix A). The engine consumes plain JSON; the CLI validator parses every
 * file under packages/content against these before a milestone ships.
 */

export const factionSchema = z.enum(['ember', 'tide', 'grove', 'volt', 'frost', 'shade']);
export const classSchema = z.enum(['striker', 'guardian', 'adept']);
export const tierSchema = z.enum(['common', 'rare', 'epic', 'legendary', 'supreme', 'mythic']);
export const skillSlotSchema = z.enum(['normal', 'basic', 'ult']);
export const targetRuleSchema = z.enum([
  'column',
  'row',
  'all',
  'lowest_hp',
  'highest_hp',
  'highest_atk',
  'highest_spd',
  'random',
  'frontline',
  'backline',
  'same_position',
  'adjacent',
  'self',
]);
export const targetSideSchema = z.enum(['enemy', 'ally']);
export const targetRowSchema = z.enum(['front', 'back']);
export const targetFilterSchema = z.enum(['dot', 'controlled', 'debuffed']);

const conditionSchema = z
  .object({
    selfHpBelow: z.number().min(0).max(1).optional(),
    selfHpAbove: z.number().min(0).max(1).optional(),
    targetHpBelow: z.number().min(0).max(1).optional(),
    targetHpAbove: z.number().min(0).max(1).optional(),
    selfHasTag: z.string().min(1).optional(),
    targetHasTag: z.string().min(1).optional(),
    selfStackAtLeast: z.object({ tag: z.string().min(1), n: z.number().int().positive() }).strict().optional(),
    targetStackAtLeast: z.object({ tag: z.string().min(1), n: z.number().int().positive() }).strict().optional(),
    targetControlled: z.boolean().optional(),
    targetHasDot: z.boolean().optional(),
    allyUnderControl: z.boolean().optional(),
    targetRow: targetRowSchema.optional(),
    targetTrait: z.string().min(1).optional(),
  })
  .strict();

const dotSpecSchema = z
  .object({
    share: z.number().min(0),
    basis: z.enum(['targetMaxHp', 'casterAtk', 'targetCurrentHp']).optional(),
    type: z.enum(['P', 'S']).optional(),
    turns: z.number().int().positive().optional(),
    maxStacks: z.number().int().positive().optional(),
    undispellable: z.boolean().optional(),
    trueDamage: z.boolean().optional(),
  })
  .strict();

const targetSelSchema = z
  .object({
    side: targetSideSchema.optional(),
    rule: targetRuleSchema.optional(),
    n: z.number().int().positive().optional(),
    rowFilter: targetRowSchema.optional(),
    filters: z.array(targetFilterSchema).optional(),
    condition: conditionSchema.optional(),
  })
  .strict();

const combatFieldSchema = z.enum([
  'hp',
  'pAtk',
  'sAtk',
  'spd',
  'pDef',
  'sDef',
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
    kind: z.enum(['stat', 'immune', 'regen', 'stack', 'taunt']).optional(),
    field: combatFieldSchema.optional(),
    amount: z.number().optional(),
    turns: z.number().int().positive().optional(),
    bigRounds: z.number().int().positive().optional(),
    maxStacks: z.number().int().positive().optional(),
    undispellable: z.boolean().optional(),
    scalesWithLevel: z.array(z.tuple([z.number().int().positive(), z.number()])).optional(),
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

const effectSchema = z.discriminatedUnion('op', [
  z
    .object({ op: z.literal('buff'), target: targetSelSchema, buff: buffSpecSchema, condition: conditionSchema.optional(), chance: z.number().min(0).max(1).optional() })
    .strict(),
  z
    .object({ op: z.literal('dot'), target: targetSelSchema, dot: dotSpecSchema, condition: conditionSchema.optional(), chance: z.number().min(0).max(1).optional() })
    .strict(),
  z
    .object({ op: z.literal('control'), target: targetSelSchema, control: controlSchema, condition: conditionSchema.optional(), chance: z.number().min(0).max(1).optional() })
    .strict(),
  z
    .object({
      op: z.literal('heal'),
      target: targetSelSchema,
      rate: z.number().min(0),
      basis: z.enum(['targetMaxHp', 'casterAtk']).optional(),
      over: z.number().int().positive().optional(),
      condition: conditionSchema.optional(),
      chance: z.number().min(0).max(1).optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal('shield'),
      target: targetSelSchema,
      share: z.number().min(0),
      basis: z.enum(['casterHp', 'casterAtk']).optional(),
      condition: conditionSchema.optional(),
      chance: z.number().min(0).max(1).optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal('cleanse'),
      target: targetSelSchema,
      count: z.number().int().positive().optional(),
      kinds: z.array(z.string().min(1)).optional(),
      condition: conditionSchema.optional(),
      chance: z.number().min(0).max(1).optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal('dispel'),
      target: targetSelSchema,
      count: z.number().int().positive().optional(),
      kinds: z.array(z.string().min(1)).optional(),
      condition: conditionSchema.optional(),
      chance: z.number().min(0).max(1).optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal('rage'),
      target: targetSelSchema,
      delta: z.number().optional(),
      pct: z.number().optional(),
      steal: z.boolean().optional(),
      condition: conditionSchema.optional(),
      chance: z.number().min(0).max(1).optional(),
    })
    .strict(),
  z
    .object({ op: z.literal('revive'), target: targetSelSchema, hpPct: z.number().min(0).max(1), once: z.boolean().optional(), condition: conditionSchema.optional(), chance: z.number().min(0).max(1).optional() })
    .strict(),
  z
    .object({
      op: z.literal('resource'),
      target: targetSelSchema,
      tag: z.string().min(1),
      delta: z.number().optional(),
      max: z.number().int().positive().optional(),
      consume: z.number().int().nonnegative().optional(),
      condition: conditionSchema.optional(),
      chance: z.number().min(0).max(1).optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal('damage'),
      target: targetSelSchema,
      rate: z.number().min(0).optional(),
      type: z.enum(['P', 'S']).optional(),
      basis: z.enum(['targetMaxHp', 'targetCurrentHp', 'targetMissingHp']).optional(),
      share: z.number().min(0).optional(),
      trueDamage: z.boolean().optional(),
      condition: conditionSchema.optional(),
      chance: z.number().min(0).max(1).optional(),
    })
    .strict(),
]);

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
    side: targetSideSchema.optional(),
    rowFilter: targetRowSchema.optional(),
    filters: z.array(targetFilterSchema).optional(),
    hpShareBasis: z.enum(['max', 'current', 'missing']).optional(),
    trueDamage: z.boolean().optional(),
    ignoreShield: z.boolean().optional(),
    ignoreDefense: z.number().min(0).max(1).optional(),
    dot: dotSpecSchema.optional(),
    bonusVs: z.object({ condition: conditionSchema, mult: z.number() }).strict().optional(),
    recastOnKill: z.object({ max: z.number().int().positive() }).strict().optional(),
    condition: conditionSchema.optional(),
    effects: z.array(effectSchema).optional(),
  })
  .strict()
  .refine((s) => s.damageType !== 'hpShare' || s.hpShare !== undefined, {
    message: 'damageType hpShare requires hpShare',
  });

const statModSchema = z
  .object({
    field: combatFieldSchema,
    mult: z.number().optional(),
    add: z.number().optional(),
    scalesWithLevel: z.array(z.tuple([z.number().int().positive(), z.number()])).optional(),
  })
  .strict()
  .refine((m) => m.mult !== undefined || m.add !== undefined, { message: 'statMod needs mult and/or add' });

const triggerSchema = z
  .object({
    on: z.enum([
      'battleStart',
      'roundStart',
      'roundEnd',
      'turnStart',
      'turnEnd',
      'onHit',
      'onKill',
      'onDeath',
      'onAllyDeath',
      'hpBelow',
    ]),
    hpBelow: z.number().min(0).max(1).optional(),
    chance: z.number().min(0).max(1).optional(),
    perTurn: z.number().int().positive().optional(),
    cooldown: z.number().int().positive().optional(),
    condition: conditionSchema.optional(),
    effects: z.array(effectSchema).optional(),
    rage: z.number().optional(),
    buff: buffSpecSchema.optional(),
  })
  .strict();

const talentSchema = z
  .object({
    statMods: z.array(statModSchema).optional(),
    rageOnHit: z.number().int().optional(),
    rageCutChance: z.number().min(0).max(1).optional(),
    rageStart: z.number().int().nonnegative().optional(),
    basicRate: z.number().min(0).max(1).optional(),
    safeguard: z
      .object({ active: z.number().int().positive(), cycle: z.number().int().positive() })
      .strict()
      .optional(),
    turnHooks: z.array(z.enum(['allyShelterStack'])).optional(),
    triggers: z.array(triggerSchema).optional(),
  })
  .strict();

export const kitSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    faction: factionSchema,
    class: classSchema,
    tier: tierSchema,
    traits: z.array(z.string().min(1)).optional(),
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
    defK: z.number().positive(),
    healBasis: z.enum(['targetMaxHp', 'casterAtk']),
    shieldCountsForRage: z.boolean(),
    redirectChance: z.number().min(0).max(1),
    cleanseOrder: z.enum(['oldestFirst', 'newestFirst']),
    defaultResourceCap: z.number().int().positive(),
    triggerDepthCap: z.number().int().positive(),
  })
  .strict();

/** Six core stats as authored per species (M2). */
export const coreStatsSchema = z
  .object({
    hp: z.number().positive(),
    pAtk: z.number().positive(),
    sAtk: z.number().positive(),
    spd: z.number().positive(),
    pDef: z.number().positive(),
    sDef: z.number().positive(),
  })
  .strict();

/**
 * One Wild (PROMPT §9.1). `stages` are the display names of the 1-3 evolution
 * forms (index = stage); `base` seeds the engine stat formula; `paletteSeed`
 * seeds the procedural portrait.
 */
export const speciesSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    faction: factionSchema,
    class: classSchema,
    tier: tierSchema,
    description: z.string().min(1),
    paletteSeed: z.number().int(),
    stages: z.array(z.string().min(1)).min(1).max(3),
    base: coreStatsSchema,
  })
  .strict();

/** A single stat line's Power weighting (reference attr_power_weight rows). */
const powerRowSchema = z
  .object({ powerRate: z.number(), extRate: z.number() })
  .strict();

/** Power weights (M2, PROMPT §5): core rows + percent rows + percent scale. */
export const powerSchema = z
  .object({
    core: z
      .object({
        hp: z.number(),
        pAtk: z.number(),
        sAtk: z.number(),
        spd: z.number(),
        pDef: z.number(),
        sDef: z.number(),
      })
      .strict(),
    percent: z.record(z.string(), powerRowSchema),
    scale: z.number().positive(),
  })
  .strict();

/** Growth tuning (M2, PROMPT §7.1): all four stat-formula factors as data. */
export const growthSchema = z
  .object({
    maxLevelByStage: z.array(z.number().int().positive()).min(1),
    maxStars: z.number().int().positive(),
    levelGrowth: z.number().nonnegative(),
    starStep: z.number().nonnegative(),
    evolutionMult: z.array(z.number().positive()).min(1),
    qualityMult: z
      .object({
        common: z.number().positive(),
        rare: z.number().positive(),
        epic: z.number().positive(),
        legendary: z.number().positive(),
        supreme: z.number().positive(),
        mythic: z.number().positive(),
      })
      .strict(),
    /** Level-up cost curve (M3): candy(level) = round(base × level^exponent). */
    levelUp: z
      .object({
        candyBase: z.number().positive(),
        candyExponent: z.number().positive(),
        goldPerCandy: z.number().nonnegative(),
      })
      .strict(),
    /** Star-up cost (M3): linear in the current star. */
    starUp: z
      .object({ shardsPerStar: z.number().nonnegative(), goldPerStar: z.number().nonnegative() })
      .strict(),
    /** Evolution steps indexed by target stage (index 0 unused). */
    evolve: z.array(
      z
        .object({
          minLevel: z.number().int().positive(),
          minStars: z.number().int().positive(),
          candy: z.number().nonnegative(),
          gold: z.number().nonnegative(),
          stones: z.number().nonnegative(),
        })
        .strict(),
    ),
    /** Respawn (M3): gem cost + fraction of level investment refunded. */
    respawn: z.object({ gemCost: z.number().nonnegative(), refundRate: z.number().min(0).max(1) }).strict(),
  })
  .strict();

/** Starting account (M3): currencies, seed roster and trainer name. */
export const accountSchema = z
  .object({
    playerName: z.string().min(1),
    startingCurrencies: z.record(z.string(), z.number().nonnegative()),
    startingRoster: z.array(z.string().min(1)),
    debugGrantCurrency: z.record(z.string(), z.number().nonnegative()),
  })
  .strict();

/** A currency/xp payout (M5/M6). Mirrors the engine's `Rewards` shape. */
export const rewardSchema = z
  .object({
    gold: z.number().nonnegative().optional(),
    gems: z.number().nonnegative().optional(),
    candy: z.number().nonnegative().optional(),
    shard: z.number().nonnegative().optional(),
    stone: z.number().nonnegative().optional(),
    ticketCommon: z.number().nonnegative().optional(),
    ticketPremium: z.number().nonnegative().optional(),
    arenaToken: z.number().nonnegative().optional(),
    guildCoin: z.number().nonnegative().optional(),
    homeCoin: z.number().nonnegative().optional(),
    forestCoin: z.number().nonnegative().optional(),
    islandCoin: z.number().nonnegative().optional(),
    wildCoin: z.number().nonnegative().optional(),
    xp: z.number().nonnegative().optional(),
  })
  .strict();

/** One enemy in a stage's defender squad, scaled by the stage's difficulty (M5). */
export const stageEnemySchema = z
  .object({
    speciesId: z.string().min(1),
    level: z.number().int().positive(),
    stars: z.number().int().positive(),
    stage: z.number().int().nonnegative(),
  })
  .strict();

/** Campaign stage (M5, PROMPT §7.6). */
export const stageSchema = z
  .object({
    id: z.string().min(1),
    chapter: z.number().int().positive(),
    index: z.number().int().positive(),
    name: z.string().min(1),
    enemies: z.array(stageEnemySchema).min(1),
    firstClear: rewardSchema,
    repeat: rewardSchema,
    idlePerMinute: rewardSchema,
    starRounds: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  })
  .strict();

/** A daily quest (M5, PROMPT §7.9). */
export const questSchema = z
  .object({
    id: z.string().min(1),
    metric: z.enum(['winBattle', 'sweepStage', 'levelUp', 'starUp', 'claimIdle', 'claimQuest']),
    target: z.number().int().positive(),
    activity: z.number().int().nonnegative(),
    rewards: rewardSchema,
  })
  .strict();

/** Economy tuning (M5): idle, xp curve, activity chests, mail, welcome gift. */
export const economySchema = z
  .object({
    idle: z
      .object({
        capHours: z.number().positive(),
        quickCollectHours: z.number().positive(),
        quickCollectGems: z.number().nonnegative(),
        quickCollectDailyLimit: z.number().int().nonnegative(),
      })
      .strict(),
    xp: z
      .object({
        base: z.number().positive(),
        exponent: z.number().positive(),
        maxLevel: z.number().int().positive(),
      })
      .strict(),
    activityChests: z.array(
      z.object({ points: z.number().int().positive(), rewards: rewardSchema }).strict(),
    ),
    mailTtlHours: z.number().positive(),
    welcome: rewardSchema,
  })
  .strict();

export type KitJson = z.infer<typeof kitSchema>;
export type CombatSettingsJson = z.infer<typeof combatSettingsSchema>;
export type SpeciesJson = z.infer<typeof speciesSchema>;
export type GrowthJson = z.infer<typeof growthSchema>;
export type PowerJson = z.infer<typeof powerSchema>;
export type CoreStatsJson = z.infer<typeof coreStatsSchema>;
export type AccountJson = z.infer<typeof accountSchema>;
export type StageJson = z.infer<typeof stageSchema>;
export type QuestJson = z.infer<typeof questSchema>;
export type EconomyJson = z.infer<typeof economySchema>;
export type RewardJson = z.infer<typeof rewardSchema>;
