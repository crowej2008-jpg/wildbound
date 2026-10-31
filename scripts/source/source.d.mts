/** Types for source.mjs (the source-retrofit loader), so TypeScript tests can import it. */
export interface CatalogEntry {
  file: string;
  data: unknown;
}
export const repoRoot: string;
export const sourceRoot: string;
export function dumpFiles(root?: string): string[];
export function isNoteKey(key: string): boolean;
export function loadCatalog(root?: string): Map<string, CatalogEntry>;
export function loadTable(name: string, root?: string): unknown;
export function tableRows(name: string, root?: string): unknown[];
export function describeTable(data: unknown): { rows: number; fields: string[] };
