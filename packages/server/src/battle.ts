import { COMBAT_SETTINGS, kitById, type KitJson } from '@wildbound/content';
import {
  computePower,
  resolveCoreStats,
  runBattle,
  SQUAD_SIZE,
  type AccountState,
  type BuffSpec,
  type BattleEvent,
  type KitDef,
  type ReplayUnit,
  type SheetInput,
  type SkillDef,
  type SkillSlot,
  type SpecInput,
  type SquadMode,
  type StageEnemy,
  type WildClass,
  type WildInstance,
} from '@wildbound/engine';
import type { GameConfig } from './config';

/**
 * Battle setup + replay payload (M4). Builds two `SpecInput` teams from account
 * squads and runs the engine, returning an immutable log the client replays.
 * See docs/design/battle-ui.md.
 */

/** One unit the client renders: replay state + display metadata. */
export interface BattleUnitSeed extends ReplayUnit {
  name: string;
  speciesId: string;
  className: WildClass;
  stage: number;
  power: number;
}

export interface BattleView {
  seed: number;
  mode: SquadMode | 'campaignStage';
  winner: 'attackers' | 'defenders';
  rounds: number;
  events: BattleEvent[];
  units: BattleUnitSeed[];
  teams: { attackers: { power: number }; defenders: { power: number } };
}

/** Front slots 0-2 become field positions 4-6, back slots 3-5 become 1-3 (PROMPT §6.1). */
export function slotToPosition(slot: number): number {
  return slot <= 2 ? slot + 4 : slot - 2;
}

/** Content kit DSL → engine `KitDef` (mirrors the CLI's kit-loader). */
function toEngineSkill(slot: SkillSlot, s: KitJson['skills'][SkillSlot]): SkillDef {
  const buff = (b: NonNullable<KitJson['skills'][SkillSlot]['selfBuffs']>[number]): BuffSpec => ({ ...b, kind: 'stat' });
  return {
    slot,
    type: s.type,
    rates: s.rates,
    rule: s.rule,
    targets: s.targets,
    damageType: s.damageType,
    hpShare: s.hpShare,
    control: s.control,
    selfBuffs: s.selfBuffs?.map(buff),
    targetDebuffs: s.targetDebuffs?.map(buff),
    counter: s.counter,
    heal: s.heal,
    shield: s.shield,
    lifesteal: s.lifesteal,
  };
}

