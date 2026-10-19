import { expect, test, type Page } from '@playwright/test';

// §F Phase 3 acceptance (automatable parts). Uses ?test=1 hooks exposed by ArenaScene.
type ArenaHooks = {
  forceKO(i: 0 | 1): void;
  launch(i: 0 | 1, x: number, y: number, vx: number, vy: number): void;
  idle(i: 0 | 1, x?: number): void;
  state(): { live: boolean; ended: boolean; fighters: { x: number; y: number; lives: number; damage: number; state: string }[] };
  fps(): number;
};
declare global {
  interface Window {
    __arena?: ArenaHooks;
  }
}

async function toArena(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?a=18&b=66&fight=1&test=1');
  await page.getByRole('button', { name: 'FIGHT ▸' }).click();
  await page.waitForFunction(() => window.__arena?.state().live === true, null, { timeout: 15_000 });
}

async function koTwice(page: Page, who: 0 | 1) {
  for (let k = 0; k < 2; k++) {
    await page.waitForFunction((i) => window.__arena!.state().fighters[i]!.state !== 'ko', who);
    await page.evaluate((i) => window.__arena!.forceKO(i), who);
    await page.waitForFunction(([i, l]) => window.__arena!.state().fighters[i]!.lives === l, [who, 1 - k] as const);
  }
}

test('full match → results; lives drop exactly once per KO', async ({ page }) => {
  const errors: string[] = [];
  await toArena(page, errors);
  await page.evaluate(() => window.__arena!.idle(0));
  await page.evaluate(() => window.__arena!.forceKO(1));
  await page.waitForTimeout(400); // lingering outside the zone must not cost a second life
  expect(await page.evaluate(() => window.__arena!.state().fighters[1]!.lives)).toBe(1);
  await page.waitForFunction(() => window.__arena!.state().fighters[1]!.state !== 'ko');
  await page.evaluate(() => window.__arena!.forceKO(1));
  await expect(page.getByText('EXPERIMENT SURVIVED')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('KING BEAM wins')).toBeVisible();
  expect(errors).toEqual([]);
});

test('rematch ×10 without leaks, stale state or errors', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  await toArena(page, errors);
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.__arena!.idle(0));
    await koTwice(page, 1);
    await expect(page.getByRole('button', { name: 'REMATCH' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'REMATCH' }).click();
    await page.waitForFunction(() => window.__arena?.state().live === true && !window.__arena.state().ended, null, { timeout: 15_000 });
    const s = await page.evaluate(() => window.__arena!.state());
    expect(s.fighters.map((f) => f.lives)).toEqual([2, 2]);
    expect(s.fighters.map((f) => f.damage)).toEqual([0, 0]);
    // one Phaser canvas and one 3D stage canvas per match: nothing left over from previous matches
    expect(await page.locator('.arena-host canvas').count()).toBe(2);
    expect(await page.locator('canvas.arena-3d').count()).toBe(1);
  }
  expect(errors).toEqual([]);
});

test('bot recovers to stage in ≥ 9/10 scripted off-stage launches', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  await toArena(page, errors);
  // Normal bot = fighter 1. Park the player in the middle, idle.
  const launches: [number, number, number, number][] = [
    [1000, 480, 700, -300], [1040, 500, 600, -150], [990, 460, 800, -450], [1020, 520, 500, 0], [1030, 440, 650, -500],
    [280, 480, -700, -300], [240, 500, -600, -150], [290, 460, -800, -450], [260, 520, -500, 0], [250, 440, -650, -500],
  ];
  let ok = 0;
  for (const [x, y, vx, vy] of launches) {
    await page.evaluate(() => window.__arena!.idle(0, 640));
    const before = await page.evaluate(() => window.__arena!.state().fighters[1]!.lives);
    if (before === 0) break;
    await page.evaluate(([a, b, c, d]) => window.__arena!.launch(1, a!, b!, c!, d!), [x, y, vx, vy]);
    await page.waitForTimeout(3500);
    const s = await page.evaluate(() => window.__arena!.state());
    const bot = s.fighters[1]!;
    const onStage = bot.lives === before && bot.x > 240 && bot.x < 1040 && bot.y < 570;
    if (onStage) ok++;
    if (s.ended) break;
  }
  console.log(`bot recovered ${ok}/10`);
  expect(ok).toBeGreaterThanOrEqual(9);
  expect(errors).toEqual([]);
});

test('arena frame rate', async ({ page }) => {
  const errors: string[] = [];
  await toArena(page, errors);
  await page.waitForTimeout(5000);
  const fps = await page.evaluate(() => window.__arena!.fps());
  console.log(`arena fps: ${fps.toFixed(1)}`);
  expect(fps).toBeGreaterThan(50);
});

test('resting fighters never sink through the floor at a low frame rate', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  await toArena(page, errors);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
  await page.evaluate(() => {
    window.__arena!.idle(0, 300);
    window.__arena!.idle(1, 1000);
  });
  await page.waitForTimeout(10_000);
  const s = await page.evaluate(() => window.__arena!.state());
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  console.log(`after 10 s throttled: lives ${s.fighters.map((f) => f.lives).join('/')}, y ${s.fighters.map((f) => Math.round(f.y)).join('/')}`);
  expect(s.fighters.map((f) => f.lives)).toEqual([2, 2]);
  expect(errors).toEqual([]);
});

test('2.5D: the 3D stage sits exactly under the Phaser canvas', async ({ page }) => {
  const errors: string[] = [];
  await toArena(page, errors);
  const canvases = page.locator('.arena-host canvas');
  await expect(canvases).toHaveCount(2);
  const three = await page.locator('canvas.arena-3d').boundingBox();
  const phaser = await canvases.nth(1).boundingBox();
  for (const k of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(three![k] - phaser![k]), k).toBeLessThan(1.5);
  expect(errors).toEqual([]);
});

test('2.5D fallback: ?arena=2d runs the flat 2D arena', async ({ page }) => {
  await page.goto('/?a=18&b=66&fight=1&test=1&arena=2d');
  await page.getByRole('button', { name: 'FIGHT ▸' }).click();
  await page.waitForFunction(() => window.__arena?.state().live === true, null, { timeout: 15_000 });
  await expect(page.locator('canvas.arena-3d')).toHaveCount(0);
  await expect(page.locator('.arena-host canvas')).toHaveCount(1);
});
