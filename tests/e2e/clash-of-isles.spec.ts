import { expect, test } from '@playwright/test';
import { E2E_SAVE_VERSION } from './save-version';

/** M14.5: Clash of Isles — opened after 3-10 on server day 2: 10 sea areas of islands. */
test('Clash of Isles shows the sea areas and attempts', async ({ page }) => {
  const roster = ['ninetales', 'charizard', 'starmie'].map((speciesId, index) => ({ id: `w${index + 1}`, speciesId, level: 40, stars: 5, locked: false, acquiredAt: 0 }));
  await page.goto('/more');
  await page.locator('#import-save').fill(
    JSON.stringify({
      version: E2E_SAVE_VERSION,
      state: { profile: { name: 'Isle Tester', level: 1, xp: 0 }, roster, currencies: { gold: 1000, gems: 0 }, nextInstanceSeq: 4, campaign: { stars: { 'c3-10': 3 } }, serverEpoch: 0, tutorial: { step: 0, done: true } },
    }),
  );
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText('Wilds: 3')).toBeVisible();
  await page.goto('/combat');
  await page.getByRole('link', { name: /Clash of Isles/ }).click();
  await expect(page.getByTestId('isles-summary')).toContainText('Attempts 6');
  await expect(page.locator('.isles-area')).toHaveCount(10);
});