function kitToEngine(j: KitJson): KitDef {
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

function sheetOf(wild: WildInstance, config: GameConfig): SheetInput | null {
  const meta = config.species.get(wild.speciesId);
  if (!meta) return null;
  const core = resolveCoreStats(
    { base: meta.base, level: wild.level, stars: wild.stars, tier: meta.tier, stage: wild.evolutionStage },
    config.growth,
  );
  return { hp: core.hp, pAtk: core.pAtk, sAtk: core.sAtk, spd: core.spd, pDef: core.pDef, sDef: core.sDef };
}

function powerOf(wild: WildInstance, config: GameConfig): number {
  const sheet = sheetOf(wild, config);
  if (!sheet) return 0;
  const core = { hp: sheet.hp, pAtk: sheet.pAtk, sAtk: sheet.sAtk, spd: sheet.spd, pDef: sheet.pDef ?? 0, sDef: sheet.sDef ?? 0 };
  return computePower(core, {}, config.power);
}

/** The Wilds a squad mode currently fields, auto-filling from the roster when empty. */
export function fielded(state: AccountState, mode: SquadMode): WildInstance[] {
  const byId = new Map(state.roster.map((w) => [w.id, w]));
  const picked: WildInstance[] = [];
  const seen = new Set<string>();
  for (const id of state.squads[mode]) {
    const wild = id ? byId.get(id) : undefined;
    if (wild && !seen.has(wild.speciesId)) {
      picked.push(wild);
      seen.add(wild.speciesId);
    }
  }
  if (picked.length > 0) return picked.slice(0, SQUAD_SIZE);
  for (const wild of state.roster) {
    if (seen.has(wild.speciesId)) continue;
    picked.push(wild);
    seen.add(wild.speciesId);
    if (picked.length === SQUAD_SIZE) break;
  }
  return picked;
}

interface BuiltTeam {
  specs: SpecInput[];
  meta: Map<string, { name: string; speciesId: string; className: WildClass; stage: number; power: number }>;
  power: number;
}

/** Build a team from owned Wild instances (the squad / echo path). */
export function buildWildTeam(wilds: WildInstance[], side: 'attackers' | 'defenders', config: GameConfig): BuiltTeam {
  const specs: SpecInput[] = [];
  const meta = new Map<string, { name: string; speciesId: string; className: WildClass; stage: number; power: number }>();
  let power = 0;
  wilds.forEach((wild, slot) => {
    const species = config.species.get(wild.speciesId);
    const kitJson = kitById(wild.speciesId);
    const sheet = sheetOf(wild, config);
    if (!species || !kitJson || !sheet) return;
    const position = slotToPosition(slot);
    const unitPower = powerOf(wild, config);
    const id = `${side}-${slot}`;
    specs.push({ id, name: species.name, position, side, kit: kitToEngine(kitJson), sheet, power: unitPower });
    meta.set(`${side}:${position}`, {
      name: species.name,
      speciesId: wild.speciesId,
      className: species.className,
      stage: wild.evolutionStage,
      power: unitPower,
    });
    power += unitPower;
  });
  return { specs, meta, power };
}

function rageStart(className: WildClass): number {
  return className === 'striker' ? COMBAT_SETTINGS.rageStrikerStart : COMBAT_SETTINGS.rageStart;
}

/** Build a defender team from a campaign stage's authored enemy list. */
export function buildEnemyTeam(enemies: StageEnemy[], config: GameConfig): BuiltTeam {
  const specs: SpecInput[] = [];
  const meta = new Map<string, { name: string; speciesId: string; className: WildClass; stage: number; power: number }>();
  let power = 0;
  enemies.slice(0, SQUAD_SIZE).forEach((enemy, slot) => {
    const species = config.species.get(enemy.speciesId);
    const kitJson = kitById(enemy.speciesId);
    if (!species || !kitJson) return;
    const core = resolveCoreStats(
      { base: species.base, level: enemy.level, stars: enemy.stars, tier: species.tier, stage: enemy.stage },
      config.growth,
    );
    const sheet: SheetInput = { hp: core.hp, pAtk: core.pAtk, sAtk: core.sAtk, spd: core.spd, pDef: core.pDef, sDef: core.sDef };
    const unitPower = computePower(core, {}, config.power);
    const position = slotToPosition(slot);
    const id = `defenders-${slot}`;
    specs.push({ id, name: species.name, position, side: 'defenders', kit: kitToEngine(kitJson), sheet, power: unitPower });
    meta.set(`defenders:${position}`, {
      name: species.name,
      speciesId: enemy.speciesId,
      className: species.className,
      stage: enemy.stage,
      power: unitPower,
    });
    power += unitPower;
  });
  return { specs, meta, power };
}

function unitSeeds(
  result: ReturnType<typeof runBattle>,
  attackers: BuiltTeam,
  defenders: BuiltTeam,
): BattleUnitSeed[] {
  return result.units.map((u) => {
    const info = (u.side === 'attackers' ? attackers : defenders).meta.get(u.key);
    const className: WildClass = info?.className ?? 'striker';
    return {
      key: u.key,
      side: u.side,
      position: u.position,
      hp: u.maxHp,
      maxHp: u.maxHp,
      shield: 0,
      rage: rageStart(className),
      alive: true,
      buffs: [],
      name: info?.name ?? u.id,
      speciesId: info?.speciesId ?? '',
      className,
      stage: info?.stage ?? 0,
      power: info?.power ?? 0,
    };
  });
}

function runView(
  attackers: BuiltTeam,
  defenders: BuiltTeam,
  seed: number,
  mode: BattleView['mode'],
  battleId: string,
): BattleView | null {
  if (attackers.specs.length === 0 || defenders.specs.length === 0) return null;
  const result = runBattle({
    attackers: attackers.specs,
    defenders: defenders.specs,
    seed,
    mode: 'pve',
    settings: {},
    battleId,
  });
  return {
    seed,
    mode,
    winner: result.winner,
    rounds: result.rounds,
    events: result.events,
    units: unitSeeds(result, attackers, defenders),
    teams: { attackers: { power: attackers.power }, defenders: { power: defenders.power } },
  };
}

/**
 * Simulate a battle for the given mode against a mirrored echo squad and return
 * an immutable replay payload (M4 demo). The seed is server-side randomness
 * unless supplied (tests / library replays).
 */
export function startBattle(config: GameConfig, state: AccountState, mode: SquadMode, seed?: number): BattleView | null {
  const players = fielded(state, mode);
  if (players.length === 0) return null;
  const resolvedSeed = seed ?? Math.floor(config.rng() * 0xffffffff);
  const attackers = buildWildTeam(players, 'attackers', config);
  const defenders = buildWildTeam([...players].reverse(), 'defenders', config);
  return runView(attackers, defenders, resolvedSeed, mode, `m4:${mode}:${resolvedSeed}`);
}

/**
 * Simulate a campaign stage: the player's campaign squad attacks the stage's
 * authored enemy squad (M5). Purely reads state; the caller applies the result.
 */
export function stageBattle(
  config: GameConfig,
  state: AccountState,
  enemies: StageEnemy[],
  stageId: string,
  seed?: number,
): BattleView | null {
  const players = fielded(state, 'campaign');
  if (players.length === 0) return null;
  const resolvedSeed = seed ?? Math.floor(config.rng() * 0xffffffff);
  const attackers = buildWildTeam(players, 'attackers', config);
  const defenders = buildEnemyTeam(enemies, config);
  return runView(attackers, defenders, resolvedSeed, 'campaignStage', `m5:${stageId}:${resolvedSeed}`);
}
