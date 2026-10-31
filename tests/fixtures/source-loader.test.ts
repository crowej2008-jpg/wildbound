import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { describeTable, isNoteKey, loadCatalog, loadTable, tableRows } from '../../scripts/source/source.mjs';

/** A throwaway h5-client folder with two dated dumps. */
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'wildbound-source-'));
  mkdirSync(join(root, '2026-10-02'));
  mkdirSync(join(root, '2026-10-03'));
  writeFileSync(
    join(root, '2026-10-02', 'a_cfg.json'),
    JSON.stringify({
      _about: 'notes',
      shared_json: { '1': { lev: 1, cost: 5 } },
      list_json: [{ id: 1 }, { id: 2 }],
    }),
  );
  writeFileSync(
    join(root, '2026-10-03', 'b_cfg.json'),
    JSON.stringify({ shared_json: { '1': { lev: 1, cost: 9 }, '2': { lev: 2, cost: 12 } } }),
  );
  return root;
}

describe('source-retrofit loader', () => {
  it('reads tables, lets the latest-dated dump win and skips research notes', () => {
    const root = fixture();
    const catalog = loadCatalog(root);
    expect([...catalog.keys()].sort()).toEqual(['list_json', 'shared_json']);
    expect(catalog.get('shared_json')?.file).toBe(join('2026-10-03', 'b_cfg.json'));
    expect(tableRows('shared_json', root)).toEqual([
      { lev: 1, cost: 9 },
      { lev: 2, cost: 12 },
    ]);
    expect(tableRows('list_json', root)).toHaveLength(2);
    expect(describeTable(loadTable('shared_json', root))).toEqual({ rows: 2, fields: ['lev', 'cost'] });
    expect(isNoteKey('_about')).toBe(true);
  });

  it('fails loudly on an unknown table or a missing source folder', () => {
    const root = fixture();
    expect(() => loadTable('nope_json', root)).toThrow(/Unknown source table/);
    expect(() => loadCatalog(join(root, 'missing'))).toThrow(/Source dumps not found/);
  });
});
