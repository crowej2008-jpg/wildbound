/**
 * IP guard (PROMPT.md Appendix C).
 *
 * The shipped game must contain zero franchise content. This suite:
 *  1. Scans packages/content, packages/client/src and the other shipped packages
 *     for every forbidden franchise term, case-insensitively.
 *  2. Fails if any file under packages/ is binary image/audio/font media — all
 *     art and audio must be procedural.
 *
 * The only legal locations for the forbidden terms themselves are the guard
 * implementation and its own tests (packages/cli/src/ipguard.ts and
 * ipguard.test.ts), which this suite skips.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BINARY_MEDIA_EXTENSIONS,
  FORBIDDEN_WORDS,
  scanBinaryMedia,
  scanForbidden,
} from '../../packages/cli/src/ipguard';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const SHIPPED_TEXT_DIRS = [
  'packages/content',
  'packages/client/src',
  'packages/engine/src',
  'packages/server/src',
  'packages/cli/src',
];

const GUARD_SELF = new Set(['ipguard.ts', 'ipguard.test.ts']);

describe('IP guard', () => {
  it('covers the non-Pokémon franchise terms still refused', () => {
    for (const word of ['nintendo', 'game freak', 'digimon', 'yokai']) {
      expect(FORBIDDEN_WORDS).toContain(word);
    }
  });

  it('shipped text contains no forbidden franchise terms', () => {
    const violations = scanForbidden(repoRoot, SHIPPED_TEXT_DIRS).filter(
      (v) => !GUARD_SELF.has(v.file.split(/[\\/]/).pop() ?? ''),
    );
    expect(violations).toEqual([]);
  });

  it('no binary image/audio/font files exist under packages/', () => {
    const media = scanBinaryMedia(repoRoot, ['packages']);
    expect(media).toEqual([]);
  });

  it('binary media extensions include the common formats', () => {
    for (const ext of ['.png', '.jpg', '.mp3', '.wav', '.ttf', '.woff2', '.mp4']) {
      expect(BINARY_MEDIA_EXTENSIONS.has(ext)).toBe(true);
    }
  });
});