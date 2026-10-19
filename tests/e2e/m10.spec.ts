import { expect, test, type Page } from '@playwright/test';

/**
 * M10.2 Arena (PROMPT §7.7). Fresh contexts start with a brand-new account, so
 * the Arena is gated (its campaign chapter is not cleared). The second test
 * imports a grown save through the More debug tools so the Arena is open and a
 * real 6v6 against a matched ghost can be replayed, claimed and refreshed.
 */

/** The starting roster, grown well past the Arena's ghost strength. */
const ROSTER = ['ninetales', 'charizard', 'starmie', 'blastoise', 'venusaur', 'raichu'];

/**
 * A minimal save: `migrateSave` fills every other slice (idle, quests, mail,
 * pve, pvp …) from defaults, so this only declares what the PvP flows read.
 * `stars` clears campaign stages (`c2-6` opens the Arena, `c3-6` the Ranked
 * ladder).
 */
function grownSave(stars: Record<string, number> = { 'c2-6': 3 }): string {
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
      profile: { name: 'Arena Tester', level: 1, xp: 0 },
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
      campaign: { stars },
      tutorial: { step: 0, done: true },
    },
  });
}

async function importGrown(page: Page, stars?: Record<string, number>): Promise<void> {
  await page.goto('/more');
  await page.locator('#import-save').fill(grownSave(stars));
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText(`Wilds: ${ROSTER.length}`)).toBeVisible();
}

test('a fresh account opens the PvP hub and sees the locked Arena and ranking board', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('main').getByRole('link', { name: 'PvP' }).click();
  await expect(page.getByRole('heading', { name: 'PvP' })).toBeVisible();

  // Six entry points; the three modes that need the shared service say so.
  await expect(page.locator('.town-tile')).toHaveCount(6);
  await expect(page.getByText('Coming later')).toHaveCount(3);
  await expect(page.getByText('Locked — clear campaign chapter 2')).toBeVisible();

  await page.getByRole('main').getByRole('link', { name: /^Arena/ }).click();
  await expect(page.getByRole('heading', { name: 'Arena' })).toBeVisible();
  await expect(page.getByText('Clear this campaign chapter to unlock the Arena: 2')).toBeVisible();

  await page.getByRole('link', { name: /Rankings/ }).click();
  await expect(page.getByRole('heading', { name: 'Arena Rankings' })).toBeVisible();
  await expect(page.getByText('Rank bands')).toBeVisible();
  await expect(page.locator('.chip', { hasText: 'You' })).toBeVisible();
  await expect(page.getByText('Worship and lucky ranks need a live population')).toBeVisible();
});

test('fights a matched ghost, claims the chest and buys an attempt', async ({ page }) => {
  await importGrown(page);
  await page.goto('/arena');
  await expect(page.getByRole('heading', { name: 'Arena' })).toBeVisible();

  const attempts = page.locator('.stat', { hasText: 'Attempts' });
  await expect(attempts).toContainText('5/5');

  // Three matched opponents, each a real generated squad with a power readout.
  const opponents = page.locator('section', { has: page.getByRole('heading', { name: 'Opponents' }) });
  const fight = opponents.getByRole('button', { name: 'Challenge' });
  await expect(fight).toHaveCount(3);
  await expect(opponents.locator('.milestone-row').first()).toContainText('Power');
  await fight.first().click();

  await expect(page.locator('.battle-unit').first()).toBeVisible();
  await page.getByRole('button', { name: 'Skip to end' }).click();
  await expect(page.locator('.result-panel .result-banner strong')).toHaveText('Victory');
  await expect(page.locator('.arena-result')).toContainText('PvP Credits now');
  await page.getByRole('button', { name: 'Back to Arena' }).click();

  await expect(page.getByRole('heading', { name: 'Arena' })).toBeVisible();
  await expect(attempts).toContainText('4/5');

  // One battle reaches the first participation chest.
  const chest = page.locator('.milestone-row', { has: page.getByText('1 battles') });
  await chest.getByRole('button', { name: 'Claim' }).click();
  await expect(chest.getByRole('button', { name: 'Claimed' })).toBeDisabled();

  // Buying an attempt raises the day's total from 5 to 6.
  await page.getByRole('button', { name: /Buy attempt/ }).click();
  await expect(attempts).toContainText('/6');
});

test('a fresh account sees the locked Ranked ladder', async ({ page }) => {
  await page.goto('/pvp');
  await page.getByRole('main').getByRole('link', { name: /^Ranked/ }).click();
  await expect(page.getByRole('heading', { name: 'Ranked' })).toBeVisible();
  await expect(page.getByText('Clear this campaign chapter to unlock the Ranked ladder: 3')).toBeVisible();
});

test('plays a Ranked series, moves the ladder and claims a tier', async ({ page }) => {
  await importGrown(page, { 'c2-6': 3, 'c3-6': 3 });
  await page.goto('/ranked');
  await expect(page.getByRole('heading', { name: 'Ranked' })).toBeVisible();

  // The bottom region opens with the season's weather and six daily attempts.
  await expect(page.locator('.stat', { hasText: 'Region' })).toContainText('Kanto');
  await expect(page.locator('.stat', { hasText: 'Attempts' })).toContainText('6/6');
  await expect(page.getByText('Weather:')).toBeVisible();
  await expect(page.locator('.ranked-bar')).toBeVisible();

  // A series replays each game; the result card reports the ladder move.
  await page.getByRole('button', { name: 'Start matching' }).click();
  await expect(page.locator('.battle-unit').first()).toBeVisible();
  await page.getByRole('button', { name: 'Skip to end' }).click();
  const series = page.locator('.ranked-series');
  await expect(series).toContainText('Series');
  await expect(series).toContainText('Points');
  await page.getByRole('button', { name: 'Back to Ranked' }).click();

  await expect(page.getByRole('heading', { name: 'Ranked' })).toBeVisible();
  await expect(page.locator('.stat', { hasText: 'Attempts' })).toContainText('5/6');

  // The bottom tier is reached on day one, so its region coins are claimable once.
  const tier = page.locator('.milestone-row', { hasText: 'Vanguard I' }).first();
  await tier.getByRole('button', { name: 'Claim' }).click();
  await expect(tier.getByRole('button', { name: 'Claimed' })).toBeDisabled();

  // The first challenge gift needs five matches, so it stays locked today.
  const gift = page.locator('.milestone-row', { hasText: /^5 Matches/ }).first();
  await expect(gift.getByRole('button', { name: 'Not reached' })).toBeDisabled();
});
