import { expect, test } from '@playwright/test';
import { E2E_SAVE_VERSION } from './save-version';

/** M17: Guild War and Relic Battlefield open from the Guild page once you have joined. */
test('Guild War shows five bosses; the Relic Battlefield shows the map and standings', async ({ page }) => {
  const roster = ['ninetales', 'charizard', 'starmie'].map((speciesId, index) => ({ id: `w${index + 1}`, speciesId, level: 40, stars: 5, locked: false, acquiredAt: 0 }));
  await page.goto('/more');
  await page.locator('#import-save').fill(
    JSON.stringify({
      version: E2E_SAVE_VERSION,
      state: { profile: { name: 'War Tester', level: 1, xp: 0 }, roster, currencies: { gold: 1_000_000, gems: 1000 }, nextInstanceSeq: 4, serverEpoch: 0, tutorial: { step: 0, done: true } },
    }),
  );
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText('Wilds: 3')).toBeVisible();
  await page.goto('/guild-war');
  await expect(page.getByTestId('gw-locked')).toBeVisible();
  await page.goto('/guild');
  await page.getByRole('button', { name: 'Join the guild' }).click();
  await page.getByRole('link', { name: 'Guild War' }).click();
  await expect(page.locator('[data-testid="gw-bosses"] li')).toHaveCount(5);
  await expect(page.getByTestId('gw-summary')).toContainText('Attempts left 0');
  await page.goto('/relic-battlefield');
  await expect(page.locator('.relic-grid')).toHaveCount(91);
  await expect(page.locator('[data-testid="relic-standings"] li')).toHaveCount(4);
});
