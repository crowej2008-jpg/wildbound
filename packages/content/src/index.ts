/**
 * Content registry for Wildbound.
 *
 * The content package is environment-neutral: it never reads the filesystem
 * (so the client can import it at build time and the CLI can validate the same
 * tables at runtime). Data lives in the sibling `data/` directories listed
 * below; the CLI validator walks them with `packages/content` as its root.
 */
export const CONTENT_DIRS = {
  species: 'species',
  kits: 'kits',
  items: 'items',
  stages: 'stages',
  shops: 'shops',
  quests: 'quests',
  tuning: 'tuning',
} as const;

export type ContentDir = (typeof CONTENT_DIRS)[keyof typeof CONTENT_DIRS];

export * from './schemas';
export type { KitJson, CombatSettingsJson } from './schemas';

/** Bumped when the shape of any content directory changes. */
export const CONTENT_SCHEMA_VERSION = 1;

export const contentManifest = {
  game: 'wildbound',
  schemaVersion: CONTENT_SCHEMA_VERSION,
  dataDirs: Object.values(CONTENT_DIRS),
} as const;