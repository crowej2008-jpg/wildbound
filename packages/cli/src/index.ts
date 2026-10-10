import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentManifest } from '@wildbound/content';
import { validateContent } from './validate-content';

/** Repo root, derived from this file (packages/cli/src -> ../../../). Scripts
 * run with the package dir as cwd, so process.cwd() is not reliable here. */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const HELP = `
Wildbound CLI (pnpm sim is the combat simulator; land by M1)

Commands:
  simulate [args...]       run the deterministic combat simulator (arrives in M1)
  golden-export [args...]  export golden battle batches from the Python reference (M1)
  content:validate         validate content schemas, ids, references + IP guard
  help                     show this help
`;

function main(): void {
  const args = process.argv.slice(2);
  const [command, ...rest] = args;

  switch (command) {
    case 'simulate': {
      console.log('[sim] The deterministic combat simulator lands in Milestone 1 (docs/SCOPE.md).');
      console.log(`[sim] args: ${rest.join(' ') || '(none)'}`);
      break;
    }
    case 'golden-export': {
      console.log('[golden] Golden export against the Python reference lands in Milestone 1.');
      console.log(`[golden] args: ${rest.join(' ') || '(none)'}`);
      break;
    }
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