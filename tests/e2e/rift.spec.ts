import { expect, test, type Page } from '@playwright/test';
import { E2E_SAVE_VERSION } from './save-version';

/** M13.4: Rift Barriers — locked before 10-10; the season card, lives, a challenge when the season is open. */

const ROSTER = ['ninetales', 'charizard', 'starmie', 'blastoise', 'venusaur', 'raichu'];

function riftSave(cleared: boolean): string {
  const roster = ROSTER.map((speciesId, index) => ({
    id: `w${index + 1}`,
    speciesId,
    level: 120,
    stars: 6,
    locked: false,
    acquiredAt: 0,
  }));
  return JSON.stringify({
    version: E2E_SAVE_VERSION,
    state: {
      profile: { name: 'Rift Tester', level: 20, xp: 0 },
      roster,
      currencies: { gold: 50_000, gems: 5_000 },
      nextInstanceSeq: ROSTER.length + 1,
      campaign: { stars: cleared ? { 'c10-10': 3 } : {} },
      tutorial: { step: 0, done: true },
    },
  });
}

async function importSave(page: Page, cleared: boolean): Promise<void> {
  await page.goto('/more');
  await page.locator('#import-save').fill(riftSave(cleared));
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText(`Wilds: ${ROSTER.length}`)).toBeVisible();
}

test('Rift Arena stays locked before story 10-10', async ({ page }) => {
  await importSave(page, false);
  await page.goto('/explore/rift-arena');
  await expect(page.getByRole('heading', { name: 'Rift Arena', exact: true })).toBeVisible();
  await expect(page.getByTestId('rift-locked')).toBeVisible();
});

test('Rift Barriers shows the season, five lives and challenges a floor while the season is open', async ({ page }) => {
  await importSave(page, true);
  await page.goto('/explore/rift-arena');
  await expect(page.getByRole('heading', { name: 'Rift Barriers', exact: true })).toBeVisible();
  await expect(page.getByTestId('rift-lives')).toHaveText('5');
  await expect(page.getByTestId('rift-highest')).toHaveText('0');
  const season = await page.getByTestId('rift-season').innerText();
  if (season.startsWith('Season closed')) {
    await expect(page.getByRole('button', { name: 'Challenge', exact: true })).toBeDisabled();
    return;
  }
  await page.getByRole('button', { name: 'Challenge', exact: true }).click();
  await page.getByRole('button', { name: 'Skip to end' }).click();
  const outcome = await page.getByTestId('rift-outcome').innerText();
  await page.getByRole('button', { name: 'Back to the Rift' }).click();
  if (outcome === 'Floor cleared!') await expect(page.getByTestId('rift-highest')).toHaveText('1');
  else await expect(page.getByTestId('rift-lives')).toHaveText('4');
});
