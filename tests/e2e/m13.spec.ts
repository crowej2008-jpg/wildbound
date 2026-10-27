import { expect, test, type Page } from '@playwright/test';

/**
 * M13.0a campaign volume and the first Victory Road gate. A minimal grown save
 * clears chapters 1-2 so chapter 3 is reachable, then the test proves 3-1 is
 * blocked until Cinderwatch Gym falls.
 */

const ROSTER = ['ninetales', 'charizard', 'starmie', 'blastoise', 'venusaur', 'raichu'];

function chapterTwoStars(): Record<string, number> {
  const stars: Record<string, number> = {};
  for (let chapter = 1; chapter <= 2; chapter += 1) {
    for (let index = 1; index <= 10; index += 1) stars[`c${chapter}-${index}`] = 3;
  }
  return stars;
}

function grownSave(): string {
  const roster = ROSTER.map((speciesId, index) => ({
    id: `w${index + 1}`,
    speciesId,
    level: 140,
    stars: 10,
    evolutionStage: 2,
    locked: false,
    acquiredAt: 0,
  }));
  return JSON.stringify({
    version: 6,
    state: {
      profile: { name: 'Gate Tester', level: 1, xp: 0 },
      roster,
      squads: { campaign: [], arenaAttack: [], arenaDefence: [], tower: [], worldBoss: [] },
      strategies: {
        campaign: 'balanced',
        arenaAttack: 'aggressive',
        arenaDefence: 'defensive',
        tower: 'balanced',
        worldBoss: 'aggressive',
      },
      currencies: {
        gold: 500_000,
        gems: 2_000,
        candy: 100_000,
        shard: 500,
        stone: 50,
        ticketCommon: 0,
        ticketPremium: 0,
        arenaToken: 0,
        guildCoin: 0,
        homeCoin: 0,
        forestCoin: 0,
        islandCoin: 0,
        wildCoin: 0,
      },
      nextInstanceSeq: ROSTER.length + 1,
      campaign: { stars: chapterTwoStars() },
      tutorial: { step: 0, done: true },
    },
  });
}

async function importGrown(page: Page): Promise<void> {
  await page.goto('/more');
  await page.locator('#import-save').fill(grownSave());
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText(`Wilds: ${ROSTER.length}`)).toBeVisible();
}

test('chapter 3 is blocked by its gym until the gym is defeated', async ({ page }) => {
  await importGrown(page);
  await page.goto('/campaign');

  await expect(page.getByRole('heading', { name: /Chapter 3/ })).toBeVisible();
  const gateCard = page.locator('.gate-card');
  await expect(gateCard.getByText('Gym gate: Cinderwatch Gym')).toBeVisible();
  await expect(gateCard.getByText('Gate open - challenge the gym')).toBeVisible();

  const first = page.locator('.stage-row').first();
  await expect(first.getByText('1. Shadewood Fringe')).toBeVisible();
  await expect(first.getByRole('button', { name: 'Challenge' })).toBeDisabled();

  await page.getByRole('button', { name: 'Challenge gym' }).click();
  await expect(page.locator('.battle-unit').first()).toBeVisible();
  await page.getByRole('button', { name: 'Skip to end' }).click();
  await expect(page.locator('.result-rewards .result-banner strong')).toHaveText('Gym victory');
  await expect(page.getByText('Gym cleared! The next story stage is open.')).toBeVisible();

  await page.getByRole('button', { name: 'Back to campaign' }).click();
  await expect(page.locator('.gate-card').getByText('Cleared', { exact: true })).toBeVisible();
  await expect(page.locator('.stage-row').first().getByRole('button', { name: 'Challenge' })).toBeEnabled();
});
