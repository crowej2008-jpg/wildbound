import { expect, test } from '@playwright/test';

test('boots to Home with the five-tab bottom nav', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Wildbound' })).toBeVisible();
  await expect(page.getByText('Milestone 0', { exact: false })).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav.getByRole('link', { name: 'Home' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Wilds' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Combat' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Summon' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'More' })).toBeVisible();
});

test('out-of-scope tabs show an honest coming-later state and keep the nav', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Summon' }).click();
  await expect(page.getByText(/built in M6/)).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();

  await page.getByRole('link', { name: 'Wilds' }).click();
  await expect(page.getByText(/built in M3/)).toBeVisible();
});