import { expect, test } from '@playwright/test';

/**
 * M3 account/roster/growth/squad flows (PROMPT §13). Each test gets a fresh
 * browser context, so IndexedDB starts empty and seeds the starting roster.
 */
test('seeds six Wilds, opens the detail screen, and auto-fills a squad', async ({ page }) => {
  await page.goto('/wilds');
  await expect(page.getByRole('heading', { name: 'Wilds' })).toBeVisible();
  await expect(page.locator('.roster-item')).toHaveCount(6);

  await page.locator('.roster-item').first().click();
  await expect(page.getByRole('button', { name: 'Upgrade', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Evolve', exact: true })).toBeVisible();

  await page.goto('/squad');
  await expect(page.getByRole('heading', { name: 'Squads' })).toBeVisible();
  await page.getByRole('button', { name: 'Auto Formation' }).click();
  await expect(page.locator('.slot-filled')).toHaveCount(6);
});

test('debug grant a Wild and persists it across a reload', async ({ page }) => {
  await page.goto('/more');
  await expect(page.getByRole('heading', { name: 'More' })).toBeVisible();
  await expect(page.getByText('Wilds: 6')).toBeVisible();
  await page.getByRole('button', { name: 'Grant random Wild' }).click();
  await expect(page.getByText('Wilds: 7')).toBeVisible();

  await page.goto('/wilds');
  await expect(page.locator('.roster-item')).toHaveCount(7);

  await page.reload();
  await expect(page.locator('.roster-item')).toHaveCount(7);
});

test('levels up a Wild and the growth persists across a reload', async ({ page }) => {
  await page.goto('/wilds');
  await expect(page.locator('.roster-item')).toHaveCount(6);
  await page.locator('.roster-item').first().click();
  const level = page.locator('.wild-detail-hero .muted');
  await expect(level).toContainText('Lv1');
  await page.getByRole('button', { name: '+1', exact: true }).click();
  await expect(level).toContainText('Lv2');

  await page.reload();
  await expect(page.locator('.wild-detail-hero .muted')).toContainText('Lv2');
});
