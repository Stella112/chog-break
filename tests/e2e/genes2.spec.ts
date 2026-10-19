import { expect, test, type Page } from '@playwright/test';

// §F Phase 4, part 2: head recoveries/guard, remaining passives, UNDEAD, P0 recipe perks, P0 modifiers.

// Gameplay-rule checks run on the 2D arena: they read results after real-time waits, and the 3D layer's
// extra per-frame work made those timings noisy. Rules are identical; the 3D visuals have their own tests.
async function arena(page: Page, url = '/?a=18&b=66&fight=1&test=1&arena=2d') {
  await page.goto(url);
  await page.getByRole('button', { name: 'FIGHT ▸' }).click();
  await page.waitForFunction(() => (window as any).__arena?.state().live === true, null, {
    timeout: 15_000,
  });
  // The default opponent is seeded by the UTC date; neutralise its element so gene checks don't depend on the day.
  await page.evaluate(() => (window as any).__arena.setKit(1, { element: 'NONE' }));
}

async function setup(
  page: Page,
  kit: Record<string, unknown>,
  x0 = 500,
  x1 = 640,
  foeKit: Record<string, unknown> = {},
) {
  await page.evaluate(
    ([kit, x0, x1, foeKit]) => {
      const A = (window as any).__arena;
      A.idle(0, x0);
      A.idle(1, x1);
      A.setKit(0, kit);
      A.setKit(1, foeKit);
      const S = A.scene;
      S.fighters[0].facing = 1;
      for (const f of S.fighters) {
        f.score.damage = 0;
        f.invulnUntil = 0;
        f.bubbleUntil = 0;
        f.state = 'free';
        f.action = null;
        f.stateUntil = 0;
        f.body.setVelocity(0, 0);
        f.body.setAllowGravity(true);
      }
    },
    [kit, x0, x1, foeKit] as const,
  );
  await page.waitForTimeout(500);
}

const ev = <T>(page: Page, fn: () => T) => page.evaluate(fn);
const press = (page: Page, key: string, i = 0) =>
  page.evaluate(([k, i]) => (window as any).__arena.press(i, k), [key, i] as const);
const S = () => (window as any).__arena.scene;

test.describe.configure({ mode: 'serial' });

test('Head genes: WARP, HORNS recoveries; GUARD blocks', async ({ page }) => {
  test.setTimeout(120_000);
  await arena(page);

  // WARP: recovery teleports (≥120 px up instantly)
  await setup(page, { head: 'WARP' }, 640, 1000);
  await page.evaluate(() => {
    const f = (window as any).__arena.scene.fighters[0];
    f.body.reset(640, 300);
    f.jumpsUsed = 2;
    f.recoveryUsed = false;
  });
  const y0 = await page.evaluate(() => (window as any).__arena.scene.fighters[0].y);
  await page.evaluate(() => {
    const A = (window as any).__arena;
    const src = A.scene.sources[0];
    A.scene.sources[0] = {
      read: () => (
        (A.scene.sources[0] = src),
        {
          left: false,
          right: true,
          down: false,
          jump: true,
          punch: false,
          dash: false,
          special: false,
          close: false,
          dashHeld: false,
          closeHeld: false,
        }
      ),
    };
  });
  await page.waitForTimeout(60);
  const y1 = await page.evaluate(() => (window as any).__arena.scene.fighters[0].y);
  console.log(`WARP moved ${Math.round(y0 - y1)} px up`);
  expect(y0 - y1).toBeGreaterThan(120);

  // HORNS: recovery charge hits an opponent above
  await setup(page, { head: 'HORNS' }, 640, 1000);
  await page.evaluate(() => {
    const [f, foe] = (window as any).__arena.scene.fighters;
    f.body.reset(640, 420);
    f.jumpsUsed = 2;
    f.recoveryUsed = false;
    foe.body.reset(640, 340);
    foe.body.setAllowGravity(false);
    const A = (window as any).__arena;
    const src = A.scene.sources[0];
    A.scene.sources[0] = {
      read: () => (
        (A.scene.sources[0] = src),
        {
          left: false,
          right: false,
          down: false,
          jump: true,
          punch: false,
          dash: false,
          special: false,
          close: false,
          dashHeld: false,
          closeHeld: false,
        }
      ),
    };
  });
  await page.waitForTimeout(350);
  const hornDmg = await page.evaluate(() => (window as any).__arena.scene.fighters[1].score.damage);
  await page.evaluate(() => (window as any).__arena.scene.fighters[1].body.setAllowGravity(true));
  console.log(`HORNS dealt ${hornDmg}%`);
  expect(hornDmg).toBeGreaterThanOrEqual(6);

  // GUARD: holding K on the ground blocks 70% of a headbutt
  await setup(page, { head: 'STEADY', close: 'HEADBUTT' }, 500, 580, { head: 'GUARD' });
  await page.evaluate(() => {
    const A = (window as any).__arena;
    A.scene.fighters[1].facing = -1;
    A.scene.sources[1] = {
      read: () => ({
        left: false,
        right: false,
        down: false,
        jump: false,
        punch: false,
        dash: false,
        special: false,
        close: false,
        dashHeld: true,
        closeHeld: false,
      }),
    };
  });
  await page.waitForTimeout(300);
  console.log(
    'guard pre',
    JSON.stringify(
      await page.evaluate(() => {
        const f = (window as any).__arena.scene.fighters[1];
        return {
          b: f.blocking,
          st: f.state,
          g: f.grounded,
          y: Math.round(f.y),
          vy: Math.round(f.body.velocity.y),
          grav: f.body.allowGravity,
          bd: f.body.blocked.down,
          td: f.body.touching.down,
        };
      }),
    ),
  );
  await press(page, 'close');
  await page.waitForTimeout(500);
  const guarded = await page.evaluate(() => (window as any).__arena.scene.fighters[1].score.damage);
  console.log(`GUARD took ${guarded}% of a 7% headbutt`);
  expect(guarded).toBeCloseTo(2.1, 1);
});

