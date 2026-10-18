import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// §F Phase 4 balance smoke test: ≥ 200 seeded headless bot-vs-bot matches of random real mutants.
// No gene may win more than 65% of its matches once it has appeared ≥ 30 times.
test('balance: 300 headless matches, no gene above 65% with n ≥ 30', async ({ page }) => {
  test.setTimeout(900_000);
  await page.goto('/?test=1');
  await page.waitForFunction(() => !!(window as any).__sim, null, { timeout: 30_000 });
  const r = await page.evaluate(() => (window as any).__sim.run(300, 2026), null);
  const rows = r.rows as { slot: string; gene: string; n: number; wins: number; rate: number }[];
  const table = [
    `Balance smoke test — ${r.matches} matches, ${r.draws} draws, avg match ${(r.avgMatchMs / 1000).toFixed(1)} s (seed 2026, both bots Normal)`,
    '',
    '| Slot | Gene | n | Wins | Win rate |',
    '|---|---|---|---|---|',
    ...rows
      .filter((x) => x.n >= 10)
      .map((x) => `| ${x.slot} | ${x.gene} | ${x.n} | ${x.wins} | ${(x.rate * 100).toFixed(1)}%${x.n >= 30 && x.rate > 0.65 ? ' ⚠' : ''} |`),
  ].join('\n');
  writeFileSync('test-results/balance.md', table);
  console.log(table);
  const over = rows.filter((x) => x.n >= 30 && x.rate > 0.65);
  expect(over, JSON.stringify(over)).toEqual([]);
});
