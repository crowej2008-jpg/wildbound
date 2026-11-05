import { expect, test } from '@playwright/test';
import { E2E_SAVE_VERSION } from './save-version';

/** M14.2: King's Trial — opened from Victory Road; Champion Points, trainer list, point and weekly tabs. */

test("King's Trial opens from Victory Road and shows its tabs", async ({ page }) => {
  const roster = ['ninetales', 'charizard', 'starmie'].map((speciesId, index) => ({ id: `w${index + 1}`, speciesId, level: 20, stars: 5, locked: false, acquiredAt: 0 }));
  await page.goto('/more');
  await page.locator('#import-save').fill(
    JSON.stringify({
      version: E2E_SAVE_VERSION,
      state: { profile: { name: 'Trial Tester', level: 1, xp: 0 }, roster, currencies: { gold: 1000, gems: 0 }, nextInstanceSeq: 4, campaign: { stars: {} }, tutorial: { step: 0, done: true } },
    }),
  );
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText('Wilds: 3')).toBeVisible();
  await page.goto('/victory-road');
  await page.getByTestId('open-kings-trial').click();
  await expect(page.getByTestId('kings-points')).toBeVisible();
  await page.getByTestId('kings-tab-points').click();
  await page.getByTestId('kings-tab-weekly').click();
  await page.getByTestId('kings-tab-trainers').click();
  await expect(page.getByTestId('kings-points')).toBeVisible();
});
