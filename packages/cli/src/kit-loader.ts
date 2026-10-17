import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { kitSchema, kitToEngine } from '@wildbound/content';
import type { KitDef } from '@wildbound/engine';

/**
 * Loads every skill-kit in packages/content/kits. The content→engine conversion
 * lives in `@wildbound/content` (`kitToEngine`) so the CLI and the server share
 * one implementation; only the filesystem walk is CLI-specific.
 */
export { kitToEngine };

/** Read + validate + convert every kit under the given kits dir. A file may
 * hold a single kit object (M1) or an array of kits (M2, one file per faction). */
export function loadKits(kitsDir: string): KitDef[] {
  const out: KitDef[] = [];
  for (const file of readdirSync(kitsDir)) {
    if (!file.endsWith('.json')) continue;
    const parsed: unknown = JSON.parse(readFileSync(resolve(kitsDir, file), 'utf8'));
    const raws = Array.isArray(parsed) ? parsed : [parsed];
    for (const raw of raws) out.push(kitToEngine(kitSchema.parse(raw)));
  }
  return out;
}
