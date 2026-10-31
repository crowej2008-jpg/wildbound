import { COMBAT_SETTINGS, kitById, kitToEngine } from '@wildbound/content';
import {
  computePower,
  emptyLoadout,
  formIndex,
  starRange,
  foldLoadout,
  mergeDelta,
  resolveCoreStats,
  runBattle,
  sideStrategy,
  SQUAD_SIZE,
  type AccountState,
  type BattleRules,
  type BattleEvent,
  type BattleStrategies,
  type BattleStrategy,
  type Faction,
  type FoldedLoadout,
  type PercentLines,
  type ReplayUnit,
  type RoundEffect,
  type SheetInput,
  type SpecInput,
  type SquadMode,
  type StageEnemy,
  type WeatherRule,
  type WildClass,
  type WildInstance,
} from '@wildbound/engine';
import { cardOf, type GameConfig, type SpeciesMeta } from './config';
import { resonanceFoldFor } from './resonance';
import { titleFoldFor } from './titles';

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

/** A battle-mode label: the M4/M5 labels plus the M8 PvE modes and M10 PvP. */
export type BattleModeLabel =
  | SquadMode
  | 'campaignStage'
  | 'gymGate'
  | 'towerFloor'
  | 'skyPillarStage'
  | 'trial'
  | 'worldBossFight'
  | 'dungeon'
  | 'arenaFight'
  | 'rankedMatch';

export interface BattleView {
  seed: number;
  mode: BattleModeLabel;
  winner: 'attackers' | 'defenders';
  rounds: number;
  events: BattleEvent[];
  units: BattleUnitSeed[];
  teams: { attackers: { power: number }; defenders: { power: number } };
  /** M10.5: the squad strategy each side actually fought with. */
  strategies: { attackers: BattleStrategy; defenders: BattleStrategy };
  /** Per-unit damage ledger, keyed `${side}:${position}` (M8 world-boss scoring). */
  damageDealt: Record<string, number>;
}

/** Front slots 0-2 become field positions 4-6, back slots 3-5 become 1-3 (PROMPT §6.1). */
export function slotToPosition(slot: number): number {
  return slot <= 2 ? slot + 4 : slot - 2;
}

/** Content kit DSL → engine `KitDef`: `kitToEngine` comes from `@wildbound/content`. */

export function sheetOf(wild: WildInstance, config: GameConfig): SheetInput | null {
  const meta = config.species.get(wild.speciesId);
  if (!meta) return null;
  const core = resolveCoreStats(cardOf(meta, wild.stars), wild.level);
  return { hp: core.hp, pAtk: core.pAtk, sAtk: core.sAtk, spd: core.spd, pDef: core.pDef, sDef: core.sDef };
}

export interface EquippedSheet {
  sheet: SheetInput;
  percent: Partial<PercentLines>;
  effects: RoundEffect[];
  soulheart: FoldedLoadout['soulheart'];
  soulheartText: string[];
  triggers: FoldedLoadout['triggers'];
  damageMods: FoldedLoadout['damageMods'];
}

/** Apply title-style percent-of-total lines after flat equipment has merged. */
export function applySheetPercents(
  sheet: SheetInput,
  percent: Partial<PercentLines>,
): SheetInput {
  const hpPct = percent.hpPct ?? 0;
  const pAtkPct = percent.pAtkPct ?? 0;
  const sAtkPct = percent.sAtkPct ?? 0;
  if (hpPct === 0 && pAtkPct === 0 && sAtkPct === 0) return sheet;
  return {
    ...sheet,
    hp: Math.round(sheet.hp * (1 + hpPct)),
    pAtk: Math.round(sheet.pAtk * (1 + pAtkPct)),
    sAtk: Math.round(sheet.sAtk * (1 + sAtkPct)),
  };
}

/** Resolve a Wild's sheet and fold in its equipped equipment (M7). */
export function equippedSheet(
  wild: WildInstance,
  config: GameConfig,
  state: AccountState | undefined,
): EquippedSheet | null {
  const sheet = sheetOf(wild, config);
  if (!sheet) return null;
  if (!state) return { sheet, percent: {}, effects: [], soulheart: {}, soulheartText: [], triggers: [], damageMods: [] };
  const loadout = state.loadouts[wild.id] ?? emptyLoadout(config.equipment.tuning);
  const meta = config.species.get(wild.speciesId);
  const folded = foldLoadout(
    loadout,
    state.equipment,
    config.equipment,
    meta ? { faction: meta.faction, stage: state.plates?.[wild.id] ?? 0 } : undefined,
    { speciesId: wild.speciesId, level: state.trinkets?.[wild.speciesId] ?? 0 },
    resonanceFoldFor(config, state, wild.id),
    titleFoldFor(config, state),
  );
  return {
    sheet: applySheetPercents(mergeDelta(sheet, folded.delta), folded.delta.percent),
    percent: folded.delta.percent,
    effects: folded.effects,
    soulheart: folded.soulheart,
    soulheartText: folded.soulheartText,
    triggers: folded.triggers,
    damageMods: folded.damageMods,
  };
}

