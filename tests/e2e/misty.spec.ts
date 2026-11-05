import { expect, test, type Page } from '@playwright/test';
import { E2E_SAVE_VERSION } from './save-version';

/** M13.6: Misty Woods — locked before 3-10; the map, a step onto the first floor, HP carried after a fight. */

const ROSTER = ['ninetales', 'charizard', 'starmie', 'blastoise', 'venusaur', 'raichu'];

function mistySave(cleared: boolean): string {
  const roster = ROSTER.map((speciesId, index) => ({ id: `w${index + 1}`, speciesId, level: 80, stars: 5, locked: false, acquiredAt: 0 }));
  return JSON.stringify({
    version: E2E_SAVE_VERSION,
    state: {
      profile: { name: 'Woods Tester', level: 1, xp: 0 },
      roster,
      currencies: { gold: 50_000, gems: 5_000 },
      nextInstanceSeq: ROSTER.length + 1,
      campaign: { stars: cleared ? { 'c3-10': 3 } : {} },
      tutorial: { step: 0, done: true },
    },
  });
}

async function importSave(page: Page, cleared: boolean): Promise<void> {
  await page.goto('/more');
  await page.locator('#import-save').fill(mistySave(cleared));
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText(`Wilds: ${ROSTER.length}`)).toBeVisible();
}

test('Misty Woods stays locked before story 3-10', async ({ page }) => {
  await importSave(page, false);
  await page.goto('/explore/misty-woods');
  await expect(page.getByTestId('misty-locked')).toBeVisible();
});

test('Misty Woods shows chapter 1 and steps onto the first floor', async ({ page }) => {
  await importSave(page, true);
  await page.goto('/explore/misty-woods');
  await expect(page.getByTestId('misty-chapter')).toContainText('Chapter 1 / 4');
  await expect(page.locator('.misty-floor')).toHaveCount(11);
  const next = page.locator('.misty-node:not([disabled])').first();
  await expect(next).toBeVisible();
  const tile = await next.getAttribute('data-tile');
  await next.click();
  if (tile === 'fight' || tile === 'boss') {
    await page.getByRole('button', { name: 'Skip to end' }).click();
    await expect(page.getByTestId('misty-outcome')).toBeVisible();
    await page.getByRole('button', { name: 'Back to the woods' }).click();
    await expect(page.getByTestId('misty-chapter')).toBeVisible();
  } else {
    await expect(page.getByTestId('misty-status')).toBeVisible();
  }
});
