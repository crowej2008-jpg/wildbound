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
  await expect(page.getByRole('heading', { name: 'Tower', exact: true })).toBeVisible();
  // R9: the Hard Tower shows its stage rule; floor 10 is the first Normal achievement.
  await expect(page.locator('[data-tower="hard"]').getByText('This stage: No Pokémon in position 5')).toBeVisible();
  await expect(page.getByText('Climbs left today').first()).toBeVisible();
  await page.getByRole('button', { name: 'Climb', exact: true }).click();
  await expect(page.locator('.battle-unit')).toHaveCount(12);
  await page.getByRole('button', { name: 'Skip to end' }).click();
  await expect(page.locator('.result-panel')).toBeVisible();
  const banner = await page.locator('.result-rewards .result-banner strong').textContent();
  expect(['Floor cleared!', 'Your squad fell on this floor.']).toContain(banner);
  await page.getByRole('button', { name: 'Back to tower' }).click();
  await expect(page.getByRole('heading', { name: 'Tower', exact: true })).toBeVisible();
});

test('lists the five trials', async ({ page }) => {
  await page.goto('/trials');
  await expect(page.getByRole('heading', { name: 'Trials' })).toBeVisible();
  await expect(page.locator('main .card')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Fight' }).first()).toBeVisible();
});

test('shows the world boss and its damage milestones', async ({ page }) => {
  await page.goto('/boss');
  await expect(page.getByRole('heading', { name: 'World Boss', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Damage milestones' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fight' })).toBeVisible();
});

test('lists the four source daily dungeons, gated by trainer level', async ({ page }) => {
  await page.goto('/dungeons');
  await expect(page.getByRole('heading', { name: 'Dungeons' })).toBeVisible();
  await expect(page.locator('main .card')).toHaveCount(4);
  const gold = page.locator('[data-dungeon="gold"]');
  await expect(gold.getByRole('heading', { name: 'Gold' })).toBeVisible();
  await expect(gold.getByText('2/2 runs today')).toBeVisible();
  await expect(gold.getByText('C · Defeat 3', { exact: true })).toBeVisible();
  // A fresh trainer is below Gold Entry's level 10.
  await expect(gold.getByRole('button', { name: 'Challenge' })).toBeDisabled();
});

test('the World Boss lists its two daily windows and the rank rewards', async ({ page }) => {
  await page.goto('/boss');
  await expect(page.getByText(/Windows: 12:00–13:00, 18:00–19:00 UTC/)).toBeVisible();
  await expect(page.getByText(/#1 · #2 · #3 · #4–10 · #11–20/)).toBeVisible();
});
