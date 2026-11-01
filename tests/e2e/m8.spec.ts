import { expect, test } from '@playwright/test';

/**
 * M8 PvE modes (PROMPT §13). Fresh contexts start with a brand-new account. (R7: the Link Crystal became
 * Resonance on the Trainer screen.)
 */

test('the combat hub links every PvE mode', async ({ page }) => {
  await page.goto('/combat');
  await expect(page.getByRole('heading', { name: 'Challenges' })).toBeVisible();
  for (const name of ['Tower', 'Trials', 'World Boss', 'Dungeons']) {
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
  }
});

test('climbs the tower and shows a replayable result', async ({ page }) => {
  await page.goto('/tower');
  await expect(page.getByRole('heading', { name: 'Tower' })).toBeVisible();
  await page.getByRole('button', { name: 'Climb' }).click();
  await expect(page.locator('.battle-unit')).toHaveCount(12);
  await page.getByRole('button', { name: 'Skip to end' }).click();
  await expect(page.locator('.result-panel')).toBeVisible();
  const banner = await page.locator('.result-rewards .result-banner strong').textContent();
  expect(['Floor cleared!', 'Your squad fell on this floor.']).toContain(banner);
  await page.getByRole('button', { name: 'Back to tower' }).click();
  await expect(page.getByRole('heading', { name: 'Tower' })).toBeVisible();
});

test('lists the five trials', async ({ page }) => {
  await page.goto('/trials');
  await expect(page.getByRole('heading', { name: 'Trials' })).toBeVisible();
  await expect(page.locator('main .card')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Fight' }).first()).toBeVisible();
});

test('shows the world boss and its damage milestones', async ({ page }) => {
  await page.goto('/boss');
  await expect(page.getByRole('heading', { name: 'World Boss' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Damage milestones' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fight' })).toBeVisible();
});

test('lists seven daily dungeons', async ({ page }) => {
  await page.goto('/dungeons');
  await expect(page.getByRole('heading', { name: 'Dungeons' })).toBeVisible();
  await expect(page.locator('main .card')).toHaveCount(7);
});
