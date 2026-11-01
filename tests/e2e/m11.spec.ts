import { expect, test, type Page } from '@playwright/test';
import { E2E_SAVE_VERSION } from './save-version';

/**
 * M11.0: the Wild screen's gear tabs exist, show a real stat sheet, and equipping
 * a held item raises the Power the player sees.
 */

const ROSTER = ['mimikyu', 'ninetales', 'charizard', 'starmie', 'blastoise', 'venusaur'];

interface SaveOptions {
  roster?: string[];
  currencies?: Record<string, number>;
  profile?: { name?: string; level?: number; xp?: number };
  equipment?: unknown;
}

function grownSave({ roster = ROSTER, currencies = {}, profile = {}, equipment }: SaveOptions = {}): string {
  return JSON.stringify({
    version: E2E_SAVE_VERSION,
    state: {
      profile: { name: 'Gear Tester', level: 1, xp: 0, ...profile },
      // `species@stars` sets a star (fodder); the default is 10★.
      roster: roster.map((entry, index) => ({
        id: `w${index + 1}`,
        speciesId: entry.split('@')[0],
        level: 40,
        stars: Number(entry.split('@')[1] ?? 10),
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
      campaign: { stars: { 'c2-10': 3, 'c3-10': 3 } },
      tutorial: { step: 0, done: true },
      ...(equipment ? { equipment } : {}),
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
  await expect(page.getByText('Title Tickets', { exact: true })).toBeVisible();
  await expect(page.getByText('VIP 0 · Visitor')).toBeVisible();
  await expect(page.getByText('Reach VIP 1 for a daily supply.')).toBeVisible();
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

/** R5: one Mythic Shell Bell (ATK) with six fixed Critical lines. */
const MYTHIC_EQUIPMENT = {
  relics: [
    {
      id: 're1',
      defId: '105101',
      level: 0,
      group: 2,
      lines: Array.from({ length: 6 }, () => ({ index: 1521, value: 1000, refines: 0 })),
      refines: 0,
      pending: null,
      locked: false,
    },
  ],
  orbs: [],
  cores: [],
  charms: {},
  charmStars: {},
  nextSeq: 2,
};

test('Held Items level from 0 on the source table and refine a worn Mythic (first roll free)', async ({ page }) => {
  await importSave(page, { currencies: { heldItemShard: 1_000 }, equipment: MYTHIC_EQUIPMENT });
  await page.goto('/wilds');
  await page.locator('.roster-item').first().click();
  await page.getByRole('button', { name: 'Held Items', exact: true }).click();

  await expect(page.getByText(/Held Item Shards: 1,000/)).toBeVisible();
  const row = page.locator('.gear-row').first();
  await expect(row).toContainText('Shell Bell');
  await expect(row).toContainText('Lv0/200');
  await expect(row).toContainText('P.ATK +38,515');
  await expect(row).toContainText('Total P.ATK +12.00%');
  await row.getByRole('button', { name: 'Equip', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Unequip', exact: true })).toBeVisible();
  const power = () =>
    page.locator('.wild-power-lg strong').first().innerText().then((text) => Number(text.replace(/,/g, '')));
  const before = await power();

  await row.getByRole('button', { name: /Level up .*20 Held Item Shards/ }).click();
  await expect(row).toContainText('Lv1/200');
  await expect(page.getByText(/Held Item Shards: 980/)).toBeVisible();
  await expect.poll(power, { timeout: 15_000 }).toBeGreaterThan(before);

  await row.getByRole('button', { name: 'Refine · Free' }).first().click();
  await expect(row.getByText('New roll', { exact: false })).toBeVisible();
  await row.getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(row).toContainText('Refines 1/21');
  await expect(row.getByRole('button', { name: 'Refine · 1 Resetters' }).first()).toBeVisible();
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

test('Resonance opens slots and assigns a Wild', async ({ page }) => {
  await importSave(page, { currencies: { resonationShard: 200 } });
  await page.goto('/trainer');

  await expect(page.getByRole('heading', { name: 'Resonance' })).toBeVisible();
  await expect(page.getByText('Resonation Shards: 200')).toBeVisible();
  await expect(page.getByLabel('Slot 1')).toBeVisible();
  await expect(page.getByLabel('Slot 2')).toBeVisible();
  await expect(page.getByRole('button', { name: /Open slot 3 .*50 Resonation Shards/ })).toBeVisible();

  await page.getByRole('button', { name: /Open slot 3 .*50 Resonation Shards/ }).click();
  await expect(page.getByText('Resonation Shards: 150')).toBeVisible();
  await expect(page.getByLabel('Slot 3')).toBeVisible();
  await expect(page.getByRole('button', { name: /Open slot 4 .*100 Resonation Shards/ })).toBeVisible();

  await page.getByLabel('Slot 1').selectOption('w1');
  await expect(page.getByLabel('Slot 1')).toHaveValue('w1');
  await expect(page.getByText('Link Crystal locked')).toBeVisible();
  await expect(page.getByText('No bonus until the Link Crystal is unlocked.')).toBeVisible();
});

test('VIP derives its tier from lifetime XP and claims the daily supply', async ({ page }) => {
  await importSave(page, { profile: { xp: 5_000 } });
  await page.goto('/trainer');

  await expect(page.getByRole('heading', { name: 'VIP privileges' })).toBeVisible();
  await expect(page.getByText('VIP 2 · Silver')).toBeVisible();
  await expect(page.getByText('Next: Gold · 10,000 XP')).toBeVisible();
  await expect(page.getByText('+2h')).toBeVisible();
  await expect(page.getByText('4%')).toBeVisible();
  await expect(page.getByText('1 Common Tickets/day', { exact: true })).toBeVisible();
  await expect(page.getByText('There are no purchases.')).toBeVisible();

  await page.getByRole('button', { name: /Claim daily supply .*1 Common Tickets\/day/ }).click();
  await expect(page.getByText('Claimed today.')).toBeVisible();
});

test('Titles activate, equip a slot and keep locked rows honest', async ({ page }) => {
  await importSave(page, { currencies: { titleTicket: 20 } });
  await page.goto('/trainer');

  await expect(page.getByRole('heading', { name: 'Titles' })).toBeVisible();
  await expect(page.getByText('Title Tickets: 20 · Owned: 0')).toBeVisible();
  await expect(page.getByLabel('Common Title')).toBeVisible();

  const first = page.locator('[data-title-id="trail-01"]');
  await expect(first.getByRole('button', { name: /Activate .*1 Title Tickets/ })).toBeVisible();
  await first.getByRole('button', { name: /Activate .*1 Title Tickets/ }).click();

  await expect(page.getByLabel('Common Title')).toHaveValue('trail-01');
  await expect(first.getByText('Stage 1/1')).toBeVisible();
  await expect(page.getByText('Title Tickets: 19 · Owned: 1')).toBeVisible();

  await expect(page.locator('[data-title-id="trail-02"]').getByText('Requires: Trainer level 2')).toBeVisible();

  await page.getByRole('tab', { name: 'Rare' }).click();
  await expect(page.getByText('Guild Vanguard')).toBeVisible();
  await expect(page.getByText('Coming later: guild war (M16).').first()).toBeVisible();
  await expect(page.getByText('Coming later: events (M15).').first()).toBeVisible();
});

test('Orbs: socket a red Sharp Orb, then level it with two copies', async ({ page }) => {
  const orb = (id: string) => ({ id, kind: 'sharp', colour: 'red', level: 1, lines: [{ field: 'dmgBoost', roll: 1 }] });
  await importSave(page, {
    profile: { level: 60 },
    equipment: { relics: [], orbs: [orb('orb1'), orb('orb2'), orb('orb3')], cores: [], charms: {}, charmStars: {}, nextSeq: 4 },
  });
  await page.goto('/wilds');
  await page.locator('.roster-item').first().click();
  const power = () =>
    page.locator('.wild-power-lg strong').first().innerText().then((text) => Number(text.replace(/,/g, '')));
  const before = await power();

  await page.getByRole('button', { name: 'Orbs', exact: true }).click();
  const socket = page.getByTestId('orb-socket-0');
  await socket.getByRole('button', { name: /Socket an orb/ }).click();
  await socket.getByRole('button', { name: /Sharp Orb \+1/ }).first().click();
  await expect(socket).toContainText('Sharp Orb +1');
  await expect.poll(power, { timeout: 15_000 }).toBeGreaterThan(before);

  const equipped = await power();
  await page.getByRole('button', { name: /Level up · 10,000/ }).first().click();
  await expect(socket).toContainText('Sharp Orb +2');
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

test('Potential: tier 1 takes three 3★ Fire Pokémon and 20,000 shards, then levels', async ({ page }) => {
  await importSave(page, {
    roster: ['mimikyu', ...ROSTER, 'ninetales@3', 'ninetales@3', 'ninetales@3'],
    currencies: { potentialShard: 100_000 },
  });
  await page.goto('/wilds');
  await page.locator('.roster-item').first().click();
  await page.getByRole('button', { name: 'Potential', exact: true }).click();

  const tier1 = page.getByTestId('potential-tier-1');
  await expect(tier1).toContainText('3/3 × 3★ Fire');
  await tier1.getByRole('button', { name: 'Victory Star', exact: true }).click();
  await tier1.getByRole('button', { name: /Unlock · 20,000/ }).click();
  await expect(tier1).toContainText('Lv.1/6');
  await expect(page.getByText(/Potential Shards: 80,000/)).toBeVisible();
  await tier1.getByRole('button', { name: /Level up · 26,000/ }).click();
  await expect(tier1).toContainText('Lv.2/6');
  await expect(page.getByTestId('potential-tier-5')).toContainText('Locked');
});
