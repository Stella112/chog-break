// Renders a motion-graphics scene frame by frame. Each scene is a pure function of time (render(t)), so frames
// are exact no matter how slow the capture is.
//   node video/gfx/render.mjs <scene>   → video/footage/gfx-<scene>.mp4 (opaque) or .mov (alpha, PNG codec)
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, resolve } from 'node:path';

const scene = process.argv[2];
const FPS = 30;
const ROOT = resolve('.');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT)) throw new Error('outside');
    res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream' });
    res.end(await readFile(p));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const port = server.address().port;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`http://127.0.0.1:${port}/video/gfx/index.html?scene=${scene}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120_000 });
  const { dur, alpha } = await page.evaluate(() => window.__meta);
  const cdp = await page.context().newCDPSession(page);
  if (alpha) await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  const dir = join('video', 'footage', `gfx-${scene}-frames`);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const n = Math.round(dur * FPS);
  for (let i = 0; i < n; i++) {
    await cdp.send('Runtime.evaluate', { expression: `window.__render(${i / FPS})` });
    await cdp.send('Runtime.evaluate', { expression: 'new Promise((r) => requestAnimationFrame(() => r()))', awaitPromise: true });
    const { data } = await cdp.send('Page.captureScreenshot', alpha ? { format: 'png' } : { format: 'jpeg', quality: 95 });
    await writeFile(join(dir, `f${String(i).padStart(5, '0')}.${alpha ? 'png' : 'jpg'}`), Buffer.from(data, 'base64'));
  }
  const out = join('video', 'footage', `gfx-${scene}.${alpha ? 'mov' : 'mp4'}`);
  const enc = alpha ? ['-c:v', 'png', '-pix_fmt', 'rgba'] : ['-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p'];
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', join(dir, `f%05d.${alpha ? 'png' : 'jpg'}`), ...enc, out]);
  console.log(`${scene}: ${n} frames → ${out}`);
} finally {
  await browser.close();
  server.close();
}
