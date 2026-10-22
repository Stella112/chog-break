// Frame-perfect footage of the real game for the demo video.
//   node video/capture.mjs <shot> [baseUrl]      shots: landing, lab, fight, notebook, phone
// UI shots: Chrome virtual time is paused and advanced exactly one frame (1/30 s) between screenshots, so
// CSS animations and timers are smooth no matter how slow the capture is.
// Arena shots: the Phaser loop is stopped and stepped by hand (game.step) with a virtual clock, also patched
// into Date.now/performance.now so tweens and the 3D stage follow the same time. A small controller plays
// with real key presses. Output: video/footage/<shot>.mp4 (1920x1080, 30 fps, H.264).
import { chromium, devices } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const shot = process.argv[2];
const BASE = process.argv[3] ?? 'http://localhost:4181';
const FPS = 30;
const DT = 1000 / FPS;
const OUT = join('video', 'footage');
const FRAMES = join(OUT, `${shot}-frames`);
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

let frameNo = 0;
const log = (msg) => console.log(`  [${(frameNo / FPS).toFixed(1)}s] ${msg}`);
async function shoot(cdp, w = 1280, h = 720, scale = 1.5) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: w, height: h, scale } });
  writeFileSync(join(FRAMES, `f${String(frameNo++).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64'));
}

function encode() {
  const mp4 = join(OUT, `${shot}.mp4`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', join(FRAMES, 'f%05d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-vf', 'scale=1920:1080:flags=lanczos', mp4]);
  console.log(`${shot}: ${frameNo} frames → ${mp4} (${(frameNo / FPS).toFixed(1)} s)`);
}


// ---------- game sound, captured sample-exact ----------
// Every AudioContext the page makes is one shared OfflineAudioContext whose clock is the capture clock
// (window.__audioT = the current video frame's time), so each sound effect lands on its exact frame.
// The game's own music is muted; the edit adds it separately.
function audioInit(seconds) {
  try {
    localStorage.setItem('chogbreak.music.v1', '0');
    localStorage.setItem('chogbreak.muted.v1', '0');
  } catch {
    // storage blocked: the game's defaults (music on) still apply
  }
  window.__audioT = 1e6; // past the buffer's end: sounds from before the first captured frame stay silent
  let shared = null;
  const Offline = function () {
    if (!shared) {
      shared = new OfflineAudioContext(2, 48000 * seconds, 48000);
      Object.defineProperty(shared, 'currentTime', { get: () => window.__audioT });
      Object.defineProperty(shared, 'state', { get: () => 'running' });
      shared.resume = () => Promise.resolve();
      shared.suspend = () => Promise.resolve();
      window.__offline = shared;
    }
    return shared;
  };
  window.AudioContext = Offline;
  window.webkitAudioContext = Offline;
}

const RENDER_AUDIO = `(async () => {
  if (!window.__offline) return null;
  const buf = await window.__offline.startRendering();
  const n = Math.min(buf.length, Math.round(window.__audioEnd * buf.sampleRate));
  const ch = [buf.getChannelData(0), buf.getChannelData(1)];
  const dv = new DataView(new ArrayBuffer(44 + n * 4));
  const str = (o, x) => [...x].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, buf.sampleRate, true);
  dv.setUint32(28, buf.sampleRate * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true);
  str(36, 'data'); dv.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) dv.setInt16(44 + i * 4 + c * 2, Math.max(-1, Math.min(1, ch[c][i])) * 32767, true);
  const bytes = new Uint8Array(dv.buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
})()`;

async function saveAudio(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'advance' }).catch(() => {});
  await cdp.send('Runtime.evaluate', { expression: `window.__audioEnd = ${frameNo / FPS}` });
  const r = await cdp.send('Runtime.evaluate', { expression: RENDER_AUDIO, awaitPromise: true, returnByValue: true });
  if (!r.result?.value) return console.log('  (no game sound in this shot)');
  writeFileSync(join(OUT, `${shot}.sfx.wav`), Buffer.from(r.result.value, 'base64'));
  console.log(`  game sound → ${join(OUT, `${shot}.sfx.wav`)}`);
}

// ---------- virtual-time UI capture ----------
async function vtSetup(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });
  const advance = (ms) =>
    new Promise((res) => {
      cdp.once('Emulation.virtualTimeBudgetExpired', res);
      cdp.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: ms });
    });
  /** capture n frames; before(i) runs ahead of each frame (inputs, scrolling) */
  const frames = async (n, before) => {
    for (let i = 0; i < n; i++) {
      if (before) await before(i);
      await cdp.send('Runtime.evaluate', { expression: `window.__audioT = ${frameNo / FPS}` });
      await advance(DT);
      await shoot(cdp);
    }
  };
  const hold = (sec) => frames(Math.round(sec * FPS));
  const js = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: false });
    return r.result?.value;
  };
  return { cdp, frames, hold, advance, js };
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// ---------- shots ----------
// scroll with an ease, driven by raw CDP (Playwright's evaluate can stall while virtual time is paused)
async function easeScroll(frames, js, toY, sec) {
  const fromY = await js('window.scrollY');
  const n = Math.round(sec * FPS);
  await frames(n, (i) => js(`window.scrollTo(0, ${fromY + (toY - fromY) * ease((i + 1) / n)})`));
}
const topOf = (sel) => `document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect().top + window.scrollY - 70`;

async function landing(page) {
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(2500);
  const { frames, hold, js } = await vtSetup(page);
  await hold(4);
  for (const [sel, sec, rest] of [['#how', 2.2, 1.6], ['.ld-genes', 1.8, 2.2], ['#onchain', 1.8, 2.5]]) {
    log(sel);
    await easeScroll(frames, js, await js(topOf(sel)), sec);
    await hold(rest);
  }
}

async function lab(page) {
  await page.goto(`${BASE}/play/?view=lab`);
  await page.waitForTimeout(3000);
  const { frames, hold, js } = await vtSetup(page);
  const choose = (i, v) => js(`(() => { const el = document.querySelectorAll('.browser select')[${i}];
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, ${JSON.stringify(v)});
    el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  const clickCell = (n) => js(`document.querySelectorAll('.cell')[${n}].click()`);
  const scrollY = () => js('window.scrollY');
  const scrollTo = async (toY, sec) => {
    const fromY = await scrollY();
    const n = Math.round(sec * FPS);
    await frames(n, (i) => js(`window.scrollTo(0, ${fromY + (toY - fromY) * ease((i + 1) / n)})`));
  };
  await hold(1.2);
  log('filter Head → Crown');
  await choose(0, 'Head');
  await hold(0.5);
  await choose(1, 'crown');
  await hold(0.9);
  await clickCell(0);
  await hold(1.1);
  log('filter Eyes → purple laser');
  await choose(1, '');
  await hold(0.3);
  await choose(0, 'Eyes');
  await hold(0.5);
  await choose(1, 'purple laser');
  await hold(0.9);
  await clickCell(2);
  await hold(1.2);
  log('scroll up, SPLICE');
  await scrollTo(0, 0.6);
  await hold(0.4);
  await js(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'SPLICE').click()`);
  await hold(7.5); // the reveal sequence
  log('trait table');
  const top = await js(`document.querySelector('table.genes').getBoundingClientRect().top + window.scrollY - 90`);
  await scrollTo(top ?? 400, 1.6);
  await hold(4.5);
  await scrollTo(0, 1.2);
}

async function seedNotebook(page) {
  // a few real experiments first so the notebook isn't empty (local, free)
  for (const [a, b] of [[7, 1900], [1, 2], [100, 500], [70, 1200], [66, 100]]) {
    await page.goto(`${BASE}/play/?a=${a}&b=${b}`);
    await page.waitForTimeout(1500);
  }
}

// swap one parent of KING BEAM → a different mutant (virtual time, so the reveal is smooth)
async function swap(page) {
  await seedNotebook(page);
  await page.goto(`${BASE}/play/?a=66&b=100`);
  await page.waitForTimeout(12000); // reveal done, every chunk loaded
  const { frames, hold, js } = await vtSetup(page);
  const click = (text) => js(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(text)})).click()`);
  await hold(1.2);
  log('swap parent B');
  await click('CHANGE #1561');
  await hold(1.0);
  await js(`(() => { for (const el of document.querySelectorAll('.browser select')) {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, '');
    el.dispatchEvent(new Event('change', { bubbles: true })); } })()`);
  await hold(0.8);
  await js(`document.querySelectorAll('.cell')[${Number(process.env.SWAP_CELL ?? 3)}].click()`);
  await hold(1.0);
  await easeScroll(frames, js, 0, 0.5);
  await click('SPLICE');
  await hold(9);
}

