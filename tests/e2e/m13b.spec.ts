import { expect, test } from '@playwright/test';

test('Explore shows eight honest mode shells and their gates', async ({ page }) => {
  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: 'Explore', exact: true })).toBeVisible();

  const cards = page.locator('.explore-card');
  await expect(cards).toHaveCount(8);
  await expect(cards.filter({ hasText: 'Pet Home' })).toContainText('Locked');
  await expect(cards.filter({ hasText: 'Pet Home' })).toContainText('Planned');
  await expect(cards.filter({ hasText: "Hoopa's Vault" })).toContainText('Server day 15');

  await cards.filter({ hasText: 'Pet Home' }).click();
  await expect(page.getByRole('heading', { name: 'Pet Home' })).toBeVisible();
  await expect(page.getByText('This mode is a shell in this milestone.', { exact: false })).toBeVisible();
  await expect(page.getByText('Clear campaign 1-10')).toBeVisible();
  await expect(page.getByText('Not met')).toBeVisible();
  await expect(page.getByRole('button', { name: /play/i })).toHaveCount(0);

  await page.getByRole('link', { name: 'Back to Explore' }).click();
  await expect(page).toHaveURL(/\/explore$/);
});
