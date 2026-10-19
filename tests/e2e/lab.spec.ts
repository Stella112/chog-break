import { expect, test, type Page } from '@playwright/test';

// §F Phase 2: home → lab → pick A → pick B → splice → reveal → notebook, no console errors.
function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function pick(page: Page, query: string, slot: 'A' | 'B') {
  await page.getByPlaceholder('Number or trait (crown, laser…)').fill(query);
  await page.locator('.cell').first().click();
  await page.getByRole('button', { name: `LOAD INTO ${slot}` }).click();
}

test('guest splice flow', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE LAB' }).click();
  await pick(page, '18', 'A'); // token 18: purple laser
  await pick(page, '66', 'B'); // token 66: crown
  await page.getByRole('button', { name: 'SPLICE' }).click();
  await expect(page.locator('.mutant-name')).toHaveText('KING BEAM', { timeout: 10_000 });
  await expect(page.getByText('from #1479').first()).toBeVisible();
  await expect(page).toHaveURL(/a=18&b=66/);
  await page.getByRole('button', { name: 'NOTEBOOK', exact: true }).click();
  await expect(page.getByText('SECRET MUTATIONS: 1 / ???')).toBeVisible();
  await page.reload();
  await expect(page.getByText('SECRET MUTATIONS: 1 / ???')).toBeVisible();
  expect(errors).toEqual([]);
});

test('deep link is deterministic and order-independent', async ({ page, browser }) => {
  test.setTimeout(90_000);
  await page.goto('/?a=1053&b=88');
  const name = await page.locator('.mutant-name').textContent({ timeout: 10_000 });
  const ctx2 = await browser.newContext(); // second profile, empty storage
  const p2 = await ctx2.newPage();
  await p2.goto('/?a=88&b=1053');
  await expect(p2.locator('.mutant-name')).toHaveText(name!, { timeout: 10_000 });
  await ctx2.close();
});

test('invalid deep link shows a friendly error and the Lab still works', async ({ page }) => {
  await page.goto('/?a=5&b=5');
  await expect(page.getByText("A Chog can't be spliced with itself.")).toBeVisible();
  await page.goto('/?a=1&b=99999');
  await expect(page.getByText(/No Chog with token ID 99999/)).toBeVisible();
  await expect(page.getByPlaceholder('Number or trait (crown, laser…)')).toBeVisible();
});

test('filters are generated from the manifest', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE LAB' }).click();
  await page.locator('select').first().selectOption('Head');
  await page.locator('select').nth(1).selectOption('crown');
  await expect(page.getByText('54 CHOGS')).toBeVisible();
});

test('secret mutation button resolves a recipe', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'TRY A SECRET MUTATION' }).click();
  await expect(page.getByText('SECRET MUTATION DISCOVERED')).toBeVisible({ timeout: 10_000 });
});

test('375px viewport has no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE LAB' }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('one click on a Chog fills the next empty chamber', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER THE LAB' }).click();
  await page.locator('.cell').nth(0).click();
  await expect(page.locator('.chamber-a.is-loaded')).toBeVisible();
  await page.locator('.cell').nth(1).click();
  await expect(page.locator('.chamber-b.is-loaded')).toBeVisible();
  await expect(page.getByRole('button', { name: 'SPLICE' })).toBeEnabled();
  // Both full: a click shows details instead of replacing a parent.
  await page.locator('.cell').nth(2).click();
  await expect(page.getByRole('button', { name: 'LOAD INTO B' })).toBeVisible();
});
