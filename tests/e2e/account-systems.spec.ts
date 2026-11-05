import { expect, test } from '@playwright/test';
import { E2E_SAVE_VERSION } from './save-version';

/** M15: Treasures, Z Ring, fusion skins, Golden Egg and Awakening from the Trainer screen. */
test('Account systems page opens from the Trainer and smashes a free egg', async ({ page }) => {
  const roster = ['ninetales', 'charizard', 'starmie'].map((speciesId, index) => ({ id: `w${index + 1}`, speciesId, level: 40, stars: 5, locked: false, acquiredAt: 0 }));
  await page.goto('/more');
  await page.locator('#import-save').fill(
    JSON.stringify({
      version: E2E_SAVE_VERSION,
      state: { profile: { name: 'Egg Tester', level: 1, xp: 0 }, roster, currencies: { gold: 1000, gems: 0 }, nextInstanceSeq: 4, serverEpoch: 0, tutorial: { step: 0, done: true } },
    }),
  );
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText('Wilds: 3')).toBeVisible();
  await page.goto('/trainer');
  await page.getByRole('link', { name: /Golden Egg/ }).click();
  await expect(page.getByTestId('a3-treasures')).toBeVisible();
  await page.getByTestId('a3-tab-egg').click();
  await expect(page.getByTestId('a3-egg')).toContainText('Free smashes today 1');
  await page.getByRole('button', { name: 'Smash ×1', exact: true }).click();
  await expect(page.getByTestId('a3-egg')).toContainText('Free smashes today 0');
  await page.getByTestId('a3-tab-awaken').click();
  await expect(page.getByTestId('a3-awaken-locked')).toBeVisible();
});
