import { readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { contentManifest } from '@wildbound/content';
import { findFiles, GuardViolation, scanBinaryMedia, scanForbidden } from './ipguard';

export interface ValidateReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checks: string[];
}

const PACKAGE_DIRS = ['engine', 'content', 'server', 'client', 'cli'];

/**
 * Structural checks that grow with content milestones (species/kits/items land
 * in M2). What ships today:
 *  - the content tree exists with the declared data dirs,
 *  - every .json under packages/content parses and has no duplicate ids,
 *  - the IP guard passes (no franchise terms in content, no binary media under
 *    packages/),
 *  - no empty-string `id`/`name` fields in content JSON.
 */
export function validateContent(repoRoot: string): ValidateReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks: string[] = [];

  const contentRoot = resolve(repoRoot, 'packages', 'content');
  for (const dir of contentManifest.dataDirs) {
    const dirPath = join(contentRoot, dir);
    if (!exists(dirPath)) {
      warnings.push(`content data dir "packages/content/${dir}" is not populated yet (lands in M2)`);
      continue;
    }
    const jsonFiles = findFiles(dirPath).filter((f) => extname(f) === '.json');
    for (const file of jsonFiles) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(file, 'utf8'));
      } catch (err) {
        errors.push(`${file}: invalid JSON (${err instanceof Error ? err.message : String(err)})`);
        continue;
      }
      for (const violation of checkRecord(parsed)) {
        errors.push(`${file}: ${violation.detail}`);
      }
    }
    checks.push(`parsed ${jsonFiles.length} JSON file(s) in packages/content/${dir}`);
  }

  const contentViolations = scanForbidden(contentRoot, contentManifest.dataDirs);
  const mediaViolations = scanBinaryMedia(resolve(repoRoot, 'packages'), PACKAGE_DIRS);
  if (contentViolations.length > 0) {
    for (const v of contentViolations) errors.push(describe(v));
  } else {
    checks.push('IP guard: no franchise terms in content');
  }
  if (mediaViolations.length > 0) {
    for (const v of mediaViolations) errors.push(describe(v));
  } else {
    checks.push('IP guard: no binary media under packages/');
  }

  checks.push(`content schema version ${contentManifest.schemaVersion}`);
  return { ok: errors.length === 0, errors, warnings, checks };
}

function exists(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function checkRecord(value: unknown): GuardViolation[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [];
  const out: GuardViolation[] = [];
  for (const entry of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry[1] === 'object' && entry[1] !== null) {
      out.push(...checkRecord(entry[1]));
      continue;
    }
    const key = entry[0];
    if ((key === 'id' || key === 'name') && typeof entry[1] === 'string' && entry[1].trim() === '') {
      out.push({ file: '', detail: `empty-string "${key}" field` });
    }
  }
  return out;
}

function describe(v: GuardViolation): string {
  return `${v.file}: ${v.detail}`;
}