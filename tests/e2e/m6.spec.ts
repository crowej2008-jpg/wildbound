import { expect, test } from '@playwright/test';

/**
 * M6 summoning and shops (PROMPT §13). Each test runs in a fresh browser context,
 * so IndexedDB starts empty and the account is brand new (10 common tickets,
 * 2 premium tickets, 500 gems).
 */

test('draws a free single summon with the starting account', async ({ page }) => {
  await page.goto('/summon');
  await expect(page.getByRole('heading', { name: 'Summon' })).toBeVisible();

  const common = page.locator('[data-machine="common"]');
  await expect(common.getByText('Free draws')).toContainText('5 / 5');
  await expect(common.getByRole('button', { name: 'Claim box' })).toBeDisabled();

  await common.getByRole('button', { name: 'Summon ×1', exact: true }).click();
  await expect(page.locator('.summon-results .draw-card')).toHaveCount(1);
  await expect(page.locator('.summon-history .history-row')).toHaveCount(1);
});

test('a ten-draw spends the starting common tickets and fills one box', async ({ page }) => {
  await page.goto('/summon');
  const common = page.locator('[data-machine="common"]');

  await common.getByRole('button', { name: 'Summon ×10', exact: true }).click();
  await expect(page.locator('.summon-results .draw-card')).toHaveCount(10);

  // Re-read the machine view after the draw: 10 credits toward the 100-credit box.
  await expect(common.getByText('10 / 100')).toBeVisible();
});

test('shows the exact premium rates, pity and featured-Wild selector', async ({ page }) => {
  await page.goto('/summon');
  const premium = page.locator('[data-machine="premium"]');
  await expect(premium.getByText('Pity')).toBeVisible();

  const rates = premium.locator('details.summon-rates');
  await rates.locator('summary').click();
  await expect(rates.locator('.rate-list li')).toHaveCount(6);

  await expect(page.getByRole('combobox', { name: 'Featured Wild' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set featured' })).toBeVisible();
});

test('buys from the Daily shop and decrements the window limit', async ({ page }) => {
  await page.goto('/shop');
  await expect(page.getByRole('heading', { name: 'Shops' })).toBeVisible();
  await expect(page.locator('.shop-card')).toHaveCount(7);

  const shard = page.locator('[data-shop="daily"] .shop-item').filter({ hasText: 'Shards' });
  await expect(shard).toContainText('Left: 3');
  await shard.getByRole('button', { name: 'Buy' }).click();
  await expect(shard).toContainText('Left: 2');
});

test('marks the Wilds shop as manual and the schedule as automatic', async ({ page }) => {
  await page.goto('/shop');
  await expect(page.getByRole('heading', { name: 'Shops' })).toBeVisible();

  const wilds = page.locator('[data-shop="wilds"]');
  await expect(wilds.getByText('Manual refresh')).toBeVisible();
  await expect(wilds.getByRole('button', { name: 'Refresh' })).toBeVisible();

  // A scheduled shop shows a countdown instead of a refresh button.
  const daily = page.locator('[data-shop="daily"]');
  await expect(daily.getByRole('button', { name: 'Refresh' })).toHaveCount(0);
});
