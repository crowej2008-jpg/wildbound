import { mulberry32 } from '../rng';
import { DEFAULT_COMBAT_SETTINGS, type CombatSettings } from './settings';
import type {
  BattleContext,
  BattleStrategies,
  Combatant,
  KitDef,
  SheetInput,
  SkillDef,
  SpecInput,
  TalentDef,
} from './types';

/** Shared battle fixtures for the M1 combat test suite. */

const BASE_SHEET: SheetInput = {
  hp: 1000,
  pAtk: 200,
  sAtk: 200,
  spd: 100,
};

export function sheet(over: Partial<SheetInput> = {}): SheetInput {
  return { ...BASE_SHEET, ...over };
}

export function skill(over: Partial<SkillDef> & { slot: 'normal' | 'basic' | 'ult' }): SkillDef {
  return {
    type: 'P',
    rates: [1.0],
    rule: 'column',
    ...over,
  };
}

export function kit(over: {
  id?: string;
  faction?: KitDef['faction'];
  class?: KitDef['class'];
  tier?: KitDef['tier'];
  skills?: Partial<Record<'normal' | 'basic' | 'ult', Partial<SkillDef>>>;
  counterShare?: number;
  talents?: TalentDef;
  hooksConfig?: KitDef['hooksConfig'];
} = {}): KitDef {
  const cls = over.class ?? 'guardian';
  return {
    id: over.id ?? 'testkit',
    name: over.id ?? 'Test Kit',
    faction: over.faction ?? 'water',
    class: cls,
    tier: over.tier ?? 'rare',
    skills: {
      normal: skill({ slot: 'normal', ...(over.skills?.normal ?? {}) }),
      basic: skill({ slot: 'basic', rates: [1.1], ...(over.skills?.basic ?? {}) }),
      ult: skill({ slot: 'ult', rates: [1.4], rule: 'row', ...(over.skills?.ult ?? {}) }),
    },
    counterShare: over.counterShare,
    talents: over.talents,
    hooksConfig: over.hooksConfig,
  };
}

export function spec(over: {
  id: string;
  side: 'attackers' | 'defenders';
  position: number;
  kit?: KitDef;
  sheet?: SheetInput;
  power?: number;
}): SpecInput {
  return {
    id: over.id,
    name: over.id,
    position: over.position,
    side: over.side,
    kit: over.kit ?? kit(),
    sheet: over.sheet ?? sheet(),
    power: over.power ?? 100,
  };
}

export function unit(over: {
  key: string;
  side: 'attackers' | 'defenders';
  position: number;
  kit?: KitDef;
  sheet?: SheetInput;
  hp?: number;
  shieldHp?: number;
  rage?: number;
  lost?: number;
}): Combatant {
  const k = over.kit ?? kit();
  const base = { hp: over.hp ?? over.sheet?.hp ?? BASE_SHEET.hp, ...over.sheet } as (SheetInput & {});
  const resolved = {
    hp: base.hp,
    pAtk: base.pAtk,
    sAtk: base.sAtk,
    spd: base.spd,
    pDef: base.pDef ?? 0,
    sDef: base.sDef ?? 0,
    dmgBoost: base.dmgBoost ?? 0,
    dmgRdct: base.dmgRdct ?? 0,
    pvpBoost: base.pvpBoost ?? 0,
    pvpRdct: base.pvpRdct ?? 0,
    ultBoost: base.ultBoost ?? 0,
    ultRed: base.ultRed ?? 0,
    skillBoost: base.skillBoost ?? 0,
    skillRed: base.skillRed ?? 0,
    crit: base.crit ?? 0,
    critRes: base.critRes ?? 0,
    critPower: base.critPower ?? 0,
    block: base.block ?? 0,
    blockPower: base.blockPower ?? 0,
    guardBreak: base.guardBreak ?? 0,
    controlBoost: base.controlBoost ?? 0,
    controlRes: base.controlRes ?? 0,
    healBoost: base.healBoost ?? 0,
    receiveHealBoost: base.receiveHealBoost ?? 0,
    counterBoost: base.counterBoost ?? 0,
    spiritAtk: base.spiritAtk ?? 0,
    spiritDef: base.spiritDef ?? 0,
    atkPct: base.atkPct ?? 0,
    ignoreBlock: base.ignoreBlock ?? 0,
    basicRate: base.basicRate ?? 0,
  };
  const maxHp = resolved.hp;
  return {
    key: over.key,
    id: over.key,
    name: over.key,
    side: over.side,
    position: over.position,
    column: over.position <= 3 ? over.position : over.position - 3,
    row: over.position <= 3 ? 'back' : 'front',
    kit: k,
    sheet: resolved,
    base: resolved,
    maxHp,
    hp: over.hp ?? maxHp,
    shieldHp: over.shieldHp ?? 0,
    rage: over.rage ?? DEFAULT_COMBAT_SETTINGS.rageStart,
    alive: true,
    buffs: [],
    lostThisRound: 0,
    lostLastRound: over.lost ?? 0,
  };
}

export function makeCtx(options: {
  units: Combatant[];
  settings?: Partial<CombatSettings>;
  seed?: number;
  deterministic?: boolean;
  /** M10.5: per-side squad strategy (omitted sides fight `balanced`). */
  strategies?: BattleStrategies;
}): BattleContext {
  const settings = { ...DEFAULT_COMBAT_SETTINGS, ...options.settings };
  return {
    settings,
    rng: options.deterministic ? () => 0.999999 : mulberry32(options.seed ?? 1),
    units: options.units,
    events: [],
    strategies: options.strategies,
    deterministic: options.deterministic === true,
    round: 1,
    alreadyAppliedHooks: new Set<string>(),
    damageDealt: {},
    damageTaken: {},
    healingDone: {},
  };
}

/** Multiply two Assets? No — a tiny PRNG-independent probe of the event log. */
export function lastEvent<T extends BattleContext['events'][number]['type']>(
  ctx: BattleContext,
  type: T,
): Extract<BattleContext['events'][number], { type: T }> | undefined {
  const all = ctx.events.filter((e) => e.type === type);
  return all[all.length - 1] as Extract<BattleContext['events'][number], { type: T }> | undefined;
}

export function countEvents<T extends BattleContext['events'][number]['type']>(
  ctx: BattleContext,
  type: T,
): number {
  return ctx.events.filter((e) => e.type === type).length;
}