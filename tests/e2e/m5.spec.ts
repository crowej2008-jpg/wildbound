import { expect, test, type Page } from '@playwright/test';

/**
 * M5 campaign, idle and daily loop (PROMPT §13). Each test runs in a fresh
 * browser context, so IndexedDB starts empty and the account is brand new.
 */

/** Clears campaign stage 1-1 (a guaranteed first battle) and returns to the map. */
async function clearFirstStage(page: Page): Promise<void> {
  await page.goto('/campaign');
  await page.locator('.stage-row').first().getByRole('button', { name: 'Challenge' }).click();
  await page.getByRole('button', { name: 'Skip to end' }).click();
  await expect(page.locator('.result-rewards .result-banner strong')).toHaveText('Victory');
  await page.getByRole('button', { name: 'Back to campaign' }).click();
}

/** Skips ahead using the debug clock on More (12h more than fills the 8h VIP 0 idle cap). */
async function advanceClock(page: Page, hours: '1' | '12' | '24'): Promise<void> {
  await page.goto('/more');
  await page.getByRole('button', { name: `+${hours}h` }).click();
  await expect(page.getByText(new RegExp(`Offset: ${Number(hours) * 60} min`))).toBeVisible();
}

test('first launch shows the tutorial and it can be skipped', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('.tutorial-card');
  await expect(card).toBeVisible();
  await expect(card.getByText('Getting started')).toBeVisible();
  await expect(card.getByText('Level up a Wild to make it stronger.')).toBeVisible();

  await card.getByRole('button', { name: 'Skip' }).click();
  await expect(card).toBeHidden();

  // The town hub still routes to every M5 screen.
  await expect(page.getByRole('link', { name: 'Campaign' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Idle' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Quests' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mail' })).toBeVisible();
});

test('clearing a stage awards stars and unlocks the next', async ({ page }) => {
  await page.goto('/campaign');
  await expect(page.getByRole('heading', { name: 'Campaign' })).toBeVisible();

  // Only the first stage is unlocked at the start.
  const rows = page.locator('.stage-row');
  await expect(rows.nth(0).getByRole('button', { name: 'Challenge' })).toBeEnabled();
  await expect(rows.nth(1).getByRole('button', { name: 'Challenge' })).toBeDisabled();

  await rows.first().getByRole('button', { name: 'Challenge' }).click();
  await expect(page.locator('.battle-unit').first()).toBeVisible();
  await page.getByRole('button', { name: 'Skip to end' }).click();

  const rewards = page.locator('.result-rewards');
  await expect(rewards.locator('.result-banner strong')).toHaveText('Victory');
  await expect(rewards.getByText('First-clear bonus!')).toBeVisible();
  await expect(rewards.locator('.reward-chip').first()).toBeVisible();

  await page.getByRole('button', { name: 'Back to campaign' }).click();
  await expect(rows.first().getByRole('button', { name: 'Replay' })).toBeVisible();
  await expect(rows.nth(1).getByRole('button', { name: 'Challenge' })).toBeEnabled();
});

test('idle income accrues over time and can be collected', async ({ page }) => {
  // Idle needs a cleared stage to earn from.
  await clearFirstStage(page);
  await advanceClock(page, '12');

  await page.goto('/idle');
  await expect(page.getByRole('heading', { name: 'Idle Income' })).toBeVisible();
  await expect(page.getByText('Hatchling Trail')).toBeVisible();

  const collect = page.getByRole('button', { name: 'Collect', exact: true });
  await expect(collect).toBeEnabled();
  await collect.click();
  await expect(page.locator('.reward-chip').first()).toBeVisible();
});

test('the welcome mail can be claimed', async ({ page }) => {
  await page.goto('/mail');
  await expect(page.getByRole('heading', { name: 'Mail' })).toBeVisible();

  const item = page.locator('.mail-item').first();
  await expect(item).toBeVisible();
  await expect(item.getByText('Welcome to Wildbound')).toBeVisible();

  const claimAll = page.getByRole('button', { name: 'Claim all' });
  await expect(claimAll).toBeEnabled();
  await claimAll.click();

  await expect(item.getByRole('button', { name: 'Claimed' })).toBeDisabled();
  await expect(claimAll).toBeDisabled();
});

test('collecting idle income completes a daily quest that can be claimed', async ({ page }) => {
  await clearFirstStage(page);
  await advanceClock(page, '12');

  await page.goto('/idle');
  await page.getByRole('button', { name: 'Collect', exact: true }).click();
  await expect(page.locator('.reward-chip').first()).toBeVisible();

  await page.goto('/quests');
  await expect(page.getByRole('heading', { name: 'Daily Quests' })).toBeVisible();
  const quest = page.locator('.quest-row').filter({ hasText: 'Claim AFK XP 1 time' });
  await expect(quest.getByText('1 / 1')).toBeVisible();

  const claim = quest.getByRole('button', { name: 'Claim' });
  await expect(claim).toBeEnabled();
  await claim.click();
  await expect(quest.getByRole('button', { name: 'Claimed' })).toBeDisabled();

  // R9: modes Wildbound has not built yet show where they arrive.
  await expect(
    page.locator('.quest-row').filter({ hasText: 'Challenge Adventure Quest once' }).getByText('Its mode arrives in M13.'),
  ).toBeVisible();
});
