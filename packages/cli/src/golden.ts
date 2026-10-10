import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runBattle, type KitDef } from '@wildbound/engine';
import { buildSpecs, foldEvents, scenarioId, readScenario, scenarioSettings, type Scenario } from './sim';

/**
 * Golden regression for M1. reference/sim (the Python simulator) is not part of
 * the repo, so the golden lock is a deterministic TypeScript replay suite: a
 * scenario JSON + a committed baseline of the folded event log. `pnpm
 * golden-export` regenerates baselines; `golden.test.ts` replays and must match
 * byte-for-byte. See docs/design/combat.md.
 */

export interface GoldenBaseline {
  scenario: Scenario;
  seed: number;
  deterministic: true;
  winner: 'attackers' | 'defenders';
  rounds: number;
  fold: string[];
  units: { key: string; alive: boolean; hp: number }[];
}

export function runGolden(scenario: Scenario, kits: ReadonlyMap<string, KitDef>): GoldenBaseline {
  const result = runBattle({
    attackers: buildSpecs('attackers', scenario.attackers, kits),
    defenders: buildSpecs('defenders', scenario.defenders, kits),
    seed: scenario.seed,
    mode: scenario.mode,
    settings: scenarioSettings(scenario),
    deterministic: true,
    battleId: `golden:${scenarioId(scenario)}`,
  });
  return {
    scenario,
    seed: scenario.seed,
    deterministic: true,
    winner: result.winner,
    rounds: result.rounds,
    fold: foldEvents(result.events),
    units: result.units.map((u) => ({ key: u.key, alive: u.alive, hp: u.hp })),
  };
}

export function readBaseline(path: string): GoldenBaseline {
  return JSON.parse(readFileSync(path, 'utf8')) as GoldenBaseline;
}

export interface GoldenExport {
  path: string;
  changed: boolean;
  created: boolean;
}

/** Export every scenario under scenariosDir into baselinesDir. */
export function exportGoldens(scenariosDir: string, baselinesDir: string, kits: ReadonlyMap<string, KitDef>): GoldenExport[] {
  mkdirSync(baselinesDir, { recursive: true });
  const out: GoldenExport[] = [];
  for (const file of readdirSync(scenariosDir)) {
    if (!file.endsWith('.json')) continue;
    const key = file.replace(/\.json$/, '');
    const scenario = readScenario(resolve(scenariosDir, file));
    const baseline = runGolden(scenario, kits);
    const path = resolve(baselinesDir, `${key}.baseline.json`);
    const prev = existsSync(path) ? readBaseline(path) : undefined;
    const changed = prev !== undefined && (prev.winner !== baseline.winner || prev.rounds !== baseline.rounds || !sameFold(prev.fold, baseline.fold));
    writeFileSync(path, `${JSON.stringify(baseline, null, 2)}\n`);
    out.push({ path, changed, created: prev === undefined });
  }
  return out;
}

function sameFold(a: string[], b: string[]): boolean {
  return a.join('\n') === b.join('\n');
}