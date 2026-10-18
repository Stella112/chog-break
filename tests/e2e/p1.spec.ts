import sharp from 'sharp';
import { expect, test, type Page } from '@playwright/test';

// §F Phase 6 (P1, game features): share card, local 2P, P1 modifiers, P1 recipe perks.

async function arena(page: Page, url: string, mode: 'bot' | '2p' = 'bot') {
  await page.goto(url);
  if (mode === '2p') await page.getByRole('radio', { name: 'LOCAL 2P' }).click();
  await page.getByRole('button', { name: 'FIGHT ▸' }).click();
  await page.waitForFunction(() => (window as any).__arena?.state().live === true, null, { timeout: 20_000 });
}

test('share card exports a valid 1200×675 PNG; Post on X opens an intent link', async ({ page }) => {
  await page.goto('/?a=18&b=66');
  await expect(page.locator('.mutant-name')).toHaveText('KING BEAM', { timeout: 10_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'DOWNLOAD PNG' }).click()]);
  expect(download.suggestedFilename()).toBe('chogbreak-18x66.png');
  const path = await download.path();
  const meta = await sharp(path!).metadata();
  expect([meta.format, meta.width, meta.height]).toEqual(['png', 1200, 675]);
  const href = await page.getByRole('link', { name: 'POST ON X' }).getAttribute('href');
  expect(href).toMatch(/^https:\/\/twitter\.com\/intent\/tweet\?text=.*KING%20BEAM.*&url=.*a%3D18%26b%3D66/);
});

test('local 2P: both control sets work at the same time (real key events)', async ({ page }) => {
  await arena(page, '/?a=18&b=66&fight=1&test=1', '2p');
  const before = await page.evaluate(() => (window as any).__arena.state().fighters.map((f: any) => f.x));
  await page.keyboard.down('d');
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(500);
  await page.keyboard.up('d');
  await page.keyboard.up('ArrowLeft');
  const after = await page.evaluate(() => (window as any).__arena.state().fighters.map((f: any) => f.x));
  console.log(`P1 moved ${Math.round(after[0] - before[0])} px right, P2 moved ${Math.round(before[1] - after[1])} px left`);
  expect(after[0] - before[0]).toBeGreaterThan(80);
  expect(before[1] - after[1]).toBeGreaterThan(80);
  // A tap shorter than one frame must still register (keydown is queued).
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => (window as any).__arena.scene.fighters[1].grounded)).toBe(false);
});

test('P1 modifiers: OVERCLOCK, BOUNCY, METEOR, COIN RAIN, SHRINKING, GLITCH', async ({ page }) => {
  test.setTimeout(180_000);
  await arena(page, '/?a=18&b=66&fight=1&test=1&mods=OVERCLOCK,BOUNCY_FLOOR');
  expect(await page.evaluate(() => (window as any).__arena.state().mods)).toMatchObject({ speed: 1.2, bounce: true });
  // BOUNCY: a hard landing bounces back up
  await page.evaluate(() => {
    const A = (window as any).__arena;
    A.idle(0, 640);
    A.idle(1, 1000);
    A.scene.fighters[0].body.reset(640, 200);
    A.scene.fighters[0].body.setVelocity(0, 900);
  });
  await page.waitForFunction(() => (window as any).__arena.scene.fighters[0].body.velocity.y < -200, null, { timeout: 3000 });

  await arena(page, '/?a=18&b=66&fight=1&test=1&mods=METEOR_SHOWER,COIN_RAIN');
  await page.evaluate(() => {
    const A = (window as any).__arena;
    A.idle(0, 640);
    A.idle(1, 1000);
  });
  await page.waitForFunction(() => (window as any).__arena.state().entities.zones.includes('meteor'), null, { timeout: 8000 });
  const meteor = await page.evaluate(() => {
    const z = (window as any).__arena.scene.zones.find((z: any) => z.o.kind === 'meteor');
    return { cx: z.rect.centerX, armIn: z.activeAt - (window as any).__arena.scene.time.now };
  });
  expect(meteor.armIn).toBeGreaterThan(600); // red target telegraph before impact
  await page.evaluate((x) => (window as any).__arena.idle(0, x), meteor.cx);
  // ≥ 4: this fighter's SHIELD aura halves the first hit of each life
  await page.waitForFunction(() => (window as any).__arena.scene.fighters[0].score.damage >= 4, null, { timeout: 5000 });
  await page.waitForFunction(() => (window as any).__arena.state().coins > 0, null, { timeout: 10_000 });

  await arena(page, '/?a=18&b=66&fight=1&test=1&mods=SHRINKING_STAGE');
  await page.evaluate(() => ((window as any).__arena.scene.elapsedMs = 74_000));
  await page.waitForFunction(() => (window as any).__arena.state().edges.left > 300, null, { timeout: 5000 });
  const edges = await page.evaluate(() => (window as any).__arena.state().edges);
  console.log(`SHRINKING STAGE edges ${Math.round(edges.left)}–${Math.round(edges.right)}`);

  await arena(page, '/?a=18&b=66&fight=1&test=1&mods=GLITCH');
  await page.waitForFunction(() => (window as any).__arena.state().active.length >= 2, null, { timeout: 12_000 });
  console.log('GLITCH active:', await page.evaluate(() => (window as any).__arena.state().active.join(',')));
});

