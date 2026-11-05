import { expect, test } from '@playwright/test';
import { E2E_SAVE_VERSION } from './save-version';

/** M14.1: Victory Road — reached from the campaign; the first gym's 30% chest pays. */

test('Victory Road shows the gyms and pays a progress chest', async ({ page }) => {
  const roster = ['ninetales', 'charizard', 'starmie'].map((speciesId, index) => ({ id: `w${index + 1}`, speciesId, level: 20, stars: 5, locked: false, acquiredAt: 0 }));
  const stars: Record<string, number> = {};
  for (let c = 1; c <= 2; c += 1) for (let i = 1; i <= 10; i += 1) stars[`c${c}-${i}`] = 3;
  await page.goto('/more');
  await page.locator('#import-save').fill(
    JSON.stringify({
      version: E2E_SAVE_VERSION,
      state: { profile: { name: 'Road Tester', level: 1, xp: 0 }, roster, currencies: { gold: 1000, gems: 0 }, nextInstanceSeq: 4, campaign: { stars }, tutorial: { step: 0, done: true } },
    }),
  );
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText('Wilds: 3')).toBeVisible();
  await page.goto('/campaign');
  await page.getByTestId('open-victory-road').click();
  await expect(page.getByTestId('victory-summary')).toContainText('Badges 0 / 60');
  await expect(page.locator('.victory-gym')).toHaveCount(10);
  await page.locator('[data-chest="1-30"]').click();
  await expect(page.getByTestId('victory-status')).toBeVisible();
  await expect(page.locator('[data-chest="1-30"]')).toBeDisabled();
});
