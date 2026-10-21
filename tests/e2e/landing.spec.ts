import { expect, test } from '@playwright/test';

test('landing at /: real content, no game data downloaded; ENTER THE LAB opens the Lab', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Pick two Chogs.');
  await expect(page.getByText('1,937,496')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'KING BEAM' })).toBeVisible();
  await page.waitForTimeout(500);
  expect(requested.some((u) => u.includes('/data/chogs.min.json'))).toBe(false); // the landing stays light
  await page.getByRole('link', { name: 'ENTER THE LAB' }).first().click();
  await expect(page).toHaveURL(/\/play/);
  await expect(page.getByPlaceholder('Number or trait (crown, laser…)')).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
});

test('landing: secret-mutation link reveals KING BEAM; old /?a= links still open the game', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'TRY A SECRET MUTATION' }).click();
  await expect(page.getByText('SECRET MUTATION DISCOVERED')).toBeVisible({ timeout: 30_000 });
  await page.goto('/?a=18&b=66');
  await expect(page.getByText('SECRET MUTATION DISCOVERED')).toBeVisible({ timeout: 30_000 });
});

test('landing fits a phone without sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