test('More passives: GUST, SHOCK, DUMP, SHIV, BLOOM, UNDEAD', async ({ page }) => {
  test.setTimeout(150_000);
  await arena(page);

  // GUST: dash pushes a nearby opponent
  await setup(page, { element: 'GUST' }, 500, 600);
  await press(page, 'dash');
  await page.waitForTimeout(40);
  const pushed = await page.evaluate(() =>
    Math.abs((window as any).__arena.scene.fighters[1].body.velocity.x),
  );
  console.log(`GUST push ${Math.round(pushed)} px/s`);
  expect(pushed).toBeGreaterThan(150); // 520 px/s at launch, minus ground friction before we sample

  // SHIV: punches deal +15% (3 → 3.45 → 3.5 after rounding)
  await setup(page, { element: 'NONE', trinket: 'SHIV' }, 560, 620);
  await press(page, 'punch');
  await page.waitForTimeout(300);
  const shiv = await page.evaluate(() => (window as any).__arena.scene.fighters[1].score.damage);
  console.log(`SHIV punch ${shiv}%`);
  expect(shiv).toBeCloseTo(3.5, 1);

  // SHOCK: third punch adds 200 ms of stun compared with no element
  const enderStun = async (element: string) => {
    await setup(page, { element, trinket: 'NONE' }, 560, 620);
    const t = await page.evaluate(async (el) => {
      const sc = (window as any).__arena.scene;
      const [f, foe] = sc.fighters;
      const spec = {
        damage: 8,
        base: 360,
        scaling: 8,
        angleDeg: 38,
        hitstunMs: 380,
        hitstopMs: 0,
        kind: 'melee',
        comboEnder: true,
      };
      f.kit.element = el;
      sc.hit(f, foe, spec, 1);
      return foe.stateUntil - sc.time.now;
    }, element);
    return t;
  };
  const plain = await enderStun('NONE');
  const shock = await enderStun('SHOCK');
  console.log(`combo-ender stun: plain ${Math.round(plain)} ms, SHOCK ${Math.round(shock)} ms`);
  expect(shock - plain).toBeGreaterThan(150);

  // BLOOM heals over time
  await setup(page, { element: 'BLOOM' }, 400, 1000);
  await page.evaluate(() => ((window as any).__arena.scene.fighters[0].score.damage = 30));
  // heals 1% every 3 s (Phase 6 tuning)
  await page.waitForFunction(
    () => (window as any).__arena.scene.fighters[0].score.damage < 30,
    null,
    { timeout: 5000 },
  );

  // DUMP shrinks within 10 s
  await setup(page, { element: 'NONE', trinket: 'DUMP' }, 400, 1000);
  await page.waitForFunction(
    () => (window as any).__arena.state().fighters[0].size === 'shrink',
    null,
    { timeout: 12_000 },
  );

  // UNDEAD: first blast-zone exit revives at 60% without losing a life
  await setup(page, { trinket: 'NONE', affinity: 'UNDEAD' }, 400, 1000);
  await page.evaluate(() => (window as any).__arena.forceKO(0));
  await page.waitForTimeout(300);
  const undead = await page.evaluate(() => (window as any).__arena.state().fighters[0]);
  console.log(`UNDEAD after KO: lives ${undead.lives}, damage ${undead.damage}`);
  expect(undead.lives).toBe(2);
  expect(undead.damage).toBe(90);
  await page.evaluate(() => (window as any).__arena.forceKO(0));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__arena.state().fighters[0].lives)).toBe(1);
});

