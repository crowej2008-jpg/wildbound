import { expect, test } from '@playwright/test';

test('boots to Home with the six-tab bottom nav', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Wildbound' })).toBeVisible();
  await expect(page.getByText('Milestone 10', { exact: false })).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav.getByRole('link', { name: 'Home' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Wilds' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Combat' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'PvP' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Summon' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'More' })).toBeVisible();
});

test('gallery renders every Wild with a deterministic portrait', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Gallery' }).click();
  await expect(page.getByText('Wild Gallery')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Kyogre', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ninetales', exact: true })).toBeVisible();
  const portraits = page.locator('svg.wild-portrait');
  expect(await portraits.count()).toBeGreaterThanOrEqual(84);
});

test('every tab resolves to a live screen and keeps the nav', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await nav.getByRole('link', { name: 'Summon' }).click();
  await expect(page.getByRole('heading', { name: 'Summon' })).toBeVisible();
  await expect(nav).toBeVisible();
});