// the notebook is static: real time, one screenshot per scroll position
async function notebook(page) {
  await seedNotebook(page);
  await page.goto(`${BASE}/play/?view=notebook`);
  await page.waitForTimeout(4000);
  const cdp = await page.context().newCDPSession(page);
  const still = async (sec) => { for (let i = 0; i < Math.round(sec * FPS); i++) await shoot(cdp); };
  await still(2.5);
  const n = Math.round(2.5 * FPS);
  for (let i = 0; i < n; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), 480 * ease((i + 1) / n));
    await page.waitForTimeout(16);
    await shoot(cdp);
  }
  await still(2);
}

// the real first mainnet recording: the pair's on-chain line in the app, then its transaction on Monadscan (static, real time)
const FIRST_RECORD_TX = '0xfa06348c2cc0b589c68dd7c1e9d7e21aa34b562cfc3a852b53abb7be0b9ac874';
async function onchain(page) {
  const cdp = await page.context().newCDPSession(page);
  const still = async (sec) => { for (let i = 0; i < Math.round(sec * FPS); i++) await shoot(cdp); };
  await page.goto(`${BASE}/play/?a=101&b=202`);
  await page.waitForTimeout(14000);
  await page.locator('.onchain-line').first().waitFor({ timeout: 20000 });
  log(await page.locator('.onchain-line').first().textContent());
  await still(4);
  await page.goto(`https://monadscan.com/tx/${FIRST_RECORD_TX}`);
  await page.waitForTimeout(8000);
  await still(4);
  const n = Math.round(2 * FPS);
  for (let i = 0; i < n; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), 300 * ease((i + 1) / n));
    await page.waitForTimeout(16);
    await shoot(cdp);
  }
  await still(2);
}

