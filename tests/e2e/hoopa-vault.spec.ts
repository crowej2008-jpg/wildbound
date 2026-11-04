import { expect, test, type Page } from '@playwright/test';
import { E2E_SAVE_VERSION } from './save-version';

/** M13.3: Hoopa's Vault — locked before server day 15; keys, a run, a route battle and the key refund. */

const ROSTER = ['ninetales', 'charizard', 'starmie', 'blastoise', 'venusaur', 'raichu'];
const DAY = 86_400_000;

function vaultSave(daysOld: number): string {
  const roster = ROSTER.map((speciesId, index) => ({
    id: `w${index + 1}`,
    speciesId,
    level: 100,
    stars: 6,
    locked: false,
    acquiredAt: 0,
  }));
  return JSON.stringify({
    version: E2E_SAVE_VERSION,
    state: {
      profile: { name: 'Vault Tester', level: 50, xp: 0 },
      serverEpoch: Date.now() - daysOld * DAY,
      roster,
      currencies: { gold: 50_000, gems: 5_000, vaultKey: 0 },
      nextInstanceSeq: ROSTER.length + 1,
      campaign: { stars: { 'c1-10': 3 } },
      tutorial: { step: 0, done: true },
    },
  });
}

async function importSave(page: Page, daysOld: number): Promise<void> {
  await page.goto('/more');
  await page.locator('#import-save').fill(vaultSave(daysOld));
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText(`Wilds: ${ROSTER.length}`)).toBeVisible();
}

test("Hoopa's Vault stays locked before server day 15", async ({ page }) => {
  await importSave(page, 5);
  await page.goto('/explore/hoopa-vault');
  await expect(page.getByRole('heading', { name: "Hoopa's Vault", exact: true })).toBeVisible();
  await expect(page.getByTestId('hoopa-locked')).toContainText('server day 15');
});

test("claims keys, enters the Vault, fights a route and gets the key back on leaving or losing", async ({ page }) => {
  await importSave(page, 20);
  await page.goto('/explore/hoopa-vault');
  await expect(page.getByTestId('hoopa-keys')).toHaveText('0');

  await page.getByRole('button', { name: 'Claim 5 free keys' }).click();
  await expect(page.getByTestId('hoopa-keys')).toHaveText('5');
  await expect(page.getByRole('button', { name: "Today's keys claimed" })).toBeDisabled();

  await page.getByRole('button', { name: 'Enter (keys: 1)' }).click();
  await expect(page.getByTestId('hoopa-run')).toBeVisible();
  await expect(page.getByTestId('hoopa-keys')).toHaveText('4');
  await expect(page.getByTestId('hoopa-escape')).toHaveText('10');
  await expect(page.locator('.hoopa-cards li')).toHaveCount(2);

  await page.locator('.hoopa-cards li').first().getByRole('button', { name: 'Take this route' }).click();
  await page.getByRole('button', { name: 'Skip to end' }).click();
  await expect(page.getByTestId('hoopa-outcome')).toBeVisible();
  await page.getByRole('button', { name: 'Back to the Vault' }).click();

  // A won route keeps the run going: leave it. A lost route already ended it. Either way the key comes back.
  const leave = page.getByRole('button', { name: 'Leave (lose the bag, keep the keys)' });
  if (await leave.isVisible()) await leave.click();
  await expect(page.getByTestId('hoopa-run')).toHaveCount(0);
  await expect(page.getByTestId('hoopa-keys')).toHaveText('5');
});
