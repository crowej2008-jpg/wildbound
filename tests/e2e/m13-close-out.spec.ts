import { expect, test } from '@playwright/test';
import { E2E_SAVE_VERSION } from './save-version';

/** M13.10 close-out: with every gate met, each Explore mode opens from the hub to its own working screen. */

const ROSTER = ['ninetales', 'charizard', 'starmie', 'blastoise', 'venusaur', 'raichu'];
const MODES = [
  ['hoopa-vault', "Hoopa's Vault"],
  ['rift-arena', 'Rift Arena'],
  ['sky-pillar', 'Sky Pillar'],
  ['faction-tower', 'Faction Tower'],
  ['misty-woods', 'Misty Woods'],
  ['pet-home', 'Pet Home'],
  ['berry-grove', 'Berry Grove'],
  ['dig-site', 'Dig Site'],
] as const;

test('every Explore mode opens to its own screen once its gates are met', async ({ page }) => {
  const roster = ROSTER.map((speciesId, index) => ({ id: `w${index + 1}`, speciesId, level: 80, stars: 5, locked: false, acquiredAt: 0 }));
  const save = JSON.stringify({
    version: E2E_SAVE_VERSION,
    state: {
      profile: { name: 'Explorer', level: 50, xp: 979_417 },
      roster,
      currencies: { gold: 100_000, gems: 500 },
      nextInstanceSeq: ROSTER.length + 1,
      campaign: { stars: { 'c1-10': 3, 'c3-10': 3, 'c7-1': 3, 'c10-10': 3, 'c28-10': 3 } },
      serverEpoch: 0,
      tutorial: { step: 0, done: true },
    },
  });
  await page.goto('/more');
  await page.locator('#import-save').fill(save);
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText(`Wilds: ${ROSTER.length}`)).toBeVisible();
  for (const [id, title] of MODES) {
    await page.goto(`/explore/${id}`);
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
    await expect(page.locator('[data-testid$="-locked"]')).toHaveCount(0);
  }
});