test('P1 recipe perks: LASER SHOW, GOLDEN BULL, BEAR MARKET', async ({ page }) => {
  await arena(page, '/?a=18&b=66&fight=1&test=1');
  const setup = (kit: Record<string, unknown>, x0: number, x1: number) =>
    page.evaluate(
      ([kit, x0, x1]) => {
        const A = (window as any).__arena;
        A.idle(0, x0);
        A.idle(1, x1);
        A.setKit(0, kit);
        for (const f of A.scene.fighters) {
          f.score.damage = 0;
          f.state = 'free';
          f.action = null;
          f.invulnUntil = 0;
        }
        A.scene.fighters[0].facing = 1;
      },
      [kit, x0, x1] as const,
    );

  // LASER SHOW fires two beams (both colours)
  await setup({ special: 'BEAM', recipe: 'LASER_SHOW', beamColor: 0xb35cff, beamColor2: 0xff7a1a }, 500, 1000);
  await page.waitForTimeout(400);
  const beams = await page.evaluate(async () => {
    const S = (window as any).__arena.scene;
    const colours: number[] = [];
    const orig = Object.getPrototypeOf(S).beam;
    S.beam = function (o: any, opts: any) {
      colours.push(opts.color);
      return orig.call(S, o, opts);
    };
    (window as any).__arena.press(0, 'special');
    await new Promise((r) => setTimeout(r, 900));
    delete S.beam;
    return colours;
  });
  expect(beams).toEqual([0xb35cff, 0xff7a1a]);

  // GOLDEN BULL: a hit during the dash causes no knockback
  await setup({ special: 'SPIT', recipe: 'GOLDEN_BULL' }, 500, 1000);
  await page.waitForTimeout(400);
  const armored = await page.evaluate(async () => {
    const A = (window as any).__arena;
    const [me, foe] = A.scene.fighters;
    A.press(0, 'dash');
    await new Promise((r) => setTimeout(r, 40));
    A.scene.hit(foe, me, { damage: 8, base: 400, scaling: 8, angleDeg: 40, hitstunMs: 300, hitstopMs: 0, kind: 'melee' }, -1);
    return { state: me.state, armor: me.hasArmor(A.scene.time.now) };
  });
  expect(armored).toEqual({ state: 'dash', armor: true });

  // BEAR MARKET: +5% damage while the attacker is above 100%
  await setup({ recipe: 'BEAR_MARKET' }, 500, 1000);
  const dealt = await page.evaluate(() => {
    const A = (window as any).__arena;
    const [me, foe] = A.scene.fighters;
    me.score.damage = 120;
    const spec = { damage: 10, base: 0, scaling: 0, angleDeg: 0, hitstunMs: 0, hitstopMs: 0, kind: 'melee', noKnockback: true };
    return A.scene.hit(me, foe, spec, 1);
  });
  expect(dealt).toBeCloseTo(10.5, 1);
});

