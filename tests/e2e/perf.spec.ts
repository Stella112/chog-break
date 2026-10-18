import { expect, test } from '@playwright/test';

// §D13: Lab interactive < 3 s on a normal connection. Simulated: 10 Mbit/s down, 40 ms latency, cold cache.
test('lab is interactive in under 3 s on a ~10 Mbit/s connection', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 40,
    downloadThroughput: (10 * 1024 * 1024) / 8,
    uploadThroughput: (5 * 1024 * 1024) / 8,
  });
  const t0 = Date.now();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'ENTER THE LAB' })).toBeEnabled({ timeout: 10_000 });
  const homeReady = Date.now() - t0;
  await page.getByRole('button', { name: 'ENTER THE LAB' }).click();
  await expect(page.locator('.cell').first()).toBeVisible();
  // first thumbnails actually painted
  await page.waitForFunction(() => [...document.querySelectorAll('.cell img')].slice(0, 6).every((i) => (i as HTMLImageElement).complete), null, { timeout: 10_000 });
  const labReady = Date.now() - t0;
  console.log(`home interactive ${homeReady} ms, lab with first thumbnails ${labReady} ms`);
  expect(labReady).toBeLessThan(3000);
});
