import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { E2E_SAVE_VERSION } from '../e2e/save-version';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('e2e save fixtures', () => {
  it('write the current SAVE_VERSION', () => {
    const source = readFileSync(resolve(repoRoot, 'packages/server/src/save.ts'), 'utf8');
    const match = /export const SAVE_VERSION = (\d+);/.exec(source);
    expect(match).not.toBeNull();
    expect(E2E_SAVE_VERSION).toBe(Number(match?.[1]));
  });
});
