import { expect, test, type Page } from '@playwright/test';
import { E2E_SAVE_VERSION } from './save-version';

/** M13.2: a 7-1 save opens Sky Pillar, sweeps, claims and challenges. */

const ROSTER = ['ninetales', 'charizard', 'starmie', 'blastoise', 'venusaur', 'raichu'];

function skySave(): string {
  const roster = ROSTER.map((speciesId, index) => ({
    id: `w${index + 1}`,
    speciesId,
    level: 100,
    stars: 6,
    evolutionStage: 2,
    locked: false,
    acquiredAt: 0,
  }));
  const stars: Record<string, number> = {};
  for (let stage = 1; stage <= 10; stage += 1) stars[`1:${stage}`] = 3;
  return JSON.stringify({
    version: E2E_SAVE_VERSION,
    state: {
      profile: { name: 'Sky Tester', level: 50, xp: 0 },
      roster,
      squads: { campaign: [], arenaAttack: [], arenaDefence: [], tower: [], worldBoss: [] },
      strategies: {
        campaign: 'balanced',
        arenaAttack: 'aggressive',
        arenaDefence: 'defensive',
        tower: 'balanced',
        worldBoss: 'aggressive',
      },
      currencies: { gold: 50_000, gems: 5_000 },
      nextInstanceSeq: ROSTER.length + 1,
      campaign: { stars: { 'c7-1': 3 } },
      tutorial: { step: 0, done: true },
      skyPillar: { proofs: 6, lastProofAt: Date.now(), stars, claimedChests: [] },
    },
  });
}

async function importSave(page: Page): Promise<void> {
  await page.goto('/more');
  await page.locator('#import-save').fill(skySave());
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText(`Wilds: ${ROSTER.length}`)).toBeVisible();
}

test('sweeps, claims a floor chest and re-challenges a stage', async ({ page }) => {
  await importSave(page);
  await page.goto('/explore/sky-pillar');
  await expect(page.getByRole('heading', { name: 'Sky Pillar', exact: true })).toBeVisible();
  await expect(page.getByText('Proofs of Sky 6/6')).toBeVisible();
  await expect(page.locator('.sky-floor')).toHaveCount(180);
  await expect(page.getByText('Floor 2 · Stage 1')).toBeVisible();
  await page.locator('.sky-floor').first().click();
  await expect(page.getByText('Floor stars: 30/30')).toBeVisible();

  // Sweep the best 3-star record (floor 1 stage 10) for half its pass.
  await page.getByRole('button', { name: 'Sweep best 3-star' }).click();
  await expect(page.getByText('Swept Floor 1 · Stage 10')).toBeVisible();
  await expect(page.getByText('Proofs of Sky 5/6')).toBeVisible();

  // Claim the reached 10-star floor chest once.
  await page.locator('.sky-chest button').first().click();
  await expect(page.getByText('Floor chest claimed.')).toBeVisible();
  await expect(page.locator('.sky-chest button').first()).toHaveText('Claimed');

  // A locked floor explains the previous-floor gate.
  await page.locator('.sky-floor').nth(2).click();
  await expect(page.getByText('Clear floor 2')).toBeVisible();

  // Re-challenging a passed stage is free and opens the replay.
  await page.locator('.sky-floor').first().click();
  await page.locator('.sky-stage').first().getByRole('button', { name: 'Re-challenge' }).click();
  await expect(page.getByRole('heading', { name: 'Battle', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('button', { name: 'Back to the pillar' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to the pillar' }).click();
  await expect(page.getByRole('heading', { name: 'Sky Pillar', exact: true })).toBeVisible();
});
