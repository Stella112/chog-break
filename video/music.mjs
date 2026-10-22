// Renders the game's own music tracks to WAV (offline, sample-exact) through the dev server.
//   node video/music.mjs [baseUrl]  → video/footage/music/<track>.wav
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/play/`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
const ALL = [['lab', 170], ['arena', 90]];
for (const [track, seconds] of ALL.filter(([t]) => !process.env.TRACK || t === process.env.TRACK)) {
  const b64 = await page.evaluate(async ([t, s]) => {
    const { renderTrackOffline } = await import('/src/audio/music.ts');
    const buf = await renderTrackOffline(t, s);
    // 16-bit PCM stereo WAV
    const ch = [buf.getChannelData(0), buf.getChannelData(buf.numberOfChannels > 1 ? 1 : 0)];
    const n = buf.length, dv = new DataView(new ArrayBuffer(44 + n * 4));
    const str = (o, x) => [...x].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt '); dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, buf.sampleRate, true);
    dv.setUint32(28, buf.sampleRate * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true);
    str(36, 'data'); dv.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) dv.setInt16(44 + i * 4 + c * 2, Math.max(-1, Math.min(1, ch[c][i])) * 32767, true);
    const bytes = new Uint8Array(dv.buffer);
    let s2 = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s2 += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s2);
  }, [track, seconds]);
  writeFileSync(`video/footage/music/${track}.wav`, Buffer.from(b64, 'base64'));
  console.log(track, seconds, 's');
}
await browser.close();
