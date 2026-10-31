/**
 * Save version the e2e fixtures write into their hand-built saves. Must equal SAVE_VERSION in
 * packages/server/src/save.ts (tests/fixtures/save-version.test.ts checks it). During the source
 * retrofit older saves are refused, so bump this together with SAVE_VERSION.
 */
export const E2E_SAVE_VERSION = 21;
