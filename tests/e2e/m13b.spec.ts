import { expect, test } from '@playwright/test';

test('Explore shows eight modes and keeps Pet Home honest until its gate clears', async ({ page }) => {
  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: 'Explore', exact: true })).toBeVisible();

  const cards = page.locator('.explore-card');
  await expect(cards).toHaveCount(8);
  await expect(cards.filter({ hasText: 'Pet Home' })).toContainText('Locked');
  await expect(cards.filter({ hasText: 'Pet Home' })).toContainText('Live');
  await expect(cards.filter({ hasText: "Hoopa's Vault" })).toContainText('Server day 15');

  await cards.filter({ hasText: 'Pet Home' }).click();
  await expect(page.getByRole('heading', { name: 'Pet Home', exact: true })).toBeVisible();
  await expect(page.getByText('Pet Home is locked')).toBeVisible();
  await expect(page.getByText('Clear campaign 1-10', { exact: true })).toBeVisible();
  await expect(page.getByText('Not met')).toBeVisible();
  await expect(page.getByRole('button', { name: /summon ball/i })).toHaveCount(0);

  await page.getByRole('link', { name: 'Go to Campaign' }).click();
  await expect(page).toHaveURL(/\/campaign$/);
});
