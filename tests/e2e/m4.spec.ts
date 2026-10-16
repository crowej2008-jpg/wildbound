import { expect, test } from '@playwright/test';

/**
 * M4 battle replay (PROMPT §13). Each test gets a fresh context, so the
 * starting roster seeds a campaign squad and the battle is built server-side.
 */
test('replays a recorded battle to a result and restarts identically', async ({ page }) => {
  await page.goto('/combat/training');
  await expect(page.getByRole('heading', { name: 'Battle' })).toBeVisible();
  await expect(page.locator('.battle-unit')).toHaveCount(12);

  await page.getByRole('button', { name: 'Skip to end' }).click();
  const panel = page.locator('.result-panel');
  await expect(panel).toBeVisible();
  const banner = panel.locator('.result-banner strong');
  const first = await banner.textContent();
  expect(['Victory', 'Defeat']).toContain(first);

  await page.getByRole('button', { name: 'Restart' }).click();
  await expect(panel).toBeHidden();
  await page.getByRole('button', { name: 'Skip to end' }).click();
  await expect(banner).toHaveText(first ?? '');
});

test('steps through the log and cycles speed', async ({ page }) => {
  await page.goto('/combat/training');
  await expect(page.locator('.battle-unit')).toHaveCount(12);

  const speed = page.getByRole('button', { name: /Speed/ });
  await expect(speed).toContainText('1×');
  await speed.click();
  await expect(speed).toContainText('2×');

  await page.getByRole('button', { name: 'Step forward' }).click();
  await expect(page.locator('.battle-log li.log-current')).toHaveCount(1);
  await page.getByRole('button', { name: 'Step back' }).click();
  await expect(page.locator('.battle-log li.log-current')).toHaveCount(0);
});

test('the log is available for the whole fight', async ({ page }) => {
  await page.goto('/combat/training');
  await expect(page.locator('.battle-unit')).toHaveCount(12);
  await page.locator('.battle-log summary').click();
  await expect(page.locator('.battle-log li')).not.toHaveCount(0);
  await expect(page.locator('.battle-log li').first()).toContainText('Round');
});
