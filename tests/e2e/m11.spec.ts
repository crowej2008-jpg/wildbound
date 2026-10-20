import { expect, test, type Page } from '@playwright/test';

/**
 * M11.0: the Wild screen's gear tabs exist, show a real stat sheet, and equipping
 * a held item raises the Power the player sees.
 */

const ROSTER = ['mimikyu', 'ninetales', 'charizard', 'starmie', 'blastoise', 'venusaur'];

function grownSave(): string {
  return JSON.stringify({
    version: 6,
    state: {
      profile: { name: 'Gear Tester', level: 1, xp: 0 },
      roster: ROSTER.map((speciesId, index) => ({
        id: `w${index + 1}`,
        speciesId,
        level: 40,
        stars: 10,
        evolutionStage: 2,
        locked: false,
        acquiredAt: 0,
      })),
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
      campaign: { stars: { 'c2-6': 3, 'c3-6': 3 } },
      tutorial: { step: 0, done: true },
    },
  });
}

async function importSave(page: Page): Promise<void> {
  await page.goto('/more');
  await page.locator('#import-save').fill(grownSave());
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText(`Wilds: ${ROSTER.length}`)).toBeVisible();
}

test('the Trainer tab lists the M11 materials and keeps More reachable', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await nav.getByRole('link', { name: 'Trainer' }).click();
  await expect(page.getByRole('heading', { name: 'Trainer', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Collection materials', exact: true })).toBeVisible();
  await expect(page.getByText('Potential Shards')).toBeVisible();
  await expect(page.getByText('Title Tickets')).toBeVisible();
  await expect(page.getByText('VIP privileges are coming later.')).toBeVisible();
  await page.getByRole('link', { name: 'Debug & saves' }).click();
  await expect(page.getByRole('heading', { name: 'More' })).toBeVisible();
});

test('Wild screen shows the stat sheet and equipping a held item raises Power', async ({ page }) => {
  await importSave(page);
  await page.goto('/wilds');
  await page.locator('.roster-item').first().click();

  await expect(page.getByRole('button', { name: 'Held Items', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Orbs', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Soul-hearts', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Berries', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Potential', exact: true })).toBeVisible();
  await expect(page.getByText('Stats', { exact: true })).toBeVisible();

  const powerText = await page.locator('.wild-power-lg strong').first().innerText();
  const before = Number(powerText.replace(/,/g, ''));
  expect(before).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Held Items', exact: true }).click();
  const first = page.locator('.gear-row').first();
  await expect(first).toBeVisible();
  await first.getByRole('button', { name: 'Equip', exact: true }).click();

  await expect(first.getByRole('button', { name: 'Unequip', exact: true })).toBeVisible();
  await expect
    .poll(
      async () => Number((await page.locator('.wild-power-lg strong').first().innerText()).replace(/,/g, '')),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(before);
});
