import { expect, test } from '@playwright/test';

/**
 * R9: the Bag — generic Pokémon shards compose into boxes, boxes open (docs/design/bag.md). Each test
 * starts from a brand-new account and uses the More page's debug grants.
 */

test('3-Star Pokémon Shards compose into a box that opens itself', async ({ page }) => {
  await page.goto('/more');
  await page.getByRole('button', { name: '+ 3-Star Pokémon Shards', exact: true }).click();

  await page.goto('/bag');
  const row = page.locator('[data-recipe="pokemonShard3"]');
  await expect(row).toContainText('100 / 40');
  await row.getByRole('button', { name: 'Make 1' }).click();
  await expect(page.getByTestId('bag-result').locator('.draw-card')).toHaveCount(1);
  await expect(page.getByTestId('bag-result')).toContainText('3★');
  await expect(row).toContainText('60 / 40');
});

test('the Selectable Precious Giftbox gives 50 shards of the chosen Legendary', async ({ page }) => {
  await page.goto('/more');
  await page.getByRole('button', { name: '+ Selectable Precious Giftboxes', exact: true }).click();

  await page.goto('/bag');
  const giftbox = page.locator('[data-box="preciousGiftbox"]');
  await expect(giftbox).toContainText('×1');
  await giftbox.getByRole('listitem').filter({ hasText: 'Raikou' }).getByRole('button', { name: 'Choose' }).click();
  await expect(page.getByTestId('bag-result')).toContainText('Raikou Shards ×50');
  await expect(giftbox).toContainText('×0');
});
