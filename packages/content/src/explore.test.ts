import { describe, expect, it } from 'vitest';
import { STAGES } from './stages';
import { EXPLORE } from './tuning';

const EXPECTED_GATES: Record<string, unknown[]> = {
  'hoopa-vault': [{ kind: 'serverDay', day: 15 }],
  'rift-arena': [
    { kind: 'campaign', chapter: 10, stage: 10 },
    { kind: 'level', level: 10 },
  ],
  'sky-pillar': [{ kind: 'campaign', chapter: 7, stage: 1 }],
  'faction-tower': [{ kind: 'campaign', chapter: 28, stage: 10 }],
  'misty-woods': [{ kind: 'campaign', chapter: 3, stage: 10 }],
  'pet-home': [{ kind: 'campaign', chapter: 1, stage: 10 }],
  'island-challenge': [
    { kind: 'campaign', chapter: 3, stage: 10 },
    { kind: 'level', level: 10 },
  ],
  'ultra-wormhole': [
    { kind: 'campaign', chapter: 10, stage: 10 },
    { kind: 'level', level: 50 },
  ],
};

describe('explore content', () => {
  it('has the eight planned mode shells in display order', () => {
    expect(EXPLORE.modes.map((mode) => mode.id)).toEqual([
      'hoopa-vault',
      'rift-arena',
      'sky-pillar',
      'faction-tower',
      'misty-woods',
      'pet-home',
      'island-challenge',
      'ultra-wormhole',
    ]);
    expect(new Set(EXPLORE.modes.map((mode) => mode.name)).size).toBe(8);
  });

  it('uses the locked A-gate values and every campaign gate resolves', () => {
    const stageIds = new Set(STAGES.map((stage) => stage.id));
    for (const mode of EXPLORE.modes) {
      expect(mode.gates).toEqual(EXPECTED_GATES[mode.id]);
      expect(mode.features.length).toBeGreaterThan(0);
      expect(mode.scale.length).toBeGreaterThan(0);
      expect(mode.sigil.length).toBeLessThanOrEqual(3);
      for (const gate of mode.gates) {
        if (gate.kind === 'campaign') {
          expect(stageIds.has(`c${gate.chapter}-${gate.stage}`)).toBe(true);
        }
      }
    }
  });

  it('only exposes resets the engine knows', () => {
    for (const mode of EXPLORE.modes) {
      expect(['daily', 'weekly', 'permanent']).toContain(mode.reset);
      expect(mode.arrivesIn.length).toBeGreaterThan(0);
    }
  });
});