// ---------- arena (manual stepping) ----------
async function arenaSetup(page) {
  await page.evaluate((dt) => {
    const game = window.__arena.scene.game;
    game.loop.stop();
    let vt = performance.now();
    const realPerf = performance.now.bind(performance);
    const offset = Date.now() - vt;
    window.__vt = () => vt;
    performance.now = () => vt;
    Date.now = () => Math.round(vt + offset);
    window.__stepFrame = () => {
      // two 60 Hz physics steps per 30 fps video frame
      for (let k = 0; k < 2; k++) {
        vt += dt / 2;
        game.step(vt, dt / 2);
      }
    };
    void realPerf;
  }, DT);
}

/** Plays player 1 with real key presses: approach, punch combos, beam from range, recover when off stage. */
function makeController(page) {
  const held = new Set();
  const want = async (k, on) => {
    if (on && !held.has(k)) {
      held.add(k);
      await page.keyboard.down(k);
    } else if (!on && held.has(k)) {
      held.delete(k);
      await page.keyboard.up(k);
    }
  };
  let t = 0;
  let lastPunch = -99;
  let lastSpecial = -99;
  let lastClose = -99;
  let lastJump = -99;
  return async () => {
    t++;
    const s = await page.evaluate(() => window.__arena.state());
    const me = s.fighters[0];
    const foe = s.fighters[1];
    if (me.state === 'ko') {
      for (const k of [...held]) await want(k, false);
      return;
    }
    const dx = foe.x - me.x;
    const offStage = me.x < 260 || me.x > 1020 || me.y > 560;
    // movement
    const goRight = offStage ? me.x < 640 : dx > 70;
    const goLeft = offStage ? me.x > 640 : dx < -70;
    await want('d', goRight);
    await want('a', goLeft);
    // recovery / chasing upward
    if ((offStage && t - lastJump > 9) || (foe.y < me.y - 120 && Math.abs(dx) < 220 && t - lastJump > 20)) {
      await page.keyboard.press('w');
      lastJump = t;
    }
    // attacks
    const close = Math.abs(dx) < 120 && Math.abs(foe.y - me.y) < 70;
    if (close && t - lastPunch > 5) {
      await page.keyboard.press('j');
      lastPunch = t;
    } else if (close && t - lastClose > 70) {
      await page.keyboard.press('i');
      lastClose = t;
    } else if (!close && Math.abs(dx) > 260 && Math.abs(dx) < 760 && Math.abs(foe.y - me.y) < 50 && t - lastSpecial > 75) {
      // face the opponent, then fire the special (BEAM for KING BEAM)
      await page.keyboard.press('l');
      lastSpecial = t;
    }
  };
}

