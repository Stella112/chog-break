import { expect, test, type Page } from '@playwright/test';

// §F Phase 4: "Every gene has a visible effect". Each case sets a gene on fighter 0 via the
// ?test=1 hooks, parks an idle opponent in range, triggers the move and checks a measurable effect.

type F = { x: number; y: number; damage: number; state: string; rage: boolean; bubble: boolean; size: string; kit: { weight: number } };
type S = { fighters: F[]; entities: { projectiles: number; zones: string[]; frogs: number }; mods: { gravity: number; friction: number; kb: number } };

async function arena(page: Page, url = '/?a=18&b=66&fight=1&test=1') {
  await page.goto(url);
  await page.getByRole('button', { name: 'FIGHT ▸' }).click();
  await page.waitForFunction(() => (window as any).__arena?.state().live === true, null, { timeout: 15_000 });
}

/** Park both fighters: me at x0 facing right, foe idle at x1. */
async function setup(page: Page, kit: Record<string, unknown>, x0 = 500, x1 = 640) {
  await page.evaluate(
    ([kit, x0, x1]) => {
      const A = (window as any).__arena;
      A.idle(0, x0);
      A.idle(1, x1);
      A.setKit(0, kit);
      const S = A.scene;
      S.fighters[0].facing = 1;
      S.fighters[1].score.damage = 0;
      S.fighters[0].score.damage = 30;
      S.fighters[1].bubbleUntil = 0;
      S.fighters[1].invulnUntil = 0;
      S.fighters[0].invulnUntil = 0;
    },
    [kit, x0, x1] as const,
  );
  await page.waitForTimeout(500);
}

const state = (page: Page) => page.evaluate(() => (window as any).__arena.state() as S);
const press = (page: Page, key: string) => page.evaluate((k) => (window as any).__arena.press(0, k), key);

test.describe.configure({ mode: 'serial' });

test('Eyes specials', async ({ page }) => {
  test.setTimeout(120_000);
  await arena(page);
  const results: string[] = [];

  for (const [special, x1, expectFn] of [
    ['SPIT', 900, (s: S) => s.fighters[1]!.damage > 0],
    ['BEAM', 900, (s: S) => s.fighters[1]!.damage >= 9],
    ['CHAOS_ORB', 760, (s: S) => s.fighters[1]!.damage > 0 || s.entities.projectiles > 0],
    ['TEARS', 820, (s: S) => s.entities.zones.includes('puddle') || s.fighters[1]!.damage > 0],
    ['LEECH', 640, (s: S) => s.fighters[1]!.damage > 0 && s.fighters[0]!.damage < 30],
  ] as const) {
    await setup(page, { special }, 500, x1);
    await press(page, 'special');
    await page.waitForTimeout(special === 'TEARS' || special === 'CHAOS_ORB' ? 900 : 700);
    const s = await state(page);
    results.push(`${special}: foe ${s.fighters[1]!.damage}% me ${s.fighters[0]!.damage}% zones=${s.entities.zones.join(',')}`);
    expect(expectFn(s), `${special} ${JSON.stringify(s.fighters[1])}`).toBe(true);
  }

  await setup(page, { special: 'BLINK' }, 500, 1000);
  const before = (await state(page)).fighters[0]!.x;
  await press(page, 'special');
  await page.waitForTimeout(150);
  const after = (await state(page)).fighters[0]!.x;
  results.push(`BLINK: moved ${Math.round(after - before)} px`);
  expect(after - before).toBeGreaterThan(150);

  await setup(page, { special: 'RAGE' });
  await press(page, 'special');
  await page.waitForTimeout(150);
  expect((await state(page)).fighters[0]!.rage).toBe(true);
  results.push('RAGE: buff active');
  console.log(results.join('\n'));
});

test('Mouth close moves', async ({ page }) => {
  test.setTimeout(120_000);
  await arena(page);
  for (const [close, x1, check] of [
    ['HEADBUTT', 580, (s: S) => s.fighters[1]!.damage >= 7],
    ['PUKE', 600, (s: S) => s.fighters[1]!.damage >= 3],
    ['HONK', 600, (s: S) => s.fighters[1]!.damage >= 3],
    ['COIN_TOSS', 880, (s: S) => s.fighters[1]!.damage >= 7],
    ['DROOL', 900, (s: S) => s.entities.zones.includes('puddle')],
  ] as const) {
    await setup(page, { close }, 500, x1);
    await press(page, 'close');
    await page.waitForTimeout(close === 'COIN_TOSS' ? 1000 : 600);
    const s = await state(page);
    console.log(`${close}: foe ${s.fighters[1]!.damage}% zones=${s.entities.zones.join(',')}`);
    expect(check(s), close).toBe(true);
  }
  await setup(page, { close: 'BUBBLE' });
  await press(page, 'close');
  await page.waitForTimeout(100);
  expect((await state(page)).fighters[0]!.bubble).toBe(true);
});