function powerOf(wild: WildInstance, config: GameConfig, state?: AccountState): number {
  const equipped = equippedSheet(wild, config, state);
  if (!equipped) return 0;
  const { sheet } = equipped;
  const core = { hp: sheet.hp, pAtk: sheet.pAtk, sAtk: sheet.sAtk, spd: sheet.spd, pDef: sheet.pDef ?? 0, sDef: sheet.sDef ?? 0 };
  return computePower(core, equipped.percent, config.power);
}

export { powerOf };

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
export function buildWildTeam(
  wilds: WildInstance[],
  side: 'attackers' | 'defenders',
  config: GameConfig,
  state?: AccountState,
): BuiltTeam {
  const specs: SpecInput[] = [];
  const meta = new Map<string, { name: string; speciesId: string; className: WildClass; stage: number; power: number }>();
  let power = 0;
  wilds.forEach((wild, slot) => {
    const species = config.species.get(wild.speciesId);
    const kitJson = kitById(wild.speciesId);
    const equipped = equippedSheet(wild, config, state);
    if (!species || !kitJson || !equipped) return;
    const position = slotToPosition(slot);
    const unitPower = powerOf(wild, config, state);
    const card = cardOf(species, wild.stars);
    const id = `${side}-${slot}`;
    specs.push({
      id,
      name: species.name,
      position,
      side,
      kit: kitToEngine(kitJson),
      sheet: equipped.sheet,
      power: unitPower,
      level: wild.level,
      ...(card.factionBoost ? { factionBoost: card.factionBoost } : {}),
      ...(equipped.effects.length > 0 ? { roundEffects: equipped.effects } : {}),
      ...(Object.keys(equipped.soulheart).length > 0 ? { soulheart: equipped.soulheart } : {}),
      ...(equipped.triggers.length > 0 ? { triggers: equipped.triggers } : {}),
      ...(equipped.damageMods.length > 0 ? { damageMods: equipped.damageMods } : {}),
    });
    meta.set(`${side}:${position}`, {
      name: species.name,
      speciesId: wild.speciesId,
      className: species.className,
      stage: formIndex(species.stars, wild.stars),
      power: unitPower,
    });
    power += unitPower;
  });
  return { specs, meta, power };
}

function rageStart(className: WildClass): number {
  return className === 'striker' ? COMBAT_SETTINGS.rageStrikerStart : COMBAT_SETTINGS.rageStart;
}

/**
 * R1 interim: enemy rows (campaign stages, gyms, mode curves, PvP ghosts, Sky Pillar) still carry the
 * pre-retrofit 1–10 `stars`, where 1★ meant a fresh copy. Until R9 re-copies them from the source,
 * an enemy's `stars` counts up from its species' first star (1★ = the first card), clamped to the
 * ladder; the old `stage` field is ignored (ASSUMPTIONS #53).
 */