test('remaining P1 recipe perks: SKULL & BONES, SHARK WEEK, HONK LORD, DOUBLE RAINBOW', async ({ page }) => {
  test.setTimeout(120_000);
  await arena(page, '/?a=18&b=66&fight=1&test=1');
  const reset = (kit: Record<string, unknown>, x0: number, x1: number) =>
    page.evaluate(
      ([kit, x0, x1]) => {
        const A = (window as any).__arena;
        A.idle(0, x0);
        A.idle(1, x1);
        A.setKit(0, kit);
        for (const f of A.scene.fighters) {
          f.score.damage = 0;
          f.state = 'free';
          f.action = null;
          f.invulnUntil = 0;
          f.bubbleUntil = 0;
          f.body.setVelocity(0, 0);
        }
        A.scene.fighters[0].facing = 1;
        for (const s of A.scene.sources) s.graceUntil = 0;
      },
      [kit, x0, x1] as const,
    );

  // SKULL & BONES: the combo ender launches nearly straight up (80°) instead of 38°
  const ender = async (recipe: string | null) => {
    await reset({ recipe }, 560, 620);
    await page.waitForTimeout(300);
    return page.evaluate(() => {
      const A = (window as any).__arena;
      const [me, foe] = A.scene.fighters;
      me.attackStart = A.scene.time.now - 100;
      me.attackId = 'punch3';
      me.state = 'attack';
      me.attackHit = false;
      me.tryMelee({ damage: 8, base: 360, scaling: 8, angleDeg: 38, startupMs: 90, activeMs: 90, recoveryMs: 240, box: { x: 58, y: -10, w: 70, h: 52 }, hitstunMs: 380, hitstopMs: 0 }, foe, true);
      return Math.atan2(-foe.body.velocity.y, Math.abs(foe.body.velocity.x)) * (180 / Math.PI);
    });
  };
  const plain = await ender(null);
  const skull = await ender('SKULL_AND_BONES');
  console.log(`combo-ender launch angle: plain ${plain.toFixed(0)}°, SKULL & BONES ${skull.toFixed(0)}°`);
  expect(skull).toBeGreaterThan(plain + 25);

  // SHARK WEEK: the drool puddle also bites
  await reset({ close: 'DROOL', recipe: 'SHARK_WEEK' }, 500, 1000);
  await page.waitForTimeout(300);
  await page.evaluate(() => (window as any).__arena.press(0, 'close'));
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => (window as any).__arena.state().entities.zones)).toEqual(expect.arrayContaining(['puddle', 'bite']));

  // HONK LORD: honk stun lasts 0.2 s longer
  const honkStun = async (recipe: string | null) => {
    await reset({ close: 'HONK', recipe }, 560, 640);
    await page.waitForTimeout(300);
    await page.evaluate(() => (window as any).__arena.press(0, 'close'));
    await page.waitForTimeout(60);
    return page.evaluate(() => (window as any).__arena.scene.fighters[1].stateUntil - (window as any).__arena.scene.time.now);
  };
  const honk = await honkStun(null);
  const lord = await honkStun('HONK_LORD');
  console.log(`honk stun left: plain ${Math.round(honk)} ms, HONK LORD ${Math.round(lord)} ms`);
  expect(lord - honk).toBeGreaterThan(120);

  // DOUBLE RAINBOW: the puke cone reaches further (hits at 190 px, plain does not)
  const pukeAt = async (recipe: string | null) => {
    await reset({ close: 'PUKE', recipe }, 500, 690);
    await page.waitForTimeout(300);
    await page.evaluate(() => (window as any).__arena.press(0, 'close'));
    await page.waitForTimeout(600);
    return page.evaluate(() => (window as any).__arena.scene.fighters[1].score.damage);
  };
  const shortPuke = await pukeAt(null);
  const longPuke = await pukeAt('DOUBLE_RAINBOW');
  console.log(`puke at 190 px: plain ${shortPuke}%, DOUBLE RAINBOW ${longPuke}%`);
  expect(longPuke).toBeGreaterThan(shortPuke);
});
