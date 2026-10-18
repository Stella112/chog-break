import { expect, test } from '@playwright/test';

// Bot behaviour: difficulty levels must actually differ, and the bot should not stand in hazards.

test('difficulty ladder: Hard beats Easy, Normal beats Easy (headless, real mutants)', async ({ page }) => {
  test.setTimeout(600_000);
  await page.goto('/?test=1');
  await page.waitForFunction(() => !!(window as any).__sim, null, { timeout: 30_000 });
  const hardVsEasy = await page.evaluate(() => (window as any).__sim.ladder(30, 'hard', 'easy'));
  const normalVsEasy = await page.evaluate(() => (window as any).__sim.ladder(30, 'normal', 'easy'));
  const hardVsNormal = await page.evaluate(() => (window as any).__sim.ladder(30, 'hard', 'normal'));
  for (const r of [hardVsEasy, normalVsEasy, hardVsNormal]) {
    console.log(`${r.a} vs ${r.b}: ${r.aWins}-${r.bWins} (${Math.round(r.aRate * 100)}%), lives lost/match ${r.livesLostPerMatch.toFixed(2)}`);
  }
  expect(hardVsEasy.aRate).toBeGreaterThanOrEqual(0.65);
  expect(normalVsEasy.aRate).toBeGreaterThanOrEqual(0.55);
  expect(hardVsNormal.aRate).toBeGreaterThanOrEqual(0.5);
});

test('bot steps off an arming hazard', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?a=18&b=66&fight=1&test=1');
  await page.getByRole('radio', { name: 'HARD' }).click();
  await page.getByRole('button', { name: 'FIGHT ▸' }).click();
  await page.waitForFunction(() => (window as any).__arena?.state().live === true, null, { timeout: 20_000 });
  let escaped = 0;
  for (let trial = 0; trial < 4; trial++) {
    const out = await page.evaluate(async () => {
      const A = (window as any).__arena;
      const S = A.scene;
      for (const src of S.sources) src.graceUntil = 0;
      A.idle(0, 300); // player parked far away, untouchable so the match can't end mid-test
      S.fighters[0].invulnUntil = S.time.now + 60_000;
      S.fighters[1].score.damage = 0;
      const bot = S.fighters[1];
      bot.body.reset(700, 500);
      await new Promise((r) => setTimeout(r, 400));
      const x = bot.x;
      S.spawnZone({ owner: null, x: x - 60, y: 526, w: 120, h: 34, kind: 'floor-toxic', durationMs: 3000, armMs: 900, affects: 'all' });
      await new Promise((r) => setTimeout(r, 1000));
      const hb = bot.hurtbox();
      return { inside: hb.right > x - 60 && hb.x < x + 60 && hb.bottom > 520, moved: Math.round(bot.x - x) };
    });
    if (!out.inside) escaped++;
    console.log(`trial ${trial}: moved ${out.moved} px, still inside: ${out.inside}`);
    await page.waitForTimeout(2500);
  }
  expect(escaped).toBeGreaterThanOrEqual(3);
});
