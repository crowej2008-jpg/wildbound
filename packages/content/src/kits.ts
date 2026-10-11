import ember from '../kits/ember.json';
import frost from '../kits/frost.json';
import grove from '../kits/grove.json';
import shade from '../kits/shade.json';
import tide from '../kits/tide.json';
import volt from '../kits/volt.json';
import { kitSchema, type KitJson } from './schemas';

/**
 * All 36 skill kits (M2), grouped by faction and validated on load. The CLI's
 * `kit-loader` reads the same JSON from disk and converts it to the engine's
 * `KitDef`; this export lets the client/preview use kits without filesystem
 * access.
 */
const RAW: unknown[] = [...ember, ...tide, ...grove, ...volt, ...frost, ...shade];

export const KITS: KitJson[] = RAW.map((kit) => kitSchema.parse(kit));

export function kitById(id: string): KitJson | undefined {
  return KITS.find((k) => k.id === id);
}
