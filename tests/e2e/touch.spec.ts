import { devices, expect, test } from '@playwright/test';

// Phones: the fight gets on-screen controls that drive player 1 exactly like the keyboard does.
test.use({ ...devices['Pixel 7 landscape'] });

async function toArena(page: import('@playwright/test').Page) {
  await page.goto('/play/?a=18&b=66&fight=1&test=1');
  await expect(page.getByText('On-screen buttons appear in the fight.', { exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('On-screen buttons: move on the left', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'FIGHT ▸' }).click();
  await page.waitForFunction(() => (window as any).__arena?.state().live === true, null, { timeout: 30_000 });
}

const hold = async (page: import('@playwright/test').Page, name: string | RegExp, ms: number) => {
  const b = page.locator('.touch-ui').getByRole('button', { name });
  await b.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true });
  await page.waitForTimeout(ms);
  await b.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true });
};

test('touch: on-screen buttons move, jump and punch player 1; coach shows button names; no sideways scroll', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await toArena(page);
  await expect(page.locator('.touch-ui')).toBeVisible();
  await expect(page.locator('.topbar')).toBeHidden(); // full screen for the arena
  await expect(page.getByRole('button', { name: /^SPEC: / })).toBeVisible(); // labelled with the mutant's real special

  await page.evaluate(() => (window as any).__arena.idle(1, 1000)); // park the bot out of the way
  const x0 = await page.evaluate(() => (window as any).__arena.scene.fighters[0].x);
  await hold(page, '▶', 600);
  const x1 = await page.evaluate(() => (window as any).__arena.scene.fighters[0].x);
  expect(x1 - x0).toBeGreaterThan(80);

  await hold(page, 'JUMP', 60);
  await page.waitForFunction(() => (window as any).__arena.scene.fighters[0].jumpsUsed >= 1, null, { timeout: 3000 });

  await page.waitForTimeout(900);
  await hold(page, 'PUNCH', 40);
  await page.waitForFunction(() => (window as any).__arena.scene.fighters[0].comboStep >= 1, null, { timeout: 3000 });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('touch: quitting from the ✕ button returns to the pre-match screen and restores the page', async ({ page }) => {
  test.setTimeout(90_000);
  await toArena(page);
  await page.locator('.tc-quit').click();
  await expect(page.getByRole('button', { name: 'FIGHT ▸' })).toBeVisible();
  await expect(page.locator('.topbar')).toBeVisible();
  await expect(page.locator('.touch-ui')).toHaveCount(0);
});

test.describe('small phone, portrait', () => {
  const d = devices['Galaxy S9+']; // 320 px wide
  test.use({ viewport: d.viewport, userAgent: d.userAgent, deviceScaleFactor: d.deviceScaleFactor, isMobile: d.isMobile, hasTouch: d.hasTouch });
  test('every touch button fits on screen', async ({ page }) => {
    test.setTimeout(90_000);
    await toArena(page);
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll('.touch-ui button')]
        .filter((b) => {
          const r = b.getBoundingClientRect();
          return r.left < 0 || r.right > innerWidth || r.bottom > innerHeight;
        })
        .map((b) => b.getAttribute('aria-label')),
    );
    expect(clipped).toEqual([]);
  });
});
