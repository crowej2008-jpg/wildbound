import { expect, test } from '@playwright/test';
import { E2E_SAVE_VERSION } from './save-version';

/** M14.3: Pokémon Paradise — opened from the Combat hub after 2-5; explore lands on a route. */

test('Pokémon Paradise explores a route and shows the Dex', async ({ page }) => {
  const roster = ['ninetales', 'charizard', 'starmie'].map((speciesId, index) => ({ id: `w${index + 1}`, speciesId, level: 20, stars: 5, locked: false, acquiredAt: 0 }));
  await page.goto('/more');
  await page.locator('#import-save').fill(
    JSON.stringify({
      version: E2E_SAVE_VERSION,
      state: { profile: { name: 'Park Tester', level: 1, xp: 0 }, roster, currencies: { gold: 1000, gems: 0 }, nextInstanceSeq: 4, campaign: { stars: { 'c2-5': 3 } }, tutorial: { step: 0, done: true } },
    }),
  );
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText('Wilds: 3')).toBeVisible();
  await page.goto('/combat');
  await page.getByRole('link', { name: /Pokémon Paradise/ }).click();
  await expect(page.getByTestId('paradise-summary')).toContainText('Stamina 10 / 10');
  await page.getByTestId('paradise-explore').click();
  await expect(page.getByTestId('paradise-encounter')).toBeVisible();
  await expect(page.getByTestId('paradise-summary')).toContainText(/Stamina (9|10) \/ 10/);
  await page.getByTestId('paradise-tab-dex').click();
  await expect(page.getByTestId('paradise-dex').locator('li')).toHaveCount(16);
});
