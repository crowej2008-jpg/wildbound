import dark from '../kits/dark.json';
import fire from '../kits/fire.json';
import grass from '../kits/grass.json';
import light from '../kits/light.json';
import water from '../kits/water.json';
import { kitSchema, type KitJson } from './schemas';

/**
 * All 84 skill kits, grouped by the source's five factions and validated on load. The CLI's
 * `kit-loader` reads the same JSON from disk and converts it to the engine's
 * `KitDef`; this export lets the client/preview use kits without filesystem
 * access.
 */
const RAW: unknown[] = [...water, ...fire, ...grass, ...light, ...dark];

export const KITS: KitJson[] = RAW.map((kit) => kitSchema.parse(kit));

export function kitById(id: string): KitJson | undefined {
  return KITS.find((k) => k.id === id);
}