async function fight(page, seconds, { phone = false } = {}) {
  await page.goto(`${BASE}/play/?a=18&b=66&fight=1&test=1`);
  // first fight of a session shows the step-by-step coach; burn it with a quick quit so the footage is clean
  await page.getByRole('button', { name: 'FIGHT ▸' }).click();
  await page.waitForFunction(() => window.__arena?.state().live === true, null, { timeout: 60_000 });
  if (phone) await page.locator('.tc-quit').click();
  else await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'FIGHT ▸' }).click();
  await page.waitForFunction(() => window.__arena?.scene?.game, null, { timeout: 60_000 });
  await page.waitForTimeout(300);
  await arenaSetup(page);
  const cdp = await page.context().newCDPSession(page);
  const vp = page.viewportSize();
  const control = makeController(page);
  const n = Math.round(seconds * FPS);
  for (let i = 0; i < n; i++) {
    const live = await page.evaluate(() => window.__arena?.state().live && !window.__arena.state().ended);
    if (live && !phone) await control();
    await page.evaluate((t) => { window.__audioT = t; window.__stepFrame(); }, frameNo / FPS);
    await shoot(cdp, vp.width, vp.height, 1920 / vp.width);
    if (i % 150 === 0) {
      const s = await page.evaluate(() => window.__arena.state());
      console.log(`  ${(i / FPS).toFixed(0)}s lives ${s.fighters.map((f) => f.lives)} dmg ${s.fighters.map((f) => Math.round(f.damage))}`);
    }
    if (await page.evaluate(() => !window.__arena)) break; // match over → results screen
  }
}

const FULL_BLEED = '.topbar,.arena-hint{display:none!important} main,#main{padding:0!important;margin:0!important;max-width:none!important} .arena-wrap{margin:0!important} .arena-host{border:0!important;width:100vw!important;height:100vh!important;max-height:none!important}';

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  if (shot === 'phone') {
    const ctx = await browser.newContext({ ...devices['Pixel 7 landscape'] });
    const page = await ctx.newPage();
    await page.addInitScript(audioInit, 140);
    await fight(page, 8, { phone: true });
    await saveAudio(page);
  } else {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
    const page = await ctx.newPage();
    await page.addInitScript(audioInit, 140);
    if (shot === 'fight') {
      await page.addInitScript((css) => {
        document.addEventListener('DOMContentLoaded', () => {
          const s = document.createElement('style');
          s.textContent = css;
          document.head.appendChild(s);
        });
      }, FULL_BLEED);
      await fight(page, Number(process.env.SECONDS ?? 70));
    } else if (shot === 'landing') await landing(page);
    else if (shot === 'lab') await lab(page);
    else if (shot === 'notebook') await notebook(page);
    else if (shot === 'swap') await swap(page);
    else if (shot === 'onchain') await onchain(page);
    else throw new Error(`unknown shot ${shot}`);
    await saveAudio(page);
  }
  encode();
} finally {
  await browser.close();
}
