import { readFileSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import {
  combatSettingsSchema,
  contentManifest,
  growthSchema,
  kitSchema,
  powerSchema,
  speciesSchema,
  type KitJson,
  type SpeciesJson,
} from '@wildbound/content';
import { findFiles, GuardViolation, scanBinaryMedia, scanForbidden } from './ipguard';

/**
 * Structural view of a Zod schema so the CLI never imports `zod` directly
 * (avoids a second copy of the library and its types).
 */
interface SafeParseError {
  issues: { path: (string | number)[]; message: string }[];
}
type AnySchema = {
  safeParse(input: unknown): { success: true; data: unknown } | { success: false; error: SafeParseError };
};

export interface ValidateReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checks: string[];
}

const PACKAGE_DIRS = ['engine', 'content', 'server', 'client', 'cli'];

/** Tuning files are identified by filename; each maps to exactly one schema. */
const TUNING_SCHEMAS: Record<string, AnySchema> = {
  'combat.json': combatSettingsSchema,
  'growth.json': growthSchema,
  'power.json': powerSchema,
};

/**
 * Structural checks that grow with content milestones. What ships today:
 *  - the content tree exists with the declared data dirs,
 *  - every .json under packages/content parses and has no duplicate ids,
 *  - species/kits parse against their schemas and cross-reference (same
 *    id/faction/class/tier),
 *  - tuning files validate against the schema named by their filename,
 *  - the IP guard passes (no franchise terms in content, no binary media under
 *    packages/),
 *  - no empty-string `id`/`name` fields in content JSON.
 */
export function validateContent(repoRoot: string): ValidateReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks: string[] = [];

  const contentRoot = resolve(repoRoot, 'packages', 'content');
  const species = new Map<string, { file: string; data: SpeciesJson }>();
  const kits = new Map<string, { file: string; data: KitJson }>();

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

      if (dir === 'kits') {
        validateList(file, parsed, kitSchema, errors, checks, (data: KitJson) => {
          registerUnique(kits, file, data.id, data, errors);
        }, 'kit');
      } else if (dir === 'species') {
        validateList(file, parsed, speciesSchema, errors, checks, (data: SpeciesJson) => {
          registerUnique(species, file, data.id, data, errors);
        }, 'species');
      } else if (dir === 'tuning') {
        const schema = TUNING_SCHEMAS[basename(file)];
        if (!schema) {
          errors.push(`${file}: unknown tuning file (expected one of ${Object.keys(TUNING_SCHEMAS).join(', ')})`);
          continue;
        }
        const r = schema.safeParse(parsed);
        if (!r.success) errors.push(`${file}: tuning schema — ${describeZod(r.error.issues)}`);
        else checks.push(`${file}: tuning validated against ${basename(file)} schema`);
      }
    }
    checks.push(`parsed ${jsonFiles.length} JSON file(s) in packages/content/${dir}`);
  }

  crossReference(species, kits, errors, checks);
  checkSpeciesCoverage(species, errors, checks);

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

function validateList<T>(
  file: string,
  parsed: unknown,
  schema: AnySchema,
  errors: string[],
  checks: string[],
  onValid: (data: T) => void,
  label: string,
): void {
  const raws = Array.isArray(parsed) ? parsed : [parsed];
  let valid = 0;
  raws.forEach((raw, index) => {
    const r = schema.safeParse(raw);
    if (!r.success) {
      errors.push(`${file}${Array.isArray(parsed) ? `[${index}]` : ''}: ${label} schema — ${describeZod(r.error.issues)}`);
      return;
    }
    valid += 1;
    onValid(r.data as T);
  });
  checks.push(`${file}: ${valid}/${raws.length} ${label}(s) validated against ${label} schema`);
}

function registerUnique<T>(
  map: Map<string, { file: string; data: T }>,
  file: string,
  id: string,
  data: T,
  errors: string[],
): void {
  const prev = map.get(id);
  if (prev) {
    errors.push(`${file}: duplicate id "${id}" (already defined in ${prev.file})`);
    return;
  }
  map.set(id, { file, data });
}

function crossReference(
  species: Map<string, { file: string; data: SpeciesJson }>,
  kits: Map<string, { file: string; data: KitJson }>,
  errors: string[],
  checks: string[],
): void {
  for (const [id, entry] of species) {
    const kit = kits.get(id);
    if (!kit) {
      errors.push(`${entry.file}: species "${id}" has no matching kit`);
      continue;
    }
    const s = entry.data;
    const k = kit.data;
    if (s.faction !== k.faction) errors.push(`${entry.file}: species "${id}" faction ${s.faction} != kit faction ${k.faction}`);
    if (s.class !== k.class) errors.push(`${entry.file}: species "${id}" class ${s.class} != kit class ${k.class}`);
    if (s.tier !== k.tier) errors.push(`${entry.file}: species "${id}" tier ${s.tier} != kit tier ${k.tier}`);
  }
  for (const [id, kit] of kits) {
    if (!species.has(id)) errors.push(`${kit.file}: kit "${id}" has no matching species`);
  }
  if (species.size > 0) checks.push(`cross-reference: ${species.size} species ↔ ${kits.size} kits`);
}

function checkSpeciesCoverage(
  species: Map<string, { file: string; data: SpeciesJson }>,
  errors: string[],
  checks: string[],
): void {
  if (species.size === 0) return;
  const perFaction = new Map<string, number>();
  for (const { data } of species.values()) {
    perFaction.set(data.faction, (perFaction.get(data.faction) ?? 0) + 1);
  }
  for (const [faction, count] of perFaction) {
    if (count !== 6) errors.push(`species: faction "${faction}" has ${count} species (expected 6)`);
  }
  checks.push(`species coverage: ${perFaction.size} faction(s), ${species.size} total`);
}

function exists(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function checkRecord(value: unknown): GuardViolation[] {
  if (Array.isArray(value)) return value.flatMap((v) => checkRecord(v));
  if (value === null || typeof value !== 'object') return [];
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

function describeZod(issues: { path: (string | number)[]; message: string }[]): string {
  return issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}