test('P0 recipe perks', async ({ page }) => {
  test.setTimeout(150_000);
  await arena(page);

  // KING BEAM pierces a BUBBLE shield; a normal beam does not
  const beamThroughBubble = async (recipe: string | undefined) => {
    await setup(page, { special: 'BEAM', recipe }, 500, 900);
    await page.evaluate(
      () =>
        ((window as any).__arena.scene.fighters[1].bubbleUntil =
          (window as any).__arena.scene.time.now + 5000),
    );
    await press(page, 'special');
    await page.waitForTimeout(700);
    // a hit may land a little later when frames are slow; give it up to 1 s more
    await page.waitForFunction(() => (window as any).__arena.scene.fighters[1].score.damage > 0, null, { timeout: 1000 }).catch(() => {});
    return page.evaluate(() => (window as any).__arena.scene.fighters[1].score.damage);
  };
  const normal = await beamThroughBubble(undefined);
  const king = await beamThroughBubble('KING_BEAM');
  console.log(`beam vs bubble: normal ${normal}%, KING BEAM ${king}%`);
  expect(normal).toBe(0);
  expect(king).toBeGreaterThanOrEqual(9);

  // WILDFIRE: beam leaves a fire trail
  await setup(page, { special: 'BEAM', recipe: 'WILDFIRE' }, 500, 900);
  await press(page, 'special');
  await page.waitForTimeout(600);
  const zones = await page.evaluate(() => (window as any).__arena.state().entities.zones);
  expect(zones).toContain('fire');

  // ESCAPE VELOCITY: a third jump before recovery
  await setup(page, { recipe: 'ESCAPE_VELOCITY', maxJumps: 3, special: 'SPIT' }, 640, 1000);
  const jumps = await page.evaluate(async () => {
    const A = (window as any).__arena;
    const f = A.scene.fighters[0];
    const tap = () => {
      const src = A.scene.sources[0];
      A.scene.sources[0] = {
        read: () => (
          (A.scene.sources[0] = src),
          {
            left: false,
            right: false,
            down: false,
            jump: true,
            punch: false,
            dash: false,
            special: false,
            close: false,
            dashHeld: false,
            closeHeld: false,
          }
        ),
      };
    };
    for (let i = 0; i < 3; i++) {
      tap();
      await new Promise((r) => setTimeout(r, 200));
    }
    return { jumpsUsed: f.jumpsUsed, recoveryUsed: f.recoveryUsed };
  });
  expect(jumps).toEqual({ jumpsUsed: 3, recoveryUsed: false });

  // ARCHMAGE: warp recovery leaves a rune
  await setup(page, { recipe: 'ARCHMAGE', head: 'WARP', maxJumps: 2 }, 640, 1000);
  await page.evaluate(() => {
    const A = (window as any).__arena;
    const f = A.scene.fighters[0];
    f.body.reset(640, 300);
    f.jumpsUsed = 2;
    f.recoveryUsed = false;
    const src = A.scene.sources[0];
    A.scene.sources[0] = {
      read: () => (
        (A.scene.sources[0] = src),
        {
          left: false,
          right: true,
          down: false,
          jump: true,
          punch: false,
          dash: false,
          special: false,
          close: false,
          dashHeld: false,
          closeHeld: false,
        }
      ),
    };
  });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).__arena.state().entities.zones)).toContain(
    'rune',
  );

  // THE NAKED KING: hold I for 1 s → super armor (no knockback)
  await setup(page, { recipe: 'THE_NAKED_KING', head: 'ROYAL', close: 'HEADBUTT' }, 500, 1000);
  await page.evaluate(() => {
    const A = (window as any).__arena;
    A.scene.sources[0] = {
      read: () => ({
        left: false,
        right: false,
        down: false,
        jump: false,
        punch: false,
        dash: false,
        special: false,
        close: false,
        dashHeld: false,
        closeHeld: true,
      }),
    };
  });
  await page.waitForTimeout(1200);
  expect(
    await page.evaluate(
      () =>
        (window as any).__arena.scene.fighters[0].superArmorUntil >
        (window as any).__arena.scene.time.now,
    ),
  ).toBe(true);

  // FWOG LORD: two frogs
  await setup(page, { recipe: 'FWOG_LORD', trinket: 'FWOG' }, 400, 1100);
  await page.evaluate(
    () =>
      ((window as any).__arena.scene.sources[0] = {
        read: () => ({
          left: false,
          right: false,
          down: false,
          jump: false,
          punch: false,
          dash: false,
          special: false,
          close: false,
          dashHeld: false,
          closeHeld: false,
        }),
      }),
  );
  await page.waitForFunction(() => (window as any).__arena.state().entities.frogs >= 2, null, {
    timeout: 9000,
  });

  // VOLATILITY: grows or shrinks within 5 s
  await setup(page, { recipe: 'VOLATILITY', trinket: 'PUMP' }, 400, 1100);
  await page.waitForFunction(
    () => (window as any).__arena.state().fighters[0].size !== 'none',
    null,
    { timeout: 7000 },
  );

  // NUCLEAR UNDEAD: revive bursts the nearby opponent
  await setup(page, { recipe: 'NUCLEAR_UNDEAD', affinity: 'UNDEAD', trinket: 'NONE' }, 640, 700);
  await page.evaluate(() => {
    const sc = (window as any).__arena.scene;
    sc.fighters[0].undeadReady = true;
    sc.fighters[0].body.reset(700, 940);
  });
  await page.waitForFunction(() => (window as any).__arena.scene.fighters[1].score.damage >= 8, null, { timeout: 2000 }).catch(() => {});
  const burst = await page.evaluate(() => (window as any).__arena.scene.fighters[1].score.damage);
  console.log(`NUCLEAR UNDEAD burst ${burst}%`);
  expect(burst).toBeGreaterThanOrEqual(8);
});

