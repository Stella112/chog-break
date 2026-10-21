import { expect, test, type Page } from '@playwright/test';

// §F Phase 5: critical guest flow against the production build, plus failure cases.

function trackErrors(page: Page, ignore: RegExp[] = []) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !ignore.some((r) => r.test(m.text()))) errors.push(m.text());
  });
  return errors;
}

async function pick(page: Page, query: string, slot: 'A' | 'B') {
  await page.getByPlaceholder('Number or trait (crown, laser…)').fill(query);
  await page.locator('.cell').first().click();
  await page.getByRole('button', { name: `LOAD INTO ${slot}` }).click();
}

test('critical flow: home → lab → A → B → splice → reveal → fight → results → notebook', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto('/?test=1');
  await page.getByRole('button', { name: 'ENTER THE LAB' }).click();
  await pick(page, '18', 'A');
  await pick(page, '66', 'B');
  await page.getByRole('button', { name: 'SPLICE', exact: true }).click();
  await expect(page.locator('.mutant-name')).toHaveText('KING BEAM', { timeout: 10_000 });
  await page.getByRole('button', { name: 'FIGHT ▸' }).click();
  await expect(page.getByText("TODAY'S LAB OPPONENT")).toBeVisible();
  await page.getByRole('button', { name: 'FIGHT ▸' }).click();
  await page.waitForFunction(() => (window as any).__arena?.state().live === true, null, {
    timeout: 20_000,
  });
  // test hook may force a KO (§F Phase 5)
  for (let k = 0; k < 2; k++) {
    await page.waitForFunction(() => (window as any).__arena.state().fighters[1].state !== 'ko');
    await page.evaluate(() => (window as any).__arena.forceKO(1));
    await page.waitForTimeout(200);
  }
  await expect(page.getByText('EXPERIMENT SURVIVED')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /^NOTEBOOK/ }).click();
  await expect(page.getByText('KING BEAM').first()).toBeVisible();
  await expect(page.getByText(/W 1 – L 0/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/W 1 – L 0/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('malformed metadata record is dropped, app still works', async ({ page }) => {
  const errors = trackErrors(page);
  await page.route('**/data/chogs.min.json', async (route) => {
    const res = await route.fetch();
    const data = await res.json();
    data.push({ tokenId: 'broken', displayName: null });
    data[5] = { ...data[5], traits: undefined };
    await route.fulfill({ response: res, json: data });
  });
  await page.goto('/play/');
  await page.getByRole('button', { name: 'ENTER THE LAB' }).click();
  await expect(page.getByText('1968 CHOGS')).toBeVisible();
  await page.goto('/?a=18&b=66');
  await expect(page.locator('.mutant-name')).toHaveText('KING BEAM', { timeout: 10_000 });
  expect(errors).toEqual([]);
});

test('missing image shows the fallback, no crash', async ({ page }) => {
  const errors = trackErrors(page, [/Failed to load resource/]);
  await page.route('**/chogs/18.webp', (r) => r.fulfill({ status: 404, body: '' }));
  await page.route('**/chogs/thumbs/18.webp', (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto('/?a=18&b=66');
  await expect(page.locator('.mutant-name')).toHaveText('KING BEAM', { timeout: 10_000 });
  await page.goto('/play/');
  await page.getByRole('button', { name: 'ENTER THE LAB' }).click();
  await page.getByPlaceholder('Number or trait (crown, laser…)').fill('18');
  await expect(page.locator('.cell .art-offline')).toBeVisible();
  expect(errors).toEqual([]);
});

test('RPC offline / no external network: guest flow still works', async ({ page }) => {
  const errors = trackErrors(page, [/Failed to load resource/, /ERR_/]);
  let rpcCalls = 0;
  await page.route(/^https?:\/\/(?!localhost)/, (route) => {
    if (route.request().url().includes('monad')) rpcCalls++;
    return route.abort();
  });
  await page.goto('/?a=18&b=66&fight=1&test=1');
  await page.getByRole('button', { name: 'FIGHT ▸' }).click();
  await page.waitForFunction(() => (window as any).__arena?.state().live === true, null, {
    timeout: 20_000,
  });
  expect(rpcCalls).toBe(0);
  expect(errors).toEqual([]);
});

test('archive failure shows a recoverable error', async ({ page }) => {
  let fail = true;
  await page.route('**/data/chogs.min.json', (route) =>
    fail ? route.fulfill({ status: 500, body: 'x' }) : route.continue(),
  );
  await page.goto('/play/');
  await expect(page.getByText(/failed to load/i)).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'RETRY' }).click();
  await expect(page.getByRole('button', { name: 'ENTER THE LAB' })).toBeEnabled();
});

test('375px: lab, reveal and pre-match fit without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const url of ['/', '/?a=18&b=66', '/?a=18&b=66&fight=1']) {
    await page.goto(url);
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
  // Reveal stacks on phones: the info column sits below the rig, not squeezed beside it.
  await page.goto('/?a=18&b=66');
  const stage = await page.locator('.reveal-stage').boundingBox();
  const info = await page.locator('.reveal-info').boundingBox();
  expect(stage!.width).toBeGreaterThan(300);
  expect(info!.y).toBeGreaterThanOrEqual(stage!.y + stage!.height - 1);
  await expect(page.getByText('Best on desktop with a keyboard.')).toHaveCount(0); // desktop UA here; touch shows it
});

test('reduced motion: reveal is a short crossfade with no flash or lightning', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/?a=18&b=66');
  await expect(page.locator('.mutant-name')).toHaveText('KING BEAM', { timeout: 2500 });
  expect(await page.locator('.reveal-flash').count()).toBe(0);
  expect(await page.locator('.arcs').count()).toBe(0);
  await ctx.close();
});

test('music toggle persists across reloads and SOUND OFF disables it', async ({ page }) => {
  await page.goto('/play/');
  const musicBtn = page.getByRole('button', { name: 'Mute music' });
  await expect(musicBtn).toHaveText('MUSIC ON');
  await musicBtn.click();
  await expect(musicBtn).toHaveText('MUSIC OFF');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mute music' })).toHaveText('MUSIC OFF');
  await page.getByRole('button', { name: 'Mute music' }).click();
  await page.getByRole('button', { name: 'Mute sound' }).click();
  await expect(page.getByRole('button', { name: 'Mute music' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Mute music' })).toHaveText('MUSIC OFF');
});
