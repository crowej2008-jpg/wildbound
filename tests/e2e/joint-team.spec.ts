import { expect, test } from '@playwright/test';
import { E2E_SAVE_VERSION } from './save-version';

/** M14.4: Joint Team — locked before server day 15 / Lv45; open: rival squads and the Wild Area tab. */

const roster = ['ninetales', 'charizard', 'starmie'].map((speciesId, index) => ({ id: `w${index + 1}`, speciesId, level: 80, stars: 5, locked: false, acquiredAt: 0 }));

async function load(page: import('@playwright/test').Page, open: boolean) {
  await page.goto('/more');
  await page.locator('#import-save').fill(
    JSON.stringify({
      version: E2E_SAVE_VERSION,
      state: {
        profile: { name: 'Squad Tester', level: open ? 45 : 1, xp: open ? 742_545 : 0 },
        roster,
        currencies: { gold: 1000, gems: 0 },
        nextInstanceSeq: 4,
        campaign: { stars: {} },
        serverEpoch: open ? 0 : Date.now(),
        tutorial: { step: 0, done: true },
      },
    }),
  );
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText('Wilds: 3')).toBeVisible();
}

test('Joint Team stays locked for a new account', async ({ page }) => {
  await load(page, false);
  await page.goto('/joint-team');
  await expect(page.getByTestId('joint-locked')).toBeVisible();
});

test('Joint Team shows rival squads and the Wild Area', async ({ page }) => {
  await load(page, true);
  await page.goto('/joint-team');
  await expect(page.getByTestId('joint-summary')).toBeVisible();
  await page.getByTestId('joint-tab-wild').click();
  await expect(page.getByTestId('wild-summary')).toContainText('Energy');
  await page.getByTestId('joint-tab-skills').click();
  await page.getByTestId('joint-tab-shop').click();
});
