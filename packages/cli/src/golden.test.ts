import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadKits } from './kit-loader';
import { runGolden, readBaseline } from './golden';

/**
 * Golden regression lock (docs/design/combat.md §Golden): every committed
 * baseline under tests/golden/baselines must replay exactly in deterministic
 * mode. Baselines are regenerated with `pnpm golden-export`; if this test
 * fails, either the engine changed (update the baseline deliberately) or the
 * fold format changed.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const scenariosDir = resolve(repoRoot, 'packages/cli/tests/golden/scenarios');
const baselinesDir = resolve(repoRoot, 'packages/cli/tests/golden/baselines');

function loadKitsMap() {
  const kits = [
    ...loadKits(resolve(repoRoot, 'packages/content/kits')),
    // M1 parity fixtures — kept out of the shipped roster (see ASSUMPTIONS).
    ...loadKits(resolve(repoRoot, 'packages/cli/tests/golden/kits')),
  ];
  return new Map(kits.map((k) => [k.id, k]));
}

describe('golden regression', () => {
  const kits = loadKitsMap();
  const baselines = readdirSync(baselinesDir).filter((f) => f.endsWith('.json'));

  it('has at least one committed baseline', () => {
    expect(baselines.length).toBeGreaterThan(0);
  });

  it('every scenario has a committed baseline', () => {
    const scenarios = readdirSync(scenariosDir).filter((f) => f.endsWith('.json'));
    const baselineIds = new Set(baselines.map((f) => f.replace(/\.baseline\.json$/, '')));
    for (const s of scenarios) {
      expect(baselineIds.has(s.replace(/\.json$/, ''))).toBe(true);
    }
  });

  for (const file of baselines) {
    const name = file.replace(/\.baseline\.json$/, '');
    it(`replays ${name} exactly`, () => {
      const baseline = readBaseline(resolve(baselinesDir, file));
      const replay = runGolden(baseline.scenario, kits);
      expect(replay.winner).toBe(baseline.winner);
      expect(replay.rounds).toBe(baseline.rounds);
      expect(replay.fold).toEqual(baseline.fold);
      for (const u of baseline.units) {
        const replayed = replay.units.find((x) => x.key === u.key);
        expect(replayed?.alive).toBe(u.alive);
        expect(replayed?.hp).toBe(u.hp);
      }
    });
  }
});