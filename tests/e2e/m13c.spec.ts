import { expect, test, type Page } from '@playwright/test';

/** M13.1: a cleared c1-10 save opens the Pet Home merge board and its shops. */

const ROSTER = ['ninetales', 'charizard', 'starmie', 'blastoise', 'venusaur', 'raichu'];

function homeSave(): string {
  const roster = ROSTER.map((speciesId, index) => ({
    id: `w${index + 1}`,
    speciesId,
    level: 100,
    stars: 5,
    evolutionStage: 2,
    locked: false,
    acquiredAt: 0,
  }));
  return JSON.stringify({
    version: 6,
    state: {
      profile: { name: 'Home Tester', level: 50, xp: 0 },
      roster,
      squads: { campaign: [], arenaAttack: [], arenaDefence: [], tower: [], worldBoss: [] },
      strategies: {
        campaign: 'balanced',
        arenaAttack: 'aggressive',
        arenaDefence: 'defensive',
        tower: 'balanced',
        worldBoss: 'aggressive',
      },
      currencies: { gold: 50_000, gems: 5_000, homeCoin: 500_000, orbEssence: 1_000 },
      nextInstanceSeq: ROSTER.length + 1,
      campaign: { stars: { 'c1-10': 3 } },
      tutorial: { step: 0, done: true },
      petHome: {
        xp: 550,
        unlockedTiles: [],
        pets: [],
        nextPetSeq: 1,
        lastSettledAt: 0,
        summonDay: '2026-10-28',
        freeSummonsUsed: 0,
        paidSummonsUsed: 0,
        levelClaims: [],
        album: [],
        shopDay: '2026-10-28',
        shopRefreshes: 0,
        shopBought: [],
      },
    },
  });
}

async function importSave(page: Page): Promise<void> {
  await page.goto('/more');
  await page.locator('#import-save').fill(homeSave());
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText(`Wilds: ${ROSTER.length}`)).toBeVisible();
}

test('summons, opens, merges and unlocks on the Pet Home board', async ({ page }) => {
  await importSave(page);
  await page.goto('/explore/pet-home');
  await expect(page.getByRole('heading', { name: 'Pet Home', exact: true })).toBeVisible();
  await expect(page.getByText('Home level 2')).toBeVisible();
  await expect(page.locator('.pet-home-tile')).toHaveCount(21);
  await expect(page.locator('.pet-home-hole')).toHaveCount(4);

  // Summon and open a ball.
  await page.locator('.pet-home-summon-row button').click();
  await expect(page.getByText('A new ball landed on the board.')).toBeVisible();
  await expect(page.locator('.pet-home-tile.has-pet')).toHaveCount(1);
  await page.locator('.pet-home-tile.has-pet').click();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByText('The ball opened.')).toBeVisible();

  // Summon a second ball, open it, then merge the two level-1 Wilds.
  await page.locator('.pet-home-summon-row button').click();
  await expect(page.locator('.pet-home-tile.has-pet')).toHaveCount(2);
  await page.locator('.pet-home-tile.has-pet').filter({ hasText: 'Ball' }).click();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.locator('.pet-home-tile.has-pet')).toHaveCount(2);
  await page.locator('.pet-home-tile.has-pet').first().click();
  await page.locator('.pet-home-merge-list button').first().click();
  await expect(page.getByText('The Wilds merged.')).toBeVisible();
  await expect(page.locator('.pet-home-tile.has-pet')).toHaveCount(1);
  await expect(page.locator('.pet-home-tile.has-pet .pet-home-tile-level')).toHaveText('Lv 2');

  // A revealed padlock opens for the Home level's gem price.
  await page.locator('.pet-home-tile.is-locked:not(.is-hidden)').first().click();
  await page.getByRole('button', { name: /Open tile/ }).click();
  await expect(page.getByText('The tile is open.')).toBeVisible();

  // Level rewards and both shops are reachable without dead controls.
  await page.getByRole('button', { name: 'Claim', exact: true }).first().click();
  await expect(page.getByText('Level reward claimed.')).toBeVisible();
  await page.getByRole('tab', { name: 'Shops', exact: true }).click();
  await expect(page.locator('.pet-home-shop')).toHaveCount(2);
  await expect(page.locator('.pet-home-shop').nth(1)).toContainText('Shop opens at Home Lv 10');
  await page.locator('.pet-home-shop').first().locator('.shop-item button').first().click();
  await expect(page.locator('.pet-home-status')).toHaveText('Bought');
  await page.locator('.pet-home-shop').first().getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByText('The shop page changed.')).toBeVisible();

  await page.getByRole('tab', { name: 'Album', exact: true }).click();
  await expect(page.locator('.pet-home-album-entry')).toHaveCount(84);
  await expect(page.locator('.pet-home-album-entry.is-seen').first()).toBeVisible();
});
