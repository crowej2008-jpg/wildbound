import { expect, test, type Page } from '@playwright/test';
import { E2E_SAVE_VERSION } from './save-version';

/** M13.8: Berry Grove — locked before 3-10 + Lv10; plant a seed; fight a Guardian and the Grove Boss. */

const ROSTER = ['ninetales', 'charizard', 'starmie', 'blastoise', 'venusaur', 'raichu'];

function groveSave(cleared: boolean): string {
  const roster = ROSTER.map((speciesId, index) => ({ id: `w${index + 1}`, speciesId, level: 80, stars: 5, locked: false, acquiredAt: 0 }));
  return JSON.stringify({
    version: E2E_SAVE_VERSION,
    state: {
      profile: { name: 'Grove Tester', level: cleared ? 10 : 1, xp: cleared ? 13_372 : 0 },
      roster,
      currencies: { gold: 50_000, gems: 500, seedCommon: 2 },
      nextInstanceSeq: ROSTER.length + 1,
      campaign: { stars: cleared ? { 'c3-10': 3 } : {} },
      tutorial: { step: 0, done: true },
    },
  });
}

async function importSave(page: Page, cleared: boolean): Promise<void> {
  await page.goto('/more');
  await page.locator('#import-save').fill(groveSave(cleared));
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText(`Wilds: ${ROSTER.length}`)).toBeVisible();
}

test('Berry Grove stays locked before story 3-10 and level 10', async ({ page }) => {
  await importSave(page, false);
  await page.goto('/explore/berry-grove');
  await expect(page.getByTestId('grove-locked')).toBeVisible();
});

test('Berry Grove plants a seed and fights a Guardian and the boss', async ({ page }) => {
  await importSave(page, true);
  await page.goto('/explore/berry-grove');
  await expect(page.locator('.grove-plot')).toHaveCount(6);
  await page.locator('.grove-plot').first().getByRole('button', { name: 'Plant' }).click();
  await expect(page.getByTestId('grove-status')).toBeVisible();
  await expect(page.locator('.grove-plot').first()).toContainText('ripe in');

  await page.getByTestId('grove-guardian').click();
  await page.getByRole('button', { name: 'Skip to end' }).click();
  await expect(page.getByTestId('grove-outcome')).toBeVisible();
  await page.getByRole('button', { name: 'Back to the grove' }).click();

  await page.getByTestId('grove-boss').click();
  await page.getByRole('button', { name: 'Skip to end' }).click();
  await expect(page.getByTestId('grove-outcome')).toContainText('% of the boss');
  await page.getByRole('button', { name: 'Back to the grove' }).click();
  await expect(page.getByTestId('grove-stage')).toBeVisible();
});
