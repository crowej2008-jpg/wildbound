import { expect, test, type Page } from '@playwright/test';
import { E2E_SAVE_VERSION } from './save-version';

/** M13.7: Faction Tower — locked before 28-10; three towers, today's open one climbs floor 1. */

const ROSTER = [
  'starmie', 'garchomp', 'gyarados', 'blastoise',
  'ninetales', 'hydreigon', 'gengar', 'charizard',
  'metagross', 'gardevoir', 'raichu', 'venusaur',
  'mew', 'mewtwo',
];

function towerSave(cleared: boolean): string {
  const roster = ROSTER.map((speciesId, index) => ({ id: `w${index + 1}`, speciesId, level: 80, stars: 5, locked: false, acquiredAt: 0 }));
  return JSON.stringify({
    version: E2E_SAVE_VERSION,
    state: {
      profile: { name: 'Tower Tester', level: 1, xp: 0 },
      roster,
      currencies: { gold: 50_000, gems: 5_000 },
      nextInstanceSeq: ROSTER.length + 1,
      campaign: { stars: cleared ? { 'c28-10': 3 } : {} },
      tutorial: { step: 0, done: true },
    },
  });
}

async function importSave(page: Page, cleared: boolean): Promise<void> {
  await page.goto('/more');
  await page.locator('#import-save').fill(towerSave(cleared));
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText(`Wilds: ${ROSTER.length}`)).toBeVisible();
}

test('Faction Tower stays locked before story 28-10', async ({ page }) => {
  await importSave(page, false);
  await page.goto('/explore/faction-tower');
  await expect(page.getByTestId('faction-locked')).toBeVisible();
});

test('Faction Tower shows three towers and climbs an open one', async ({ page }) => {
  await importSave(page, true);
  await page.goto('/explore/faction-tower');
  await expect(page.getByTestId('faction-summary')).toBeVisible();
  await expect(page.locator('.faction-tower-card')).toHaveCount(3);
  const climb = page.locator('[data-testid^="faction-climb-"]:not([disabled])').first();
  await expect(climb).toBeVisible();
  await climb.click();
  await page.getByRole('button', { name: 'Skip to end' }).click();
  await expect(page.getByTestId('faction-outcome')).toBeVisible();
  await page.getByRole('button', { name: 'Back to the towers' }).click();
  await expect(page.getByTestId('faction-summary')).toBeVisible();
});
