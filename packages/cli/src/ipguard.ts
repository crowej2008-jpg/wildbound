/**
 * IP guard (PROMPT.md Appendix C).
 *
 * Two duties, both enforced by the ip-guard unit test and by `content:validate`:
 *  1. No franchise names anywhere in shipped text (packages/*).
 *  2. No binary image/audio/font files anywhere under packages/ — all art and
 *     audio must be procedural, generated at build/render time.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

/**
 * Extend this list whenever another franchise name is noticed.
 *
 * Scope note (2026-10-15): the owner explicitly overrode the originality rule
 * for this private, never-distributed build, so Pokémon species and skill names
 * are permitted in `packages/content` (see docs/ASSUMPTIONS.md). The Pokémon
 * terms were therefore removed from this blocklist; the guard still refuses the
 * remaining franchise terms below and all binary media.
 */
export const FORBIDDEN_WORDS = ['nintendo', 'game freak', 'digimon', 'yokai'] as const;

/** Binary media extensions the guard refuses to see under packages/. */
export const BINARY_MEDIA_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.bmp',
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
  '.aac',
  '.flac',
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.mp4',
  '.webm',
  '.avi',
  '.mov',
  '.mkv',
]);

export interface GuardViolation {
  file: string;
  detail: string;
}

function walkFiles(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return; // absent directory: nothing to scan
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === 'coverage') continue;
      walkFiles(full, out);
    } else {
      out.push(full);
    }
  }
}

/** Collect every file under `dir`, skipping build outputs and dependencies. */
export function findFiles(dir: string): string[] {
  const out: string[] = [];
  walkFiles(dir, out);
  return out.sort();
}

/**
 * Scan the given directories under `root` for forbidden franchise words,
 * case-insensitively, skipping binary files. Returns one violation per match.
 */
export function scanForbidden(root: string, relDirs: string[]): GuardViolation[] {
  const found: GuardViolation[] = [];
  for (const rel of relDirs) {
    const dir = join(root, rel);
    for (const file of findFiles(dir)) {
      if (BINARY_MEDIA_EXTENSIONS.has(extname(file).toLowerCase())) continue;
      const text = readFileSync(file, 'utf8').toLowerCase();
      for (const word of FORBIDDEN_WORDS) {
        if (text.includes(word.toLowerCase())) {
          found.push({ file, detail: `forbidden term "${word}"` });
        }
      }
    }
  }
  return found;
}

/** Scan every directory under `root` for binary media files. */
export function scanBinaryMedia(root: string, relDirs: string[]): GuardViolation[] {
  const found: GuardViolation[] = [];
  for (const rel of relDirs) {
    const dir = join(root, rel);
    for (const file of findFiles(dir)) {
      if (BINARY_MEDIA_EXTENSIONS.has(extname(file).toLowerCase())) {
        found.push({ file, detail: 'binary image/audio/font files are not allowed under packages/' });
      }
    }
  }
  return found;
}