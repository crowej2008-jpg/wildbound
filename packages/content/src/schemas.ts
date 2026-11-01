import { z } from 'zod';

/**
 * Zod schemas for the skill-kit DSL (PROMPT §6.7), species/Power/growth tuning
 * (M2), account/stage/quest/economy data (M3/M5) and combat settings
 * (Appendix A). The engine consumes plain JSON; the CLI validator parses every
 * file under packages/content against these before a milestone ships.
 */

/** The source's five factions (R1). */
export const factionSchema = z.enum(['water', 'fire', 'grass', 'light', 'dark']);
export const classSchema = z.enum(['striker', 'guardian', 'adept']);
export const tierSchema = z.enum(['common', 'rare', 'epic', 'legendary', 'supreme', 'mythic', 'origin']);
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
export const targetFilterSchema = z.enum(['dot', 'controlled', 'debuffed', 'fullRage', 'shielded']);

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
    targetHasAnyTag: z.array(z.string().min(1)).min(1).optional(),
    round: z
      .object({
        from: z.number().int().positive().optional(),
        until: z.number().int().positive().optional(),
        even: z.boolean().optional(),
        every: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),
    selfControlled: z.boolean().optional(),
    targetShielded: z.boolean().optional(),
    selfHpBelowTarget: z.boolean().optional(),
    selfHpAboveTarget: z.boolean().optional(),
    actorHasTag: z.string().min(1).optional(),
    enemiesAtLeast: z.number().int().positive().optional(),
    otherAlliesAtMost: z.number().int().nonnegative().optional(),
    targetClass: classSchema.optional(),
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
    event: z.literal(true).optional(),
    hasTag: z.string().min(1).optional(),
    excludeSelf: z.boolean().optional(),
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
  'atkPct',
  'ignoreBlock',
  'basicRate',
  'pRdct',
  'sRdct',
  'dotTaken',
  'lifesteal',
]);

const buffSpecSchema = z
  .object({
    tag: z.string().min(1),
    kind: z
      .enum(['stat', 'immune', 'regen', 'stack', 'taunt', 'rageBlock', 'disarm', 'noBasic', 'noCrit', 'endure', 'invulnerable'])
      .optional(),
    field: combatFieldSchema.optional(),
    amount: z.number().optional(),
    turns: z.number().int().positive().optional(),
    bigRounds: z.number().int().positive().optional(),
    maxStacks: z.number().int().positive().optional(),
    undispellable: z.boolean().optional(),
    scalesWithLevel: z.array(z.tuple([z.number().int().positive(), z.number()])).optional(),
    consumeOnHit: z.boolean().optional(),
    endsWithSource: z.boolean().optional(),
    immuneTo: z.array(z.string().min(1)).optional(),
  })
  .strict();

const perTaggedSchema = z
  .object({ side: targetSideSchema, tag: z.string().min(1), max: z.number().int().positive().optional() })
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
    .object({ op: z.literal('dot'), target: targetSelSchema, dot: dotSpecSchema, tag: z.string().min(1).optional(), condition: conditionSchema.optional(), chance: z.number().min(0).max(1).optional() })
    .strict(),
  z
    .object({ op: z.literal('control'), target: targetSelSchema, control: controlSchema, condition: conditionSchema.optional(), chance: z.number().min(0).max(1).optional() })
    .strict(),
  z
    .object({
      op: z.literal('heal'),
      target: targetSelSchema,
      rate: z.number().min(0),
      basis: z.enum(['targetMaxHp', 'casterAtk', 'casterSAtk', 'casterCurrentHp', 'targetMissingHp', 'eventDamage']).optional(),
      over: z.number().int().positive().optional(),
      bonusVs: z.object({ condition: conditionSchema, mult: z.number() }).strict().optional(),
      perResource: z.string().min(1).optional(),
      perTagged: perTaggedSchema.optional(),
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
      fill: z.boolean().optional(),
      force: z.boolean().optional(),
      perTagged: perTaggedSchema.optional(),
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
      basis: z
        .enum(['targetMaxHp', 'targetCurrentHp', 'targetMissingHp', 'casterCurrentHp', 'casterMissingHp', 'casterLostTotal', 'casterLostLastRound', 'eventDamage'])
        .optional(),
      share: z.number().min(0).optional(),
      trueDamage: z.boolean().optional(),
      capRate: z.number().min(0).optional(),
      condition: conditionSchema.optional(),
      chance: z.number().min(0).max(1).optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal('extraAction'),
      target: targetSelSchema,
      slot: z.enum(['normal', 'basic', 'ult', 'roll']),
      noRage: z.boolean().optional(),
      condition: conditionSchema.optional(),
      chance: z.number().min(0).max(1).optional(),
    })
    .strict(),
  z
    .object({ op: z.literal('splash'), target: targetSelSchema, share: z.number().min(0), condition: conditionSchema.optional(), chance: z.number().min(0).max(1).optional() })
    .strict(),
  z
    .object({ op: z.literal('breakShield'), target: targetSelSchema, condition: conditionSchema.optional(), chance: z.number().min(0).max(1).optional() })
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
    hasTag: z.string().min(1).optional(),
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

