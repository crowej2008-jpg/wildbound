import { expect, test, type Page } from '@playwright/test';

/**
 * M11.0: the Wild screen's gear tabs exist, show a real stat sheet, and equipping
 * a held item raises the Power the player sees.
 */

const ROSTER = ['mimikyu', 'ninetales', 'charizard', 'starmie', 'blastoise', 'venusaur'];

interface SaveOptions {
  roster?: string[];
  currencies?: Record<string, number>;
}

function grownSave({ roster = ROSTER, currencies = {} }: SaveOptions = {}): string {
  return JSON.stringify({
    version: 6,
    state: {
      profile: { name: 'Gear Tester', level: 1, xp: 0 },
      roster: roster.map((speciesId, index) => ({
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
        ...currencies,
      },
      nextInstanceSeq: roster.length + 1,
      campaign: { stars: { 'c2-6': 3, 'c3-6': 3 } },
      tutorial: { step: 0, done: true },
    },
  });
}

async function importSave(page: Page, options: SaveOptions = {}): Promise<void> {
  await page.goto('/more');
  await page.locator('#import-save').fill(grownSave(options));
  await page.getByRole('button', { name: 'Import save' }).click();
  await expect(page.getByText(`Wilds: ${(options.roster ?? ROSTER).length}`)).toBeVisible();
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

test('Held Items level to 60 and refine with Held Item Shards', async ({ page }) => {
  await importSave(page, { currencies: { heldItemShard: 1_000 } });
  await page.goto('/wilds');
  await page.locator('.roster-item').first().click();
  await page.getByRole('button', { name: 'Held Items', exact: true }).click();

  await expect(page.getByText('Held Item Shards: 1,000')).toBeVisible();
  const row = page.locator('.gear-row').first();
  await expect(row).toContainText('Lv1/60');
  await row.getByRole('button', { name: 'Equip', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Unequip', exact: true })).toBeVisible();
  const power = () =>
    page.locator('.wild-power-lg strong').first().innerText().then((text) => Number(text.replace(/,/g, '')));
  const before = await power();

  await row.getByRole('button', { name: /Level up .*5 Held Item Shards/ }).click();
  await expect(row).toContainText('Lv2/60');
  await expect(page.getByText('Held Item Shards: 995')).toBeVisible();
  await expect.poll(power, { timeout: 15_000 }).toBeGreaterThan(before);

  await row.getByRole('button', { name: /Refine .*800 Gold .*10 Held Item Shards/ }).click();
  await expect(row).toContainText('Refine 1/5');
  await expect(page.getByText('Held Item Shards: 985')).toBeVisible();
});

test('Plates rise from stage 0 to 6 with Bottles then Fragments', async ({ page }) => {
  await importSave(page, { currencies: { plateBottle: 1_000, plateFragment: 1_000 } });
  await page.goto('/wilds');
  await page.locator('.roster-item').first().click();
  await page.getByRole('button', { name: 'Held Items', exact: true }).click();
  await page.getByRole('button', { name: 'Plates', exact: true }).click();

  await expect(page.getByText('Stage 0/20')).toBeVisible();
  await expect(page.getByText('Plates +0')).toBeVisible();
  for (let stage = 1; stage <= 5; stage += 1) {
    await page.getByRole('button', { name: /Raise stage/ }).click();
    await expect(page.getByText(`Stage ${stage}/20`)).toBeVisible();
  }
  await expect(page.getByText('Plates +0')).toBeHidden();
  await expect(page.getByRole('button', { name: /Raise stage .*375 Plate Fragments/ })).toBeVisible();
  await page.getByRole('button', { name: /Raise stage .*375 Plate Fragments/ }).click();
  await expect(page.getByText('Stage 6/20')).toBeVisible();
  await expect(page.getByText('Plate Fragments 625')).toBeVisible();
  await expect(page.getByText('Stage 6 skill swap: coming later.')).toBeVisible();
});

test('Trinkets level with Star Shards and show the shared species state', async ({ page }) => {
  await importSave(page, { currencies: { starShard: 1_000 } });
  await page.goto('/wilds');
  await page.locator('.roster-item').first().click();
  await page.getByRole('button', { name: 'Held Items', exact: true }).click();
  await page.getByRole('button', { name: 'Trinkets', exact: true }).click();

  await expect(page.getByText('Mimikyu Keepsake')).toBeVisible();
  await expect(page.getByText('Level 0/40')).toBeVisible();
  await expect(page.getByText('Trinkets +0')).toBeVisible();
  await expect(page.getByText('Star Shards: 1,000')).toBeVisible();
  await expect(page.getByText('Shared by every copy of this species.')).toBeVisible();
  await expect(page.getByText('Shiny variant: coming later.')).toBeVisible();

  await page.getByRole('button', { name: /Level up .*10 Star Shards/ }).click();
  await expect(page.getByText('Level 1/40')).toBeVisible();
  await expect(page.getByText('Star Shards: 990')).toBeVisible();
  await expect(page.getByText('Trinkets +0')).toBeHidden();
  await expect(page.getByRole('button', { name: /Level up .*15 Star Shards/ })).toBeVisible();
});

test('Orbs equip and level with Orb Essence', async ({ page }) => {
  await importSave(page, { currencies: { orbEssence: 1_000 } });
  await page.goto('/wilds');
  await page.locator('.roster-item').first().click();
  const power = () =>
    page.locator('.wild-power-lg strong').first().innerText().then((text) => Number(text.replace(/,/g, '')));
  const before = await power();

  await page.getByRole('button', { name: 'Orbs', exact: true }).click();
  const first = page.locator('.gear-row').filter({ hasText: 'Verdant Spark' }).first();
  await first.getByRole('button', { name: 'Equip', exact: true }).click();
  await expect.poll(power, { timeout: 15_000 }).toBeGreaterThan(before);

  const equipped = await power();
  await first.getByRole('button', { name: /Use Orb Essence/ }).click();
  await expect(first).toContainText('Lv2/6');
  await expect.poll(power, { timeout: 15_000 }).toBeGreaterThan(equipped);
});

test('Berries fill two slots, star up with copies + Essence, and dismantle spares', async ({ page }) => {
  await importSave(page, { currencies: { berryEssence: 1_000 } });
  await page.goto('/wilds');
  await page.locator('.roster-item').first().click();
  await page.getByRole('button', { name: 'Berries', exact: true }).click();

  await expect(page.getByText('Berry Essence: 1,000')).toBeVisible();
  await expect(page.getByText('Berry slots')).toBeVisible();
  const sun = page.locator('.gear-row').filter({ hasText: 'Sunpetal Berry' });
  const mist = page.locator('.gear-row').filter({ hasText: 'Mistbud Berry' });
  await sun.getByRole('button', { name: 'Equip 1', exact: true }).click();
  await mist.getByRole('button', { name: 'Equip 2', exact: true }).click();
  await expect(page.getByText(/1\. Sunpetal Berry/)).toBeVisible();
  await expect(page.getByText(/2\. Mistbud Berry/)).toBeVisible();

  const ember = page.locator('.gear-row').filter({ hasText: 'Emberfruit' });
  await ember.getByRole('button', { name: /Star up.*2 copies.*20 Berry Essence/ }).click();
  await expect(ember).toContainText('2/2★');
  await expect(page.getByText('Berry Essence: 980')).toBeVisible();

  const glimmer = page.locator('.gear-row').filter({ hasText: 'Glimmerberry' });
  await glimmer.getByRole('button', { name: /Dismantle.*\+5/ }).click();
  await expect(glimmer).toContainText('x2');
  await expect(page.getByText('Berry Essence: 985')).toBeVisible();
});

test('Soul-hearts activate a 2-piece set and star up with EXP', async ({ page }) => {
  await importSave(page, { currencies: { soulHeartExp: 1_000 } });
  await page.goto('/wilds');
  await page.locator('.roster-item').first().click();

  await page.getByRole('button', { name: 'Soul-hearts', exact: true }).click();
  await expect(page.getByText('Soul-heart EXP: 1,000')).toBeVisible();
  const rows = page.locator('.gear-row');
  await expect(rows.first()).toContainText('2★');

  await rows.nth(0).getByRole('button', { name: 'Equip', exact: true }).click();
  await rows.nth(1).getByRole('button', { name: 'Equip', exact: true }).click();
  await expect(page.locator('.chip-on', { hasText: '2pc' }).first()).toBeVisible();

  await rows.nth(0).getByRole('button', { name: /Star-up .* 80/ }).click();
  await expect(rows.first()).toContainText('3★');
  await expect(page.getByText('Soul-heart EXP: 920')).toBeVisible();
});

test('Potential eats a duplicate copy and raises Power', async ({ page }) => {
  await importSave(page, {
    roster: ['mimikyu', ...ROSTER],
    currencies: { potentialShard: 1_000 },
  });
  await page.goto('/wilds');
  await page.locator('.roster-item').first().click();
  const power = () =>
    page.locator('.wild-power-lg strong').first().innerText().then((text) => Number(text.replace(/,/g, '')));
  const before = await power();

  await page.getByRole('button', { name: 'Potential', exact: true }).click();
  await expect(page.getByText(/Duplicates: 1/)).toBeVisible();
  await page.getByRole('button', { name: 'Ashpike Discipline', exact: true }).click();

  const firstTier = page.locator('.gear-row').first();
  await expect(firstTier).toContainText('Cost 20 Potential Shards');
  await firstTier.getByRole('button', { name: 'Trained for power', exact: true }).click();

  await expect(page.getByText(/Duplicates: 0/)).toBeVisible();
  await expect(firstTier).toContainText('Re-pick 5 Potential Shards');
  await expect.poll(power, { timeout: 15_000 }).toBeGreaterThan(before);
});
