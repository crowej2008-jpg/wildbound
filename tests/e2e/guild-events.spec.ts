import { expect, test } from '@playwright/test';
import { E2E_SAVE_VERSION } from './save-version';

const roster = ['ninetales', 'charizard', 'starmie'].map((speciesId, index) => ({ id: `w${index + 1}`, speciesId, level: 40, stars: 5, locked: false, acquiredAt: 0 }));

async function load(page: import('@playwright/test').Page, serverEpoch: number) {
  await page.goto('/more');
  await page.locator('#import-save').fill(
    JSON.stringify({
      version: E2E_SAVE_VERSION,
      state: { profile: { name: 'Guild Tester', level: 1, xp: 0 }, roster, currencies: { gold: 1_000_000, gems: 1000, treasureShovel: 20 }, nextInstanceSeq: 4, serverEpoch, tutorial: { step: 0, done: true } },
    }),
  );
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText('Wilds: 3')).toBeVisible();
}

/** M16: join the CPU guild from Home and donate. */
test('Guild: join and donate Gold', async ({ page }) => {
  await load(page, Date.now());
  await page.goto('/');
  await page.getByRole('link', { name: /Guild/ }).first().click();
  await page.getByRole('button', { name: 'Join the guild' }).click();
  await expect(page.getByTestId('guild-donations')).toContainText('Donations left today 5');
  await page.getByRole('button', { name: /Donate Gold/ }).click();
  await expect(page.getByTestId('guild-donations')).toContainText('Donations left today 4');
});

/** M16: the Shovel Carnival runs on server day 8 — spin once. */
test('Events: Shovel Carnival digs on server day 8', async ({ page }) => {
  await load(page, Date.now() - 7 * 86_400_000 - 3_600_000);
  await page.goto('/events');
  await expect(page.getByTestId('shovel-state')).toContainText('Running');
  await page.getByRole('button', { name: 'Dig ×1', exact: true }).click();
  await expect(page.getByTestId('shovel')).toContainText('Credits 10');
  await expect(page.getByTestId('merge-state')).toContainText('Starts in');
  await expect(page.getByTestId('elven')).toBeVisible();
  await expect(page.locator('[data-testid^="bingo-"]')).toHaveCount(17); // 16 numbers + the state line
  await expect(page.getByTestId('flower-state')).toContainText('Flowers this week');
});
