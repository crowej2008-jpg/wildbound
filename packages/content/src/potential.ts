import potential from '../potential/potential.json';
import { potentialSchema } from './potential-schema';

/** R4: the source's Potential trees, costs and options (scripts/import-potential.mjs). */
export const POTENTIAL = potentialSchema.parse(potential);
export { potentialSchema, type PotentialJson } from './potential-schema';