test('Passives: element, trinket, affinity, head', async ({ page }) => {
  test.setTimeout(120_000);
  await arena(page);

  // TOXIC aura: damage over time to a nearby opponent
  await setup(page, { affinity: 'TOXIC' }, 600, 660);
  await page.waitForTimeout(2300);
  expect((await state(page)).fighters[1]!.damage).toBeGreaterThanOrEqual(1);

  // REGEN heals over time
  await setup(page, { affinity: 'NORMAL', trinket: 'REGEN' }, 400, 1000);
  await page.waitForTimeout(2300);
  expect((await state(page)).fighters[0]!.damage).toBeLessThan(30);

  // FWOG spawns a frog within 6 s that damages the opponent
  await setup(page, { trinket: 'FWOG' }, 500, 800);
  await page.waitForFunction(() => (window as any).__arena.state().entities.frogs > 0 || (window as any).__arena.state().fighters[1].damage > 0, null, { timeout: 8000 });

  // PUMP grows within 10 s
  await setup(page, { trinket: 'PUMP' }, 500, 1000);
  await page.waitForFunction(() => (window as any).__arena.state().fighters[0].size === 'grow', null, { timeout: 12_000 });

  // BURN: dash leaves a fire zone
  await setup(page, { trinket: 'NONE', element: 'BURN' }, 400, 1000);
  await press(page, 'dash');
  await page.waitForTimeout(100);
  expect((await state(page)).entities.zones).toContain('fire');

  // SMOKE: dash leaves smoke
  await setup(page, { element: 'SMOKE' }, 400, 1000);
  await page.evaluate(() => ((window as any).__arena.scene.fighters[0].dashReadyAt = 0));
  await press(page, 'dash');
  await page.waitForTimeout(100);
  expect((await state(page)).entities.zones).toContain('smoke');

  // FROST: punch slows the target
  await setup(page, { element: 'FROST' }, 560, 620);
  await press(page, 'punch');
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => (window as any).__arena.scene.fighters[1].slowUntil > (window as any).__arena.scene.time.now)).toBe(true);

  // SHIELD: first hit halved
  await page.evaluate(() => {
    const A = (window as any).__arena;
    A.setKit(1, { element: 'SHIELD' });
    A.scene.fighters[1].shieldReady = true;
  });
  await setup(page, { element: 'NONE', close: 'HEADBUTT' }, 500, 580);
  await press(page, 'close');
  await page.waitForTimeout(500);
  expect((await state(page)).fighters[1]!.damage).toBeCloseTo(3.5, 1);
  await page.evaluate(() => (window as any).__arena.setKit(1, { element: 'NONE' }));

  // ROYAL takes less knockback than LIGHTWEIGHT (same hit, same damage)
  const launch = async (head: string) => {
    await page.evaluate((h) => (window as any).__arena.setKit(1, { head: h, kbTaken: h === 'ROYAL' ? 0.85 : 1.1 }), head);
    await setup(page, { close: 'HEADBUTT' }, 500, 580);
    await page.evaluate(() => ((window as any).__arena.scene.fighters[1].score.damage = 80));
    await press(page, 'close');
    await page.waitForTimeout(140);
    return page.evaluate(() => Math.hypot((window as any).__arena.scene.fighters[1].body.velocity.x, (window as any).__arena.scene.fighters[1].body.velocity.y));
  };
  const royal = await launch('ROYAL');
  const light = await launch('LIGHTWEIGHT');
  console.log(`ROYAL launch ${royal.toFixed(0)} vs LIGHTWEIGHT ${light.toFixed(0)}`);
  expect(royal).toBeLessThan(light);
});

test('Body physics change movement', async ({ page }) => {
  await arena(page);
  const run = async (profile: Record<string, number>) => {
    await setup(page, { profile }, 300, 1000);
    await page.evaluate(() => {
      const A = (window as any).__arena;
      A.scene.sources[0] = { read: () => ({ left: false, right: true, down: false, jump: false, punch: false, dash: false, special: false, close: false, dashHeld: false, closeHeld: false }) };
    });
    await page.waitForTimeout(700);
    return (await state(page)).fighters[0]!.x;
  };
  const heavy = await run({ weight: 1.3, speed: 0.88, gravity: 1, jump: 1, friction: 1 });
  const light = await run({ weight: 0.8, speed: 1.15, gravity: 1, jump: 1, friction: 1 });
  console.log(`HEAVY ran to ${heavy.toFixed(0)}, LIGHT to ${light.toFixed(0)}`);
  expect(light).toBeGreaterThan(heavy);
});
