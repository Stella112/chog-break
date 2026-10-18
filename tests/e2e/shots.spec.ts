import { test } from '@playwright/test';

// Visual review helper (not an assertion test): captures full-size screenshots of the loop.
// Run with: npx playwright test tests/e2e/shots.spec.ts  → test-results/shots/*.png
test.skip(!process.env.SHOTS, 'set SHOTS=1 to capture screenshots');

test('capture screens', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const shot = (name: string) => page.screenshot({ path: `test-results/shots/${name}.png` });
  await page.goto('/?test=1');
  await page.waitForTimeout(800);
  await shot('01-home');
  await page.getByRole('button', { name: 'ENTER THE LAB' }).click();
  await page.waitForTimeout(800);
  await shot('02-lab');
  await page.goto('/?a=18&b=66&test=1');
  await page.waitForTimeout(1500);
  await shot('03-reveal-mid');
  await page.waitForTimeout(3500);
  await shot('04-reveal-done');
  await page.getByRole('button', { name: 'FIGHT ▸' }).click();
  await page.waitForTimeout(800);
  await shot('05-prematch');
  await page.getByRole('button', { name: 'FIGHT ▸' }).click();
  await page.waitForFunction(() => (window as any).__arena?.state().live === true, null, { timeout: 20_000 });
  await page.waitForTimeout(2500);
  await shot('06-arena-fight');
  await page.evaluate(() => {
    const A = (window as any).__arena;
    A.idle(1, 860);
    A.idle(0, 520);
    A.scene.fighters[0].facing = 1;
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => (window as any).__arena.press(0, 'punch'));
  await page.waitForTimeout(110);
  await shot('07-arena-punch');
  await page.evaluate(() => {
    const A = (window as any).__arena;
    A.scene.fighters[0].specialReadyAt = 0;
    A.press(0, 'special');
  });
  await page.waitForTimeout(330);
  await shot('08-arena-beam');
  await page.waitForTimeout(80);
  await shot('09-arena-beam-hit');
});
