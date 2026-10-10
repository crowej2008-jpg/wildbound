import { readFileSync } from 'node:fs';
import type {
  BattleEvent,
  BattleResult,
  CombatSettings,
  KitDef,
  SheetInput,
  SpecInput,
} from '@wildbound/engine';

/**
 * Scenario DSL for `pnpm sim`: JSON files describing a battle between two
 * six-slot teams. Kits are referenced by id and resolved through the content
 * directory at runtime; sheets default to a flat baseline and can be
 * overridden per unit.
 */

export interface ScenarioUnit {
  /** kit id in packages/content/kits (e.g. "tidewarden") */
  kit: string;
  name?: string;
  position: number;
  power?: number;
  sheet?: Partial<SheetInput>;
  rage?: number;
}

export interface Scenario {
  name: string;
  /** mulberry32 seed; deterministic replay ignores this for rolls but keeps id */
  seed: number;
  deterministic?: boolean;
  mode?: 'pvp' | 'pve';
  settings?: Record<string, number | boolean | string>;
  attackers: ScenarioUnit[];
  defenders: ScenarioUnit[];
}

/** Flat baseline every unit starts from unless overridden per unit. */
const BASE_SHEET: SheetInput = {
  hp: 1000,
  pAtk: 200,
  sAtk: 200,
  spd: 100,
};

export function buildSpec(
  u: ScenarioUnit,
  side: 'attackers' | 'defenders',
  kits: ReadonlyMap<string, KitDef>,
): SpecInput {
  const kit = kits.get(u.kit);
  if (!kit) throw new Error(`sim: unknown kit id "${u.kit}"`);
  return {
    id: `${side}-${u.position}`,
    name: u.name ?? kit.name,
    position: u.position,
    side,
    kit,
    sheet: { ...BASE_SHEET, ...u.sheet },
    power: u.power,
  };
}

export function buildSpecs(side: 'attackers' | 'defenders', units: ScenarioUnit[], kits: ReadonlyMap<string, KitDef>): SpecInput[] {
  return units.map((u) => buildSpec(u, side, kits));
}

export function readScenario(path: string): Scenario {
  return JSON.parse(readFileSync(path, 'utf8')) as Scenario;
}

export function scenarioId(scenario: Scenario): string {
  return scenario.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/** Scenario settings overrides as a Partial<CombatSettings> (JSON-safe values). */
export function scenarioSettings(scenario: Scenario): Partial<CombatSettings> | undefined {
  if (!scenario.settings) return undefined;
  return scenario.settings as unknown as Partial<CombatSettings>;
}

// ---- rendering -----------------------------------------------------------

export function foldEvents(events: BattleEvent[]): string[] {
  return events.map(fold);
}

function fold(e: BattleEvent): string {
  switch (e.type) {
    case 'roundStart':
      return `rs:${e.bigRound}`;
    case 'action':
      return `a:${e.unit}:${e.skill ?? '-'}`;
    case 'hit':
      return `h:${e.src}>${e.tgt}:${e.dmg}:${e.crit ? 'c' : e.blocked ? 'b' : '-'}:${e.hpAfter}${e.missed ? ':m' : e.hpShare ? ':s' : ''}`;
    case 'reflect':
      return `rf:${e.src}>${e.tgt}:${e.dmg}:${e.hpAfter}`;
    case 'heal':
      return `he:${e.tgt}:${e.amount}:${e.hpAfter}`;
    case 'shield':
      return `sh:${e.tgt}:${e.amount}:${e.shieldAfter}`;
    case 'buffApplied':
      return `ba:${e.unit}:${e.tag}:${e.amount}${e.stacks !== undefined ? `:${e.stacks}` : ''}`;
    case 'buffExpired':
      return `bx:${e.unit}:${e.tag}`;
    case 'control':
      return `co:${e.tgt}:${e.kind}:${e.landed ? 1 : 0}`;
    case 'rageChange':
      return `rg:${e.unit}:${e.delta}:${e.rage}`;
    case 'death':
      return `d:${e.unit}`;
    case 'immunity':
      return `im:${e.unit}:${e.kind}`;
    case 'roundEnd':
      return `re:${e.bigRound}`;
    case 'result':
      return `res:${e.winner}:${e.rounds}`;
  }
}

export function renderEvent(e: BattleEvent): string {
  const f = fold(e);
  const pretty =
    e.type === 'hit'
      ? `hit ${e.src} -> ${e.tgt}: ${e.dmg} dmg${e.crit ? ' (crit)' : ''}${e.blocked ? ' (blocked)' : ''}${e.missed ? ' (missed)' : ''}`
      : e.type === 'reflect'
        ? `reflect ${e.src} -> ${e.tgt}: ${e.dmg} dmg`
        : e.type === 'heal'
          ? `heal ${e.tgt}: +${e.amount}`
          : e.type === 'shield'
            ? `shield ${e.tgt}: +${e.amount}`
            : f;
  if (pretty === f) return `  ${f}`;
  return `  ${f}  // ${pretty}`;
}

export function renderResult(r: BattleResult, opts: { json?: boolean } = {}): string {
  if (opts.json) return JSON.stringify(r, null, 2);
  const lines: string[] = [];
  lines.push(`battle ${r.battleId} seed=${r.seed} winner=${r.winner} rounds=${r.rounds}`);
  lines.push('units:');
  for (const u of r.units) {
    lines.push(
      `  ${u.alive ? 'ALIVE' : 'dead '} ${u.key} hp=${u.hp}/${u.maxHp} dealt=${u.damageDealt} taken=${u.damageTaken} healed=${u.healingDone}`,
    );
  }
  lines.push('events:');
  for (const e of r.events) lines.push(renderEvent(e));
  return lines.join('\n');
}