/** E1: a damage modifier owned by a unit (held items, talents). */
export const damageModSchema = z
  .object({
    tag: z.string().min(1),
    slot: skillSlotSchema.optional(),
    condition: conditionSchema.optional(),
    chance: z.number().min(0).max(1).optional(),
    dmg: z.number().optional(),
    atk: z.number().optional(),
    ignoreBlock: z.number().min(0).max(1).optional(),
    scale: z
      .union([z.enum(['selfRage', 'targetRage', 'selfMissingHp', 'selfHp']), z.object({ resource: z.string().min(1) }).strict()])
      .optional(),
    cap: z.number().optional(),
    role: z.enum(['attack', 'defend']).optional(),
    type: z.enum(['P', 'S']).optional(),
    group: z.string().min(1).optional(),
  })
  .strict();

export const triggerSchema = z
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
      'onCrit',
      'onBlocked',
      'onDealDamage',
      'onControlled',
      'onInflictControl',
      'afterNormal',
      'afterBasic',
      'afterUlt',
      'onAllyCrit',
      'onEndure',
      'onEnemyDeath',
      'onEnemyUlt',
    ]),
    hpBelow: z.number().min(0).max(1).optional(),
    chance: z.number().min(0).max(1).optional(),
    perTurn: z.number().int().positive().optional(),
    cooldown: z.number().int().positive().optional(),
    maxFires: z.number().int().positive().optional(),
    group: z.string().min(1).optional(),
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
    damageMods: z.array(damageModSchema).optional(),
  })
  .strict();

const skillLevelSchema = z
  .object({
    skill: skillSchema.optional(),
    triggers: z.array(triggerSchema).optional(),
    damageMods: z.array(damageModSchema).optional(),
  })
  .strict();

/** E4: an Origin skill row's sheet text per level and its LV.2 / LV.3 content. */
const skillRowLevelsSchema = z
  .object({
    name: z.string().optional(),
    text: z.array(z.string()).max(3).optional(),
    '2': skillLevelSchema.optional(),
    '3': skillLevelSchema.optional(),
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
    levels: z
      .object({ ult: skillRowLevelsSchema, basic: skillRowLevelsSchema, passive: skillRowLevelsSchema, talent4: skillRowLevelsSchema })
      .partial()
      .strict()
      .optional(),
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
    teamPowerCut: z.boolean(),
    tpThreshold: z.number().min(0).max(1),
    tpSymmetric: z.boolean(),
    classMult: z.record(z.string(), z.number()),
    weatherDefault: z.number(),
    basicReplace: z.number().min(0).max(1),
    rageStart: z.number(),
    rageStrikerStart: z.number(),
    rageMax: z.number(),
    ragePerAction: z.number(),
    ragePerActionByClass: z.object({ striker: z.number(), guardian: z.number(), adept: z.number() }).partial(),
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
    strategyUltHoldHp: z.number().min(0).max(1),
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

const fodderSchema = z
  .object({
    own: z.boolean(),
    star: z.number().int().positive(),
    count: z.number().int().positive(),
    faction: factionSchema.optional(),
  })
  .strict();

const hpAtkSchema = z.object({ hp: z.number().nonnegative(), atk: z.number().nonnegative() }).strict();

/** One star card, copied from the source's hero_evolution_json by scripts/import-species.mjs (R1). */
export const starCardSchema = z
  .object({
    star: z.number().int().positive(),
    name: z.string().min(1),
    maxLevel: z.number().int().positive(),
    basic: z.object({ hp: z.number().nonnegative(), atk: z.number().nonnegative(), spd: z.number().nonnegative() }).strict(),
    growth: z
      .object({
        hp: z.number().nonnegative(),
        atk: z.number().nonnegative(),
        pDef: z.number().nonnegative(),
        sDef: z.number().nonnegative(),
      })
      .strict(),
    extraBasic: hpAtkSchema.optional(),
    extraGrowth: hpAtkSchema.optional(),
    factionBoost: z.object({ faction: factionSchema, value: z.number().positive() }).strict().optional(),
    fodder: z.array(fodderSchema).min(1).optional(),
    fodderItems: z.array(z.object({ item: z.number().int(), count: z.number().int().positive() }).strict()).optional(),
  })
  .strict();

/**
 * One species (PROMPT §9.1). Name, description, portrait seed and kit are the owner's roster; faction,
 * class, quality, shard count and the star ladder are copied from the source (R1).
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
    /** The source's hero id (hero_basic_json). */
    sourceId: z.number().int().positive(),
    /** Shards that make one copy (item_num: 30 / 40 / 50). */
    shards: z.number().int().positive(),
    stars: z.array(starCardSchema).min(1),
  })
  .strict()
  .refine((s) => s.stars.every((card, i) => i === 0 || card.star === s.stars[i - 1]!.star + 1), {
    message: 'star cards must be consecutive',
  });

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

