import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BINARY_MEDIA_EXTENSIONS,
  FORBIDDEN_WORDS,
  scanBinaryMedia,
  scanForbidden,
} from './ipguard';

let tmp: string;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'wildbound-ipguard-'));
  writeFileSync(join(tmp, 'bad.txt'), 'this mentions digimon somewhere', 'utf8');
  writeFileSync(join(tmp, 'good.txt'), 'a grove warden of the tide faction', 'utf8');
  writeFileSync(join(tmp, 'noise.png'), 'not really a png');
  writeFileSync(join(tmp, 'sound.mp3'), 'not really audio');
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('ip guard', () => {
  it('lists the non-Pokémon franchise words still refused', () => {
    expect(FORBIDDEN_WORDS).toContain('nintendo');
    expect(FORBIDDEN_WORDS).toContain('game freak');
    expect(FORBIDDEN_WORDS).toContain('digimon');
    expect(FORBIDDEN_WORDS).toContain('yokai');
    // Pokémon terms were dropped by the 2026-10-15 owner override (docs/ASSUMPTIONS.md).
    expect(FORBIDDEN_WORDS).not.toContain('pikachu');
    expect(FORBIDDEN_WORDS).not.toContain('pokemon');
  });

  it('flags forbidden terms case-insensitively', () => {
    const found = scanForbidden(tmp, ['.']);
    expect(found.some((v) => v.file.endsWith('bad.txt'))).toBe(true);
    expect(found.some((v) => v.file.endsWith('good.txt'))).toBe(false);
  });

  it('flags binary media files', () => {
    const found = scanBinaryMedia(tmp, ['.']);
    const names = found.map((v) => v.file);
    expect(names.some((f) => f.endsWith('noise.png'))).toBe(true);
    expect(names.some((f) => f.endsWith('sound.mp3'))).toBe(true);
    expect(names.some((f) => f.endsWith('good.txt'))).toBe(false);
  });

  it('keeps the binary-media blocklist intact', () => {
    expect(BINARY_MEDIA_EXTENSIONS.has('.png')).toBe(true);
  });
});