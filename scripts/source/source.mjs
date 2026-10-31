/* eslint-disable no-undef */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Source-retrofit loader (R0). Reads the source game's own config tables — the H5 client dumps in
 * `reference/game-rebuild/data/h5-client/<date>/*.json` — so import scripts can copy them exactly
 * (owner decision 2026-10-31, docs/ASSUMPTIONS.md override #11).
 *
 * `reference/` is gitignored and lives only on the owner's PC, so import scripts run there (or
 * wherever the dumps are staged) and their generated content JSON is committed. The runtime and CI
 * never read the dumps. Point WILDBOUND_SOURCE at another copy of the h5-client folder if needed.
 *
 * Each dump is a JSON object of `table name → rows` (rows are a list or an id-keyed object), plus
 * `_about` / `_version` notes and some `_derived` summaries made by the research tooling. When a
 * table appears in more than one dump, the latest-dated dump wins (AGENTS.md: prefer the
 * later-dated statement).
 */

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const sourceRoot = resolve(
  process.env.WILDBOUND_SOURCE ?? join(repoRoot, 'reference/game-rebuild/data/h5-client'),
);

let catalog;

/** Every dump file, oldest date first. */
export function dumpFiles(root = sourceRoot) {
  if (!existsSync(root)) {
    throw new Error(
      `Source dumps not found at ${root}. They live in the owner's reference/ folder (gitignored); ` +
        'run this on his machine or set WILDBOUND_SOURCE.',
    );
  }
  const files = [];
  for (const dated of readdirSync(root, { withFileTypes: true })) {
    if (!dated.isDirectory()) continue;
    for (const file of readdirSync(join(root, dated.name))) {
      if (file.endsWith('.json')) files.push(join(root, dated.name, file));
    }
  }
  return files.sort();
}

/** True for research notes rather than game tables (`_about`, `_text`, `about`, …). */
export function isNoteKey(key) {
  return key.startsWith('_') || key === 'about' || key === 'version';
}

/** Map of table name → { file, data } for the latest dump that holds it. */
export function loadCatalog(root = sourceRoot) {
  if (catalog && catalog.root === root) return catalog.tables;
  const tables = new Map();
  for (const file of dumpFiles(root)) {
    const dump = JSON.parse(readFileSync(file, 'utf8'));
    for (const [name, data] of Object.entries(dump)) {
      if (isNoteKey(name)) continue;
      tables.set(name, { file: relative(root, file), data });
    }
  }
  catalog = { root, tables };
  return tables;
}

/** A table's raw data exactly as dumped. Throws on an unknown name so typos fail loudly. */
export function loadTable(name, root = sourceRoot) {
  const entry = loadCatalog(root).get(name);
  if (!entry) throw new Error(`Unknown source table "${name}"; see docs/SOURCE-TABLES.md.`);
  return entry.data;
}

/** A table's rows as a list (id-keyed objects become their values, in key order). */
export function tableRows(name, root = sourceRoot) {
  const data = loadTable(name, root);
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return Object.values(data);
  return [data];
}

/** Row count and the field names of the first row, for the index. */
export function describeTable(data) {
  const rows = Array.isArray(data) ? data : data && typeof data === 'object' ? Object.values(data) : [data];
  const first = rows.find((row) => row && typeof row === 'object' && !Array.isArray(row));
  return { rows: rows.length, fields: first ? Object.keys(first) : [] };
}
