import { mulberry32 } from '../rng';
import { resolveSheet } from './stats';
import { resolveSettings, type CombatSettings } from './settings';
import { takeTurn } from './skills';
import { tickBigRoundBuffs, tickUnitBuffs } from './buffs';
import { fireTriggers } from './triggers';
import { soulheartBattleStart, soulheartRoundEnd, soulheartRoundStart } from './soulheart';
import type {
  BattleConfig,
  BattleContext,
  BattleEvent,
  BattleResult,
  Combatant,
  SpecInput,
} from './types';

/**
 * The battle loop. One big round = every living unit acts once in effective
 * SPD order (ties: attackers first, then lower position — assumption, see
 * docs/ASSUMPTIONS.md). The time-out goes to the defender at maxRounds; a side
 * wiped mid-round decides earlier.
 */
export function runBattle(config: BattleConfig): BattleResult {
  const settings = resolveSettings(config.settings);
  if (config.mode) settings.mode = config.mode;
  const deterministic = config.deterministic === true;
  const rng = deterministic ? () => 0.999999 : mulberry32(config.seed);

  const units: Combatant[] = [
    ...spawn(config.attackers, 'attackers', settings),
    ...spawn(config.defenders, 'defenders', settings),
  ];

  const events: BattleEvent[] = [];
  const ctx: BattleContext = {
    settings,
    rng,
    units,
    events,
    weather: config.weather,
    rules: config.rules,
    strategies: config.strategies,
    deterministic,
    round: 0,
    alreadyAppliedHooks: new Set<string>(),
    damageDealt: {},
    damageTaken: {},
    healingDone: {},
  };

  const team = {
    attackersPower: sumPower(config.attackers),
    defendersPower: sumPower(config.defenders),
  };

  let winner: 'attackers' | 'defenders' | undefined;

  // M11.4: Soul-heart battle-start shields/guards, then M9.4 triggers.
  soulheartBattleStart(ctx);
  for (const u of units) fireTriggers(ctx, u, 'battleStart');

  const survival = config.rules?.survivalRounds;
  const roundLimit = config.rules?.roundLimit;
  const caps = [settings.maxRounds];
  if (survival !== undefined) caps.push(Math.max(1, Math.floor(survival)));
  if (roundLimit !== undefined) caps.push(Math.max(1, Math.floor(roundLimit)));
  const maxRounds = Math.min(...caps);

  for (let bigRound = 1; bigRound <= maxRounds; bigRound += 1) {
    ctx.round = bigRound;
    refreshSafeguards(ctx, bigRound);
    soulheartRoundStart(ctx);
    applyRoundEffects(ctx);
    events.push({ type: 'roundStart', bigRound });
    for (const u of units) if (u.alive) fireTriggers(ctx, u, 'roundStart');

    for (const u of turnOrder(ctx)) {
      if (!u.alive) continue;
      fireTriggers(ctx, u, 'turnStart');
      takeTurn(ctx, u, { bigRound, team });
      fireTriggers(ctx, u, 'turnEnd');
      tickUnitBuffs(u, ctx);
      if (sideDead(ctx, 'attackers')) {
        winner = 'defenders';
        break;
      }
      if (sideDead(ctx, 'defenders')) {
        winner = 'attackers';
        break;
      }
    }

    // advance the lost-HP ledger for counters, tick big-round-wide buffs
    for (const u of units) {
      if (u.alive) fireTriggers(ctx, u, 'roundEnd');
      u.lostLastRound = u.lostThisRound;
      u.lostThisRound = 0;
      tickBigRoundBuffs(u, ctx);
    }
    soulheartRoundEnd(ctx, bigRound);

    events.push({ type: 'roundEnd', bigRound });
    if (winner) break;
  }

  // Survival trials flip the time-out: the attackers win if any survives.
  const finalWinner: 'attackers' | 'defenders' =
    winner ?? (survival !== undefined && !sideDead(ctx, 'attackers') ? 'attackers' : 'defenders');
  events.push({ type: 'result', winner: finalWinner, rounds: countRounds(events) });

  return finalize(ctx, config, finalWinner);
}