test('P0 arena modifiers: telegraph, effect', async ({ page }) => {
  test.setTimeout(120_000);
  await arena(
    page,
    '/?a=18&b=66&fight=1&test=1&mods=TOXIC_FLOOR,SLIPPERY_FLOOR,UNSTABLE_KNOCKBACK',
  );
  const mods = await page.evaluate(() => (window as any).__arena.state().mods);
  expect(mods).toMatchObject({ gravity: 1, friction: 0.3, kb: 1.35 });
  // TOXIC FLOOR: a segment arms (telegraph) within ~3 s, then hurts a fighter standing on it
  await page.evaluate(() => {
    const A = (window as any).__arena;
    A.idle(0, 300);
    A.idle(1, 1000);
  });
  await page.waitForFunction(
    () => (window as any).__arena.state().entities.zones.includes('floor-toxic'),
    null,
    { timeout: 5000 },
  );
  const zone = await page.evaluate(() => {
    const z = (window as any).__arena.scene.zones.find((z: any) => z.o.kind === 'floor-toxic');
    return {
      x: z.rect.x,
      w: z.rect.width,
      armedIn: z.activeAt - (window as any).__arena.scene.time.now,
      dieIn: z.dieAt - (window as any).__arena.scene.time.now,
    };
  });
  expect(zone.armedIn).toBeGreaterThan(500); // visible telegraph before it hurts
  // Park on the glowing segment and make sure we are standing on the main floor (not a float above it).
  for (let tries = 0; tries < 5; tries++) {
    await page.evaluate((x) => (window as any).__arena.idle(0, x), zone.x + zone.w / 2);
    await page.waitForTimeout(250);
    const y = await page.evaluate(() => (window as any).__arena.scene.fighters[0].y);
    if (Math.abs(y - 521) < 6) break;
  }
  // Wait on game time, not wall time: under load the game clock runs slower than real time.
  await page
    .waitForFunction(() => (window as any).__arena.scene.fighters[0].score.damage > 0, null, {
      timeout: 15_000,
    })
    .catch(() => {});
  const dmg = await page.evaluate(() => (window as any).__arena.scene.fighters[0].score.damage);
  console.log(`TOXIC FLOOR damage while standing on the segment: ${dmg}%`);
  expect(dmg).toBeGreaterThan(0);

  await arena(page, '/?a=18&b=66&fight=1&test=1&mods=LOW_GRAVITY');
  expect(await page.evaluate(() => (window as any).__arena.state().mods.gravity)).toBe(0.7);
  await arena(page, '/?a=18&b=66&fight=1&test=1&mods=');
  await expect(page.getByText('STABLE… FOR NOW')).toHaveCount(0); // arena text is drawn in canvas; DOM check below
  expect(await page.evaluate(() => (window as any).__arena.state().modifiers)).toEqual([]);
});

// keep the helper referenced for future cases
void ev;
void S;