/**
 * Growth tuning. Since R1 the stat formula, star caps, level caps and evolution fodder come from each
 * species' star cards; only the level-up price (a stand-in until the source table is captured —
 * ASSUMPTIONS #51) and the respawn rule remain here.
 */
export const growthSchema = z
  .object({
    /** Level-up cost curve: candy(level) = round(base × level^exponent); gold = candy × goldPerCandy. */
    levelUp: z
      .object({
        candyBase: z.number().positive(),
        candyExponent: z.number().positive(),
        goldPerCandy: z.number().nonnegative(),
      })
      .strict(),
    respawn: z.object({ gemCost: z.number().nonnegative(), refundRate: z.number().min(0).max(1) }).strict(),
    /** E4 (hero_origin_skill_up_json): an Origin's own shards for skill LV.2 and LV.3. */
    originSkill: z.object({ costs: z.array(z.number().int().positive()).length(2) }).strict(),
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
    potentialShard: z.number().nonnegative().optional(),
    orbEssence: z.number().nonnegative().optional(),
    soulHeartExp: z.number().nonnegative().optional(),
    berryEssence: z.number().nonnegative().optional(),
    heldItemShard: z.number().nonnegative().optional(),
    resetterShard: z.number().nonnegative().optional(),
    heldItemResetter: z.number().nonnegative().optional(),
    plateBottle: z.number().nonnegative().optional(),
    plateFragment: z.number().nonnegative().optional(),
    starShard: z.number().nonnegative().optional(),
    resonationShard: z.number().nonnegative().optional(),
    titleTicket: z.number().nonnegative().optional(),
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

/** A gym gate on a story stage (M13.0a): clear this gym first. */
export const stageGateSchema = z
  .object({
    gymId: z.string().min(1),
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
    /** M13.0a: the story gate's gym, if this stage is gated. */
    gate: stageGateSchema.optional(),
  })
  .strict();

/** Chapter metadata (M13.0a) — display name, region and the chapter's enemy faction. */
export const chapterMetaSchema = z
  .object({
    number: z.number().int().positive(),
    name: z.string().min(1),
    region: z.string().min(1),
    faction: factionSchema,
  })
  .strict();

/** A Victory Road gym gate (M13.0a); the full task/badge layer is M14. */
export const gymSchema = z
  .object({
    id: z.string().min(1),
    index: z.number().int().positive(),
    chapter: z.number().int().positive(),
    name: z.string().min(1),
    region: z.string().min(1),
    faction: factionSchema,
    enemies: z.array(stageEnemySchema).min(1).max(6),
    firstClear: rewardSchema,
    repeat: rewardSchema,
    starRounds: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  })
  .strict();

/** Campaign metadata (M13.0a): chapter index, gym gates and the chapter chest payout. */
export const campaignSchema = z
  .object({
    chapterChestGems: z.number().int().nonnegative(),
    chapters: z.array(chapterMetaSchema).length(182),
    gyms: z.array(gymSchema).length(60),
  })
  .strict();

/** One unlock requirement for an Explore mode (M13.0b). */
export const exploreGateSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('campaign'), chapter: z.number().int().positive(), stage: z.number().int().positive() }).strict(),
  z.object({ kind: z.literal('level'), level: z.number().int().positive() }).strict(),
  z.object({ kind: z.literal('serverDay'), day: z.number().int().positive() }).strict(),
]);

/** One Explore mode card/shell (M13.0b). */
export const exploreModeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    sigil: z.string().min(1).max(3),
    tagline: z.string().min(1),
    description: z.string().min(1),
    scale: z.string().min(1),
    status: z.enum(['planned', 'live']),
    arrivesIn: z.string().min(1),
    reset: z.enum(['daily', 'weekly', 'permanent']),
    gates: z.array(exploreGateSchema).min(1),
    features: z.array(z.string().min(1)).min(1),
  })
  .strict();

/** Explore hub tuning (M13.0b): exactly the eight planned modes. */
export const exploreSchema = z
  .object({
    serverDayNote: z.string().min(1),
    modes: z.array(exploreModeSchema).length(8),
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
export type StageGateJson = z.infer<typeof stageGateSchema>;
export type ChapterMetaJson = z.infer<typeof chapterMetaSchema>;
export type GymJson = z.infer<typeof gymSchema>;
export type CampaignJson = z.infer<typeof campaignSchema>;
export type ExploreGateJson = z.infer<typeof exploreGateSchema>;
export type ExploreModeJson = z.infer<typeof exploreModeSchema>;
export type ExploreJson = z.infer<typeof exploreSchema>;
export type QuestJson = z.infer<typeof questSchema>;
export type EconomyJson = z.infer<typeof economySchema>;
export type RewardJson = z.infer<typeof rewardSchema>;