function spawn(specs: SpecInput[], side: 'attackers' | 'defenders', settings: CombatSettings): Combatant[] {
  return specs.map((spec) => {
    const sheet = resolveSheet(spec);
    const rage = spec.kit.talents?.rageStart ?? (spec.kit.class === 'striker' ? settings.rageStrikerStart : settings.rageStart);
    return {
      key: `${side}:${spec.position}`,
      id: spec.id,
      name: spec.name,
      side,
      position: spec.position,
      column: spec.position <= 3 ? spec.position : spec.position - 3,
      row: spec.position <= 3 ? 'back' : 'front',
      kit: spec.kit,
      sheet,
      base: sheet,
      maxHp: sheet.hp,
      hp: sheet.hp,
      shieldHp: 0,
      rage,
        alive: true,
      buffs: [],
      lostThisRound: 0,
      lostLastRound: 0,
      roundEffects: spec.roundEffects ?? [],
      soulheart: spec.soulheart,
      resources: {},
      level: spec.level ?? 1,
      ...(spec.factionBoost ? { factionBoost: spec.factionBoost } : {}),
      ...(spec.triggers && spec.triggers.length > 0 ? { triggers: spec.triggers } : {}),
      ...(spec.damageMods && spec.damageMods.length > 0 ? { damageMods: spec.damageMods } : {}),
    };
  });
}

function turnOrder(ctx: BattleContext): Combatant[] {
  return ctx.units
    .filter((u) => u.alive)
    .slice()
    .sort((a, b) => {
      const spdDiff = b.base.spd - a.base.spd;
      if (spdDiff !== 0) return spdDiff;
      if (a.side !== b.side) return a.side === 'attackers' ? -1 : 1;
      return a.position - b.position;
    });
}

function sideDead(ctx: BattleContext, side: 'attackers' | 'defenders'): boolean {
  return !ctx.units.some((u) => u.side === side && u.alive);
}

function refreshSafeguards(ctx: BattleContext, bigRound: number): void {
  for (const u of ctx.units) {
    u.buffs = u.buffs.filter((b) => b.tag !== 'safeguard');
    const sg = u.kit.talents?.safeguard;
    if (!sg || ((bigRound - 1) % sg.cycle) >= sg.active) continue;
    u.buffs.push({ tag: 'safeguard', kind: 'immune', source: u.id });
  }
}

/** M7: apply equipment round effects once, at the start of their big round. */
function applyRoundEffects(ctx: BattleContext): void {
  for (const u of ctx.units) {
    if (!u.alive) continue;
    for (const fx of u.roundEffects ?? []) {
      if (fx.fromRound !== ctx.round) continue;
      const key = `${u.key}#fx#${fx.tag}#${fx.fromRound}`;
      if (ctx.alreadyAppliedHooks.has(key)) continue;
      ctx.alreadyAppliedHooks.add(key);
      if (fx.bigRounds !== undefined) {
        u.buffs.push({
          tag: fx.tag,
          kind: 'stat',
          source: u.id,
          field: fx.field,
          amount: fx.add ?? 0,
          bigRounds: fx.bigRounds,
        });
        ctx.events.push({ type: 'buffApplied', unit: u.key, tag: fx.tag, amount: fx.add ?? 0 });
        continue;
      }
      if (fx.mult !== undefined) u.sheet[fx.field] *= fx.mult;
      if (fx.add !== undefined) u.sheet[fx.field] += fx.add;
      ctx.events.push({ type: 'buffApplied', unit: u.key, tag: fx.tag, amount: fx.add ?? 0 });
    }
  }
}

function sumPower(specs: SpecInput[]): number {
  return specs.reduce((acc, s) => acc + (s.power ?? 0), 0);
}

function countRounds(events: BattleEvent[]): number {
  return events.filter((e) => e.type === 'roundStart').length;
}

function finalize(ctx: BattleContext, config: BattleConfig, winner: 'attackers' | 'defenders'): BattleResult {
  return {
    battleId: config.battleId ?? `wb-${config.seed}`,
    seed: config.seed,
    winner,
    rounds: countRounds(ctx.events),
    events: ctx.events,
    units: ctx.units.map((u) => ({
      key: u.key,
      id: u.id,
      side: u.side,
      position: u.position,
      alive: u.alive,
      hp: u.hp,
      maxHp: u.maxHp,
      damageDealt: ctx.damageDealt[u.key] ?? 0,
      damageTaken: ctx.damageTaken[u.key] ?? 0,
      healingDone: ctx.healingDone[u.key] ?? 0,
    })),
    damageDealt: ctx.damageDealt,
  };
}