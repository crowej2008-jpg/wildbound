import { mulberry32 } from '../rng';
import { resolveSheet } from './stats';
import { resolveSettings, type CombatSettings } from './settings';
import { takeTurn } from './skills';
import { tickBigRoundBuffs, tickUnitBuffs } from './buffs';
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

  for (let bigRound = 1; bigRound <= settings.maxRounds; bigRound += 1) {
    ctx.round = bigRound;
    refreshSafeguards(ctx, bigRound);
    events.push({ type: 'roundStart', bigRound });

    for (const u of turnOrder(ctx)) {
      if (!u.alive) continue;
      takeTurn(ctx, u, { bigRound, team });
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
      u.lostLastRound = u.lostThisRound;
      u.lostThisRound = 0;
      tickBigRoundBuffs(u, ctx);
    }

    events.push({ type: 'roundEnd', bigRound });
    if (winner) break;
  }

  const finalWinner: 'attackers' | 'defenders' = winner ?? 'defenders';
  events.push({ type: 'result', winner: finalWinner, rounds: countRounds(events) });

  return finalize(ctx, config, finalWinner);
}

function spawn(specs: SpecInput[], side: 'attackers' | 'defenders', settings: CombatSettings): Combatant[] {
  return specs.map((spec) => {
    const sheet = resolveSheet(spec);
    const rage = spec.kit.class === 'striker' ? settings.rageStrikerStart : settings.rageStart;
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