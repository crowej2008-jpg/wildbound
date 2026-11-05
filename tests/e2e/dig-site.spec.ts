import { expect, test, type Page } from '@playwright/test';
import { E2E_SAVE_VERSION } from './save-version';

/** M13.9: Dig Site — locked before 10-10 + Lv50; a new wall, a few strikes, the lab and museum tabs. */

const ROSTER = ['ninetales', 'charizard', 'starmie', 'blastoise', 'venusaur', 'raichu'];

function digSave(cleared: boolean): string {
  const roster = ROSTER.map((speciesId, index) => ({ id: `w${index + 1}`, speciesId, level: 80, stars: 5, locked: false, acquiredAt: 0 }));
  return JSON.stringify({
    version: E2E_SAVE_VERSION,
    state: {
      profile: { name: 'Dig Tester', level: cleared ? 50 : 1, xp: cleared ? 979_417 : 0 },
      roster,
      currencies: { gold: 1_000_000, gems: 500 },
      nextInstanceSeq: ROSTER.length + 1,
      campaign: { stars: cleared ? { 'c10-10': 3 } : {} },
      tutorial: { step: 0, done: true },
    },
  });
}

async function importSave(page: Page, cleared: boolean): Promise<void> {
  await page.goto('/more');
  await page.locator('#import-save').fill(digSave(cleared));
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText(`Wilds: ${ROSTER.length}`)).toBeVisible();
}

test('Dig Site stays locked before story 10-10 and level 50', async ({ page }) => {
  await importSave(page, false);
  await page.goto('/explore/dig-site');
  await expect(page.getByTestId('dig-locked')).toBeVisible();
});

test('Dig Site digs a wall and shows the lab and museum', async ({ page }) => {
  await importSave(page, true);
  await page.goto('/explore/dig-site');
  await page.getByTestId('dig-new-wall').click();
  await expect(page.getByTestId('dig-grid').locator('.dig-cell')).toHaveCount(130);
  await expect(page.getByTestId('dig-stability')).toContainText('Wall shake 0 /');
  await page.getByTestId('dig-grid').locator('.dig-cell').nth(20).click();
  await expect(page.getByTestId('dig-stability')).toContainText('Wall shake 3 /');
  await page.getByTestId('dig-tool-hammer').click();
  await page.getByTestId('dig-grid').locator('.dig-cell').nth(60).click();
  await expect(page.getByTestId('dig-stability')).toContainText('Wall shake 9 /');
  await page.getByTestId('dig-tab-lab').click();
  await expect(page.getByText('Fossil lab')).toBeVisible();
  await page.getByTestId('dig-tab-museum').click();
  await expect(page.locator('.dig-group')).toHaveCount(8);
  await page.getByTestId('dig-hall-orbs').click();
  await expect(page.locator('.dig-group')).toHaveCount(5);
  await page.getByTestId('dig-hall-soulHearts').click();
  await expect(page.locator('.dig-group')).toHaveCount(9);
});