export function enemyStar(species: SpeciesMeta, legacyStars: number): number {
  const { min, max } = starRange(species.stars);
  return Math.min(max, min + Math.max(0, Math.floor(legacyStars) - 1));
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
    const star = enemyStar(species, enemy.stars);
    const card = cardOf(species, star);
    const core = resolveCoreStats(card, enemy.level);
    const sheet: SheetInput = { hp: core.hp, pAtk: core.pAtk, sAtk: core.sAtk, spd: core.spd, pDef: core.pDef, sDef: core.sDef };
    const unitPower = computePower(core, {}, config.power);
    const position = slotToPosition(slot);
    const id = `defenders-${slot}`;
    specs.push({
      id,
      name: species.name,
      position,
      side: 'defenders',
      kit: kitToEngine(kitJson),
      sheet,
      power: unitPower,
      level: enemy.level,
      ...(card.factionBoost ? { factionBoost: card.factionBoost } : {}),
    });
    meta.set(`defenders:${position}`, {
      name: species.name,
      speciesId: enemy.speciesId,
      className: species.className,
      stage: formIndex(species.stars, star),
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

interface RunViewOptions {
  seed: number;
  mode: BattleModeLabel;
  battleId: string;
  rules?: BattleRules;
  weather?: WeatherRule;
  /** M10.5: per-side squad strategy (omitted sides fight `balanced`). */
  strategies?: BattleStrategies;
}

function runView(attackers: BuiltTeam, defenders: BuiltTeam, opts: RunViewOptions): BattleView | null {
  if (attackers.specs.length === 0 || defenders.specs.length === 0) return null;
  const { seed, mode, battleId, rules, weather, strategies } = opts;
  const result = runBattle({
    attackers: attackers.specs,
    defenders: defenders.specs,
    seed,
    mode: 'pve',
    settings: {},
    battleId,
    ...(rules ? { rules } : {}),
    ...(weather ? { weather } : {}),
    ...(strategies ? { strategies } : {}),
  });
  return {
    seed,
    mode,
    winner: result.winner,
    rounds: result.rounds,
    events: result.events,
    units: unitSeeds(result, attackers, defenders),
    teams: { attackers: { power: attackers.power }, defenders: { power: defenders.power } },
    strategies: {
      attackers: sideStrategy(strategies, 'attackers'),
      defenders: sideStrategy(strategies, 'defenders'),
    },
    damageDealt: result.damageDealt,
  };
}

/**
 * Simulate a battle for the given mode against a mirrored echo squad and return
 * an immutable replay payload (M4 demo). The seed is server-side randomness
 * unless supplied (tests / library replays). The echo is your own squad, so it
 * fights with the mode's strategy too.
 */
export function startBattle(config: GameConfig, state: AccountState, mode: SquadMode, seed?: number): BattleView | null {
  const players = fielded(state, mode);
  if (players.length === 0) return null;
  const resolvedSeed = seed ?? Math.floor(config.rng() * 0xffffffff);
  const attackers = buildWildTeam(players, 'attackers', config, state);
  const defenders = buildWildTeam([...players].reverse(), 'defenders', config, state);
  return runView(attackers, defenders, {
    seed: resolvedSeed,
    mode,
    battleId: `m4:${mode}:${resolvedSeed}`,
    strategies: { attackers: state.strategies[mode], defenders: state.strategies[mode] },
  });
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
  const attackers = buildWildTeam(players, 'attackers', config, state);
  const defenders = buildEnemyTeam(enemies, config);
  return runView(attackers, defenders, {
    seed: resolvedSeed,
    mode: 'campaignStage',
    battleId: `m5:${stageId}:${resolvedSeed}`,
    strategies: { attackers: state.strategies.campaign },
  });
}

/**
 * The Wilds a mode may field: the squad's picks (deduped by species), optionally
 * restricted to one faction, auto-filled from the roster when the squad is empty
 * or has no matching faction. (M8 Trials.)
 */
export function eligibleWilds(
  state: AccountState,
  config: GameConfig,
  squadMode: SquadMode,
  faction?: Faction,
): WildInstance[] {
  const matches = (wild: WildInstance): boolean =>
    faction === undefined || config.species.get(wild.speciesId)?.faction === faction;
  const byId = new Map(state.roster.map((w) => [w.id, w]));
  const picked: WildInstance[] = [];
  const seen = new Set<string>();
  for (const id of state.squads[squadMode]) {
    const wild = id ? byId.get(id) : undefined;
    if (!wild || seen.has(wild.speciesId) || !matches(wild)) continue;
    picked.push(wild);
    seen.add(wild.speciesId);
  }
  if (picked.length > 0) return picked.slice(0, SQUAD_SIZE);
  for (const wild of state.roster) {
    if (seen.has(wild.speciesId) || !matches(wild)) continue;
    picked.push(wild);
    seen.add(wild.speciesId);
    if (picked.length === SQUAD_SIZE) break;
  }
  return picked;
}

/** The Wilds a mode fields, treated at most at `levelCap` (M8 level-capped trial). */
export function cappedWilds(wilds: WildInstance[], levelCap?: number): WildInstance[] {
  if (levelCap === undefined) return wilds;
  return wilds.map((w) => (w.level > levelCap ? { ...w, level: levelCap } : w));
}

export interface ModeBattleOptions {
  /** The squad the attackers come from. */
  squadMode: SquadMode;
  /** The label the replay screen shows. */
  label: BattleModeLabel;
  enemies: StageEnemy[];
  battleId: string;
  seed?: number;
  rules?: BattleRules;
  /** Faction weather (M10 Ranked): a damage bonus for that faction. */
  weather?: WeatherRule;
  /** Field at most this many Wilds (M10 Ranked's phase team size). */
  sizeCap?: number;
  /** Restrict fielded Wilds to one faction (faction-locked trial). */
  faction?: Faction;
  /** Treat fielded Wilds at this level or below (level-capped trial). */
  levelCap?: number;
  /** M10.5: the defender side's strategy (real-defender modes; ghosts stay `balanced`). */
  defenderStrategy?: BattleStrategy;
}

/**
 * Build and run a PvE-mode battle (M8): attackers from a squad (optionally
 * faction-locked, level-capped and/or size-capped), defenders from a generated
 * enemy squad, with the mode's special `rules`, weather and squad strategy
 * (M10.5 — the attackers always fight with the squad mode's own strategy).
 * Purely reads state.
 */
export function modeBattle(config: GameConfig, state: AccountState, opts: ModeBattleOptions): BattleView | null {
  const players = cappedWilds(eligibleWilds(state, config, opts.squadMode, opts.faction), opts.levelCap).slice(
    0,
    opts.sizeCap ?? SQUAD_SIZE,
  );
  if (players.length === 0) return null;
  const resolvedSeed = opts.seed ?? Math.floor(config.rng() * 0xffffffff);
  const attackers = buildWildTeam(players, 'attackers', config, state);
  const defenders = buildEnemyTeam(opts.enemies, config);
  return runView(attackers, defenders, {
    seed: resolvedSeed,
    mode: opts.label,
    battleId: opts.battleId,
    ...(opts.rules ? { rules: opts.rules } : {}),
    ...(opts.weather ? { weather: opts.weather } : {}),
    strategies: {
      attackers: state.strategies[opts.squadMode],
      ...(opts.defenderStrategy ? { defenders: opts.defenderStrategy } : {}),
    },
  });
}
