import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentManifest } from '@wildbound/content';
import { runBattle } from '@wildbound/engine';
import { validateContent } from './validate-content';
import { loadKits } from './kit-loader';
import { buildSpecs, readScenario, renderResult, scenarioSettings } from './sim';
import { exportGoldens } from './golden';

/** Repo root, derived from this file (packages/cli/src -> ../../../). */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const HELP = `
Wildbound CLI

Commands:
  simulate <scenario.json> [--json] [--deterministic] [--seed N]
            run a battle described by a scenario JSON (packages/cli/tests/golden/scenarios)
  golden-export            regenerate golden baselines from every scenario (M1 regression lock)
  content:validate         validate content schemas, ids, references + IP guard
  help                     show this help
`;

function floors(args: string[]): { json: boolean; deterministic: boolean; seed: number | undefined } {
  const seedIdx = args.indexOf('--seed');
  const seed = seedIdx >= 0 && args[seedIdx + 1] !== undefined ? Number(args[seedIdx + 1]) : undefined;
  return { json: args.includes('--json'), deterministic: args.includes('--deterministic'), seed };
}

function simulate(rest: string[]): void {
  const file = rest.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('simulate: a scenario JSON path is required (see help)');
    process.exit(1);
  }
  const { json, deterministic, seed } = floors(rest);
  const scenario = readScenario(resolve(process.cwd(), file));
  const load = loadKits(resolve(repoRoot, 'packages/content/kits'));
  const kits = new Map(load.map((k) => [k.id, k]));
  const result = runBattle({
    attackers: buildSpecs('attackers', scenario.attackers, kits),
    defenders: buildSpecs('defenders', scenario.defenders, kits),
    seed: seed ?? scenario.seed,
    deterministic: deterministic ?? scenario.deterministic,
    mode: scenario.mode,
    settings: scenarioSettings(scenario),
  });
  console.log(renderResult(result, { json }));
  console.log(`simulate: winner=${result.winner} rounds=${result.rounds}`);
}

function goldenExport(): void {
  const kits = [
    ...loadKits(resolve(repoRoot, 'packages/content/kits')),
    // M1 parity fixtures — kept out of the shipped roster (see ASSUMPTIONS).
    ...loadKits(resolve(repoRoot, 'packages/cli/tests/golden/kits')),
  ];
  const kitMap = new Map(kits.map((k) => [k.id, k]));
  const scenariosDir = resolve(repoRoot, 'packages/cli/tests/golden/scenarios');
  const baselinesDir = resolve(repoRoot, 'packages/cli/tests/golden/baselines');
  console.log('[golden] exporting deterministic baselines…');
  const exports = exportGoldens(scenariosDir, baselinesDir, kitMap);
  console.log('[golden] done.');
  for (const r of exports) {
    console.log(`  ${r.changed ? 'changed' : r.created ? 'new' : 'ok  '} ${r.path}`);
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const [command, ...rest] = args;

  switch (command) {
    case 'simulate':
      simulate(rest);
      break;
    case 'golden-export':
      goldenExport();
      break;
    case 'content:validate': {
      const report = validateContent(repoRoot);
      const line = (s: string) => console.log(`  ${s}`);
      console.log(`Wildbound content ${contentManifest.game} v${contentManifest.schemaVersion}`);
      console.log('checks:');
      report.checks.forEach(line);
      if (report.warnings.length > 0) {
        console.log('warnings:');
        report.warnings.forEach(line);
      }
      if (report.errors.length > 0) {
        console.log('errors:');
        report.errors.forEach(line);
      }
      if (report.ok) {
        console.log('content:validate: PASS');
      } else {
        console.error(`content:validate: FAIL (${report.errors.length} error(s))`);
        process.exit(1);
      }
      break;
    }
    default:
      if (command === 'help' || command === undefined) {
        console.log(HELP);
      } else {
        console.error(`unknown command: ${command}`);
        console.error(HELP);
        process.exit(1);
      }
  }
}

